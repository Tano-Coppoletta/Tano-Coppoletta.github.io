import { createTanoAvatar } from './tanoAvatar.js';

/* Retro City scene calibration. All points are normalized to the source image
   (0..1); tune WALKABLE_POLYGON and landmarks after the final city art lands. */
const SCENE = {
  image: '/images/retro-city.webp',
  playerRadius: 0.008,
  moveSpeed: 0.15,
  // The playable avenue follows the clear pavement diagonal; excluded props
  // below keep pathfinding off the trolley, lamp, mailbox, and parked car.
  walkablePolygon: [
    [0.00, 0.52], [0.18, 0.55], [0.42, 0.61], [0.68, 0.68], [0.94, 0.76],
    [1.00, 0.79], [1.00, 0.90], [0.70, 0.81], [0.43, 0.74], [0.18, 0.66], [0.00, 0.60],
  ],
  blockedAreas: [
    { type: 'rect', x1: 0.03, y1: 0.72, x2: 0.35, y2: 0.92 }, // trolley + tracks
    { type: 'circle', x: 0.72, y: 0.64, radius: 0.035 }, // mailbox
    { type: 'circle', x: 0.45, y: 0.58, radius: 0.024 }, // lamppost
    { type: 'rect', x1: 0.88, y1: 0.74, x2: 1.01, y2: 0.85 }, // parked car
  ],
  start: [0.51, 0.70],
  landmarks: {
    agents: { x: 0.55, y: 0.55, walkX: 0.55, walkY: 0.68, label: 'Agent Workbench', kicker: '01 / AI systems', title: 'PROJECTS' },
    product: { x: 0.19, y: 0.50, walkX: 0.19, walkY: 0.57, label: 'Product Studio', kicker: '02 / product engineering', title: 'ABOUT' },
    engineering: { x: 0.79, y: 0.68, walkX: 0.78, walkY: 0.70, label: 'Engineering & Research', kicker: '03 / research & delivery', title: 'RESEARCH' },
    community: { x: 0.37, y: 0.64, walkX: 0.37, walkY: 0.64, label: 'Community & Leadership', kicker: '04 / leadership', title: 'COMMUNITY' },
  },
  contact: { x: 0.91, y: 0.65, walkX: 0.84, walkY: 0.70, label: 'Contact' },
  doors: [
    { id: 'career', gate: 'about', x: 0.19, y: 0.45, walkX: 0.19, walkY: 0.59 },
    { id: 'agents', gate: 'projects', x: 0.55, y: 0.50, walkX: 0.55, walkY: 0.68 },
    { id: 'contact', gate: 'contact', x: 0.91, y: 0.60, walkX: 0.84, walkY: 0.76 },
  ],
};

const canvas = document.querySelector('#build-scene');
const context = canvas?.getContext('2d', { alpha: false });
const status = document.querySelector('#scene-status');
const fallback = document.querySelector('#webgl-fallback');
const scene = document.querySelector('.build-scene-card');
const hud = document.querySelector('.game-hud');
const storyPanel = document.querySelector('#story-panel');
const mapPanel = document.querySelector('#workshop-map');
const careerPanel = document.querySelector('#career-overlay');
const contactPanel = document.querySelector('#contact-overlay');
const scrim = document.querySelector('.overlay-scrim');
const storyPanes = [...document.querySelectorAll('[data-pane]')];
const stopButtons = [...document.querySelectorAll('[data-stop]')];
const overlayButtons = [...document.querySelectorAll('[data-overlay]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const image = new Image();
const player = { x: SCENE.start[0], y: SCENE.start[1], heading: 0, targetHeading: 0, moving: false };
const avatar = createTanoAvatar();
const heldKeys = new Set();
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
let imageReady = false;
let frameHandle = 0;
let idleTimer = 0;
let lastTime = 0;
let interactionUntil = 0;
let view = { width: 1, height: 1, scale: 1, cameraX: 0, cameraY: 0, mobile: false };
let panOrigin = null;
let activeDialog = null;
let returnFocus = null;
let currentPath = [];
let pathIndex = 0;
let lastStoryTrigger = null;
let panPinned = false;

function setStatus(message) {
  if (status && status.textContent !== message) status.textContent = message;
}

function isGroundPoint(x, y) {
  const polygon = SCENE.walkablePolygon;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  if (!inside) return false;
  return !SCENE.blockedAreas.some((area) => {
    if (area.type === 'rect') return x >= area.x1 && x <= area.x2 && y >= area.y1 && y <= area.y2;
    return Math.hypot(x - area.x, y - area.y) < area.radius;
  });
}

function pointInPolygon(x, y) {
  if (!isGroundPoint(x, y)) return false;
  // Footprint clearance, not just a point: Tano cannot graze prop corners.
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    if (!isGroundPoint(x + Math.cos(angle) * SCENE.playerRadius, y + Math.sin(angle) * SCENE.playerRadius)) return false;
  }
  return true;
}

function imagePointToScreen(x, y) {
  return {
    x: (x - view.cameraX) * view.scale + view.width / 2,
    y: (y - view.cameraY) * view.scale + view.height / 2,
  };
}

function screenPointToImage(x, y) {
  return {
    x: (x - view.width / 2) / view.scale + view.cameraX,
    y: (y - view.height / 2) / view.scale + view.cameraY,
  };
}

function updateView() {
  if (!canvas) return;
  const bounds = canvas.getBoundingClientRect();
  const ratio = pixelRatio();
  view.width = Math.max(1, bounds.width * ratio);
  view.height = Math.max(1, bounds.height * ratio);
  view.mobile = bounds.width < 760;
  canvas.width = Math.round(view.width);
  canvas.height = Math.round(view.height);
  const imageWidth = imageReady ? image.naturalWidth : 1200;
  const imageHeight = imageReady ? image.naturalHeight : 640;
  const cover = Math.max(view.width / imageWidth, view.height / imageHeight);
  view.scale = view.mobile ? cover * 1.12 : cover;
  if (!panOrigin) {
    const targetX = view.mobile ? player.x * imageWidth : imageWidth / 2;
    const targetY = view.mobile ? player.y * imageHeight : imageHeight * 0.55;
    const maxX = Math.max(imageWidth / 2, imageWidth - view.width / view.scale / 2);
    const maxY = Math.max(imageHeight / 2, imageHeight - view.height / view.scale / 2);
    view.cameraX = Math.max(imageWidth - maxX, Math.min(maxX, targetX));
    view.cameraY = Math.max(imageHeight - maxY, Math.min(maxY, targetY));
  }
  positionLandmarks();
}

function positionLandmarks() {
  if (!canvas) return;
  const bounds = canvas.getBoundingClientRect();
  const imageWidth = imageReady ? image.naturalWidth : 1200;
  const imageHeight = imageReady ? image.naturalHeight : 640;
  for (const landmark of SCENE.doors) {
    const button = document.querySelector(`[data-gate="${landmark.gate}"]`);
    if (!button) continue;
    const point = imagePointToScreen(landmark.x * imageWidth, landmark.y * imageHeight);
    button.style.left = `${point.x / pixelRatio() - button.offsetWidth / 2}px`;
    button.style.top = `${point.y / pixelRatio() - button.offsetHeight - 12}px`;
    button.style.right = 'auto';
    button.style.bottom = 'auto';
    button.hidden = point.x < -40 || point.x > view.width + 40 || point.y < -40 || point.y > view.height + 40;
  }
}

function drawTano(time) {
  if (!context || !imageReady) return;
  if (!avatar.available) {
    if (fallback) {
      fallback.hidden = false;
      fallback.textContent = 'The 3D character is unavailable in this browser. You can still explore every portfolio story through the map.';
    }
    return;
  }
  const x = player.x * image.naturalWidth;
  const y = player.y * image.naturalHeight;
  const screen = imagePointToScreen(x, y);
  const depth = 0.78 + player.y * 0.45;
  const height = 100 * view.scale * depth;
  const width = height * avatar.canvas.width / avatar.canvas.height;
  avatar.render({
    time,
    moving: player.moving,
    heading: player.heading,
    interacting: time < interactionUntil,
    reducedMotion: reducedMotion.matches,
  });
  context.save();
  context.fillStyle = 'rgba(24,17,42,.38)';
  context.beginPath();
  context.ellipse(screen.x, screen.y + 2 * view.scale, 15 * depth * view.scale, 4 * depth * view.scale, -0.12, 0, Math.PI * 2);
  context.fill();
  context.imageSmoothingEnabled = false;
  context.drawImage(avatar.canvas, Math.round(screen.x - width / 2), Math.round(screen.y - height * avatar.groundAnchorY), Math.round(width), Math.round(height));
  context.restore();
}

function draw(time = 0) {
  frameHandle = 0;
  if (!context || !canvas) return;
  if (imageReady) {
    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;
    context.fillStyle = '#201a37';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const topLeft = imagePointToScreen(0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, topLeft.x, topLeft.y, imageWidth * view.scale, imageHeight * view.scale);
    drawTano(time);
  } else {
    context.fillStyle = '#261d3e';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#d96072';
    context.fillRect(0, canvas.height * 0.29, canvas.width, canvas.height * 0.22);
    context.fillStyle = '#f1a35b';
    context.fillRect(0, canvas.height * 0.51, canvas.width, canvas.height * 0.06);
  }
  positionLandmarks();
}

function requestDraw() {
  startAnimation();
}

function normalizePointer(event) {
  const bounds = canvas.getBoundingClientRect();
  return screenPointToImage((event.clientX - bounds.left) * pixelRatio(), (event.clientY - bounds.top) * pixelRatio());
}

function gridPoint(x, y) {
  const cols = 60;
  const rows = 34;
  return {
    x: Math.max(0, Math.min(cols - 1, Math.round(x * (cols - 1)))),
    y: Math.max(0, Math.min(rows - 1, Math.round(y * (rows - 1)))),
  };
}

function findPath(targetX, targetY) {
  const cols = 60, rows = 34;
  const start = gridPoint(player.x, player.y);
  const goal = gridPoint(targetX, targetY);
  const key = (p) => `${p.x},${p.y}`;
  const startKey = key(start), goalKey = key(goal);
  const open = [start];
  const cameFrom = new Map();
  const costs = new Map([[startKey, 0]]);
  const heuristic = (p) => Math.hypot(p.x - goal.x, p.y - goal.y);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (open.length) {
    open.sort((a, b) => (costs.get(key(a)) + heuristic(a)) - (costs.get(key(b)) + heuristic(b)));
    const current = open.shift();
    const currentKey = key(current);
    if (currentKey === goalKey) {
      let cursor = currentKey;
      const path = [];
      while (cursor) {
        path.push(cursor.split(',').map(Number));
        if (cursor === startKey) break;
        cursor = cameFrom.get(cursor);
      }
      return path.reverse().map((point) => [point[0] / (cols - 1), point[1] / (rows - 1)]);
    }
    for (const [dx, dy] of directions) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows) continue;
      const nx = next.x / (cols - 1), ny = next.y / (rows - 1);
      if (!pointInPolygon(nx, ny)) continue;
      if (dx && dy &&
          (!pointInPolygon(current.x / (cols - 1), ny) || !pointInPolygon(nx, current.y / (rows - 1)))) continue;
      const nextKey = key(next);
      const cost = costs.get(currentKey) + (dx && dy ? 1.414 : 1);
      if (cost >= (costs.get(nextKey) ?? Infinity)) continue;
      cameFrom.set(nextKey, currentKey);
      costs.set(nextKey, cost);
      if (!open.some((node) => key(node) === nextKey)) open.push(next);
    }
  }
  return [];
}

function walkTo(x, y) {
  if (!pointInPolygon(x, y)) {
    setStatus('That part of the city is not walkable. Choose a street or use the map.');
    return false;
  }
  currentPath = findPath(x, y);
  pathIndex = currentPath.length > 1 ? 1 : 0;
  if (!currentPath.length) {
    setStatus('No sidewalk route reaches that point. Try another street.');
    return false;
  }
  panPinned = false;
  player.moving = true;
  startAnimation();
  return true;
}

function nearestLandmark() {
  let nearest = null, distance = Infinity;
  for (const place of SCENE.doors) {
    const next = Math.hypot((player.x - place.walkX) * 1.8, (player.y - place.walkY));
    if (next < distance) { nearest = place.id; distance = next; }
  }
  return distance < 0.09 ? nearest : null;
}

function setDialog(panel, trigger) {
  activeDialog = panel;
  returnFocus = trigger || document.activeElement;
  for (const candidate of [storyPanel, mapPanel, careerPanel, contactPanel]) {
    if (candidate) {
      candidate.hidden = candidate !== panel;
      if (candidate === panel) {
        candidate.setAttribute('role', 'dialog');
        candidate.setAttribute('aria-modal', 'true');
      } else candidate.removeAttribute('aria-modal');
    }
  }
  if (scrim) scrim.hidden = !panel;
  scene?.toggleAttribute('inert', Boolean(panel));
  hud?.toggleAttribute('inert', Boolean(panel));
  heldKeys.clear();
  currentPath = [];
  player.moving = false;
  interactionUntil = performance.now() + 1000;
  startAnimation();
  const focusTarget = panel === storyPanel
    ? panel.querySelector('.story-pane:not([hidden]) h2')
    : panel?.querySelector('h2, button, a');
  focusTarget?.focus({ preventScroll: true });
  requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
}

function openStory(id, trigger = null) {
  const stop = SCENE.landmarks[id];
  if (!stop) return;
  lastStoryTrigger = trigger;
  storyPanes.forEach((pane) => { pane.hidden = pane.dataset.pane !== id; });
  const kicker = document.querySelector('#story-kicker');
  if (kicker) kicker.textContent = stop.kicker;
  stopButtons.forEach((button) => {
    const active = button.dataset.stop === id;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-expanded', String(active));
  });
  setDialog(storyPanel, trigger);
  setStatus(`${stop.label} story opened.`);
}

function openOverlay(name, trigger) {
  const panel = { map: mapPanel, career: careerPanel, contact: contactPanel }[name];
  if (!panel) return;
  setDialog(panel, trigger);
}

function closeDialog() {
  if (!activeDialog) return;
  const wasStory = activeDialog === storyPanel;
  for (const panel of [storyPanel, mapPanel, careerPanel, contactPanel]) {
    if (panel) {
      panel.hidden = true;
      panel.removeAttribute('aria-modal');
    }
  }
  activeDialog = null;
  if (scrim) scrim.hidden = true;
  scene?.removeAttribute('inert');
  hud?.removeAttribute('inert');
  const destination = wasStory ? lastStoryTrigger : returnFocus;
  const target = destination?.isConnected && destination.getClientRects().length && !destination.closest('[hidden], [inert]')
    ? destination
    : document.querySelector('[data-overlay="map"]');
  target?.focus({ preventScroll: true });
  requestAnimationFrame(() => target?.focus({ preventScroll: true }));
}

function trapFocus(event, panel) {
  if (event.key !== 'Tab') return;
  const items = [...panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((item) => !item.hidden && item.getClientRects().length);
  if (!items.length) { event.preventDefault(); panel.focus(); return; }
  if (event.shiftKey && (document.activeElement === items[0] || !items.includes(document.activeElement))) {
    event.preventDefault(); items.at(-1).focus();
  } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
    event.preventDefault(); items[0].focus();
  }
}

stopButtons.forEach((button) => button.addEventListener('click', () => openStory(button.dataset.stop, button)));
overlayButtons.forEach((button) => button.addEventListener('click', () => openOverlay(button.dataset.overlay, button)));
document.querySelectorAll('[data-overlay-close]').forEach((button) => button.addEventListener('click', closeDialog));
scrim?.addEventListener('click', closeDialog);
scrim?.addEventListener('pointerdown', (event) => event.preventDefault());
for (const panel of [storyPanel, mapPanel, careerPanel, contactPanel]) {
  panel?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
    else trapFocus(event, panel);
  });
}

function handleKeyboard(event) {
  if (event.target instanceof HTMLElement &&
      (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return;
  if (event.key === 'Escape' && activeDialog) { event.preventDefault(); closeDialog(); return; }
  if (event.key.toLowerCase() === 'm' && !event.repeat) {
    event.preventDefault();
    openOverlay('map', document.querySelector('[data-overlay="map"]'));
    return;
  }
  if (activeDialog || document.activeElement !== canvas) return;
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
    event.preventDefault();
    heldKeys.add(key);
    panPinned = false;
    startAnimation();
  }
  if ((key === 'enter' || key === 'e') && !event.repeat) {
    event.preventDefault();
    const nearest = nearestLandmark();
    if (nearest === 'contact' || nearest === 'career') openOverlay(nearest, canvas);
    else if (nearest) openStory(nearest, canvas);
    else setStatus('Walk near a marked building and press E, or open the map.');
  }
}
window.addEventListener('keydown', handleKeyboard);
window.addEventListener('keyup', (event) => heldKeys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => heldKeys.clear());

canvas?.addEventListener('click', (event) => {
  if (canvas.dataset.panned === 'true') return;
  canvas.focus({ preventScroll: true });
  const point = normalizePointer(event);
  const nx = point.x / (imageReady ? image.naturalWidth : 1200);
  const ny = point.y / (imageReady ? image.naturalHeight : 640);
  for (const landmark of SCENE.doors) {
    if (Math.hypot((nx - landmark.x) * 1.8, ny - landmark.y) < 0.055) {
      if (landmark.id === 'agents') openStory('agents', canvas);
      else openOverlay(landmark.id, canvas);
      return;
    }
  }
  walkTo(nx, ny);
});

canvas?.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !view.mobile) return;
  panOrigin = { x: event.clientX, y: event.clientY, cameraX: view.cameraX, cameraY: view.cameraY, dragged: false };
  canvas.setPointerCapture(event.pointerId);
});
canvas?.addEventListener('pointermove', (event) => {
  if (!panOrigin || !canvas.hasPointerCapture(event.pointerId)) return;
  const dx = event.clientX - panOrigin.x, dy = event.clientY - panOrigin.y;
  if (Math.hypot(dx, dy) > 7) panOrigin.dragged = true;
  if (!panOrigin.dragged) return;
  const ratio = pixelRatio();
  view.cameraX = panOrigin.cameraX - dx * ratio / view.scale;
  view.cameraY = panOrigin.cameraY - dy * ratio / view.scale;
  const halfWidth = view.width / view.scale / 2;
  const halfHeight = view.height / view.scale / 2;
  view.cameraX = Math.max(halfWidth, Math.min(image.naturalWidth - halfWidth, view.cameraX));
  view.cameraY = Math.max(halfHeight, Math.min(image.naturalHeight - halfHeight, view.cameraY));
  requestDraw();
});
const endPan = (event) => {
  if (!panOrigin) return;
  const dragged = panOrigin.dragged;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (dragged) {
    panOrigin = null;
    panPinned = true;
    canvas.dataset.panned = 'true';
    window.setTimeout(() => { delete canvas.dataset.panned; }, 80);
    requestDraw();
    return;
  }
  panOrigin = null;
};
canvas?.addEventListener('pointerup', endPan);
canvas?.addEventListener('pointercancel', endPan);

document.querySelectorAll('[data-move]').forEach((button) => {
  const direction = { forward: [0, -0.035], back: [0, 0.035], left: [-0.035, 0], right: [0.035, 0] }[button.dataset.move];
  button.addEventListener('click', () => walkTo(player.x + direction[0], player.y + direction[1]));
});

function animate(time) {
  const elapsed = Math.min((time - lastTime) / 1000 || 0, 0.05);
  lastTime = time;
  player.moving = false;
  if (heldKeys.size) {
    let dx = Number(heldKeys.has('d') || heldKeys.has('arrowright')) - Number(heldKeys.has('a') || heldKeys.has('arrowleft'));
    let dy = Number(heldKeys.has('s') || heldKeys.has('arrowdown')) - Number(heldKeys.has('w') || heldKeys.has('arrowup'));
    if (dx || dy) {
      const magnitude = Math.hypot(dx, dy);
      dx = dx / magnitude * elapsed * SCENE.moveSpeed;
      dy = dy / magnitude * elapsed * SCENE.moveSpeed;
      const previousX = player.x, previousY = player.y;
      const nx = player.x + dx, ny = player.y + dy;
      currentPath = [];
      if (pointInPolygon(nx, ny)) {
        player.x = nx; player.y = ny;
      } else {
        if (pointInPolygon(nx, player.y)) player.x = nx;
        if (pointInPolygon(player.x, ny)) player.y = ny;
      }
      const movedX = player.x - previousX, movedY = player.y - previousY;
      player.moving = Math.hypot(movedX, movedY) > 0.00001;
      if (player.moving) player.targetHeading = Math.atan2(movedX, movedY);
      else setStatus('Tano stays on the street. Choose a clear route, or open the map.');
    }
  } else if (pathIndex < currentPath.length) {
    const [tx, ty] = currentPath[pathIndex];
    const dx = tx - player.x, dy = ty - player.y;
    const distance = Math.hypot(dx, dy);
    const travel = elapsed * SCENE.moveSpeed;
    if (distance <= travel + 0.001) {
      player.x = tx; player.y = ty; pathIndex += 1;
    } else {
      const nx = player.x + dx / distance * travel, ny = player.y + dy / distance * travel;
      if (pointInPolygon(nx, ny)) {
        player.x = nx; player.y = ny;
      } else {
        currentPath = [];
        setStatus('That route is too close to an obstacle. Choose a clearer part of the street.');
      }
    }
    if (Math.hypot(dx, dy) > 0.00001) player.targetHeading = Math.atan2(dx, dy);
    player.moving = currentPath.length > 0;
  } else player.moving = false;
  const headingDelta = Math.atan2(Math.sin(player.targetHeading - player.heading), Math.cos(player.targetHeading - player.heading));
  player.heading += reducedMotion.matches ? headingDelta : headingDelta * Math.min(1, elapsed * 14);
  if (view.mobile && !panOrigin && !panPinned) {
    const iw = imageReady ? image.naturalWidth : 1200;
    const ih = imageReady ? image.naturalHeight : 640;
    const targetX = player.x * iw, targetY = player.y * ih;
    view.cameraX += (targetX - view.cameraX) * Math.min(1, elapsed * 4);
    view.cameraY += (targetY - view.cameraY) * Math.min(1, elapsed * 4);
    const maxX = Math.max(iw / 2, iw - view.width / view.scale / 2);
    const maxY = Math.max(ih / 2, ih - view.height / view.scale / 2);
    view.cameraX = Math.max(iw - maxX, Math.min(maxX, view.cameraX));
    view.cameraY = Math.max(ih - maxY, Math.min(maxY, view.cameraY));
  }
  draw(time);
  if (player.moving && pathIndex >= currentPath.length && !heldKeys.size) player.moving = false;
  if (player.moving || heldKeys.size || Math.abs(headingDelta) > 0.01 || (time < interactionUntil && !reducedMotion.matches)) {
    frameHandle = requestAnimationFrame(animate);
  } else if (!reducedMotion.matches && avatar.available && !document.hidden) {
    idleTimer = window.setTimeout(startAnimation, 120);
  } else if (time < interactionUntil) {
    idleTimer = window.setTimeout(startAnimation, interactionUntil - time + 1);
  }
}

function startAnimation() {
  window.clearTimeout(idleTimer);
  if (document.hidden) return;
  if (!frameHandle) frameHandle = requestAnimationFrame(animate);
}

if (canvas && context) {
  image.onload = () => {
    imageReady = image.naturalWidth > 0 && image.naturalHeight > 0;
    if (!imageReady) return;
    updateView();
    if (fallback) {
      fallback.hidden = avatar.available;
      if (!avatar.available) fallback.textContent = 'The 3D character is unavailable in this browser. You can still explore every portfolio story through the map.';
    }
    requestDraw();
    startAnimation();
  };
  image.onerror = () => {
    if (fallback) fallback.hidden = false;
    setStatus('City artwork could not be loaded. The map and career path remain available.');
    updateView();
    requestDraw();
  };
  image.src = SCENE.image;
  updateView();
  requestDraw();
  startAnimation();
  canvas.addEventListener('blur', () => heldKeys.clear());
  window.addEventListener('resize', () => { updateView(); requestDraw(); }, { passive: true });
  reducedMotion.addEventListener('change', startAnimation);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      window.clearTimeout(idleTimer);
      heldKeys.clear();
    } else {
      lastTime = performance.now();
      startAnimation();
    }
  });
  window.addEventListener('pagehide', (event) => {
    cancelAnimationFrame(frameHandle);
    window.clearTimeout(idleTimer);
    frameHandle = 0;
    if (!event.persisted) avatar.dispose();
  });
  window.addEventListener('pageshow', (event) => { if (event.persisted) startAnimation(); });
}
