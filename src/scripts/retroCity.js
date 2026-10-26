/* Retro City scene calibration. All points are normalized to the source image
   (0..1); tune WALKABLE_POLYGON and landmarks after the final city art lands. */
const SCENE = {
  image: '/images/retro-city.webp',
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
const player = { x: SCENE.start[0], y: SCENE.start[1], facing: 1, moving: false };
const heldKeys = new Set();
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
let imageReady = false;
let frameHandle = 0;
let lastTime = 0;
let walkTime = 0;
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

function pointInPolygon(x, y) {
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

function drawPixelDog(time) {
  if (!context || !imageReady) return;
  const x = player.x * image.naturalWidth;
  const y = player.y * image.naturalHeight;
  const screen = imagePointToScreen(x, y);
  const depth = 0.78 + player.y * 0.45;
  const unit = view.scale * depth;
  const step = player.moving && !reducedMotion.matches ? Math.sin(time / 75) : 0;
  context.save();
  context.translate(Math.round(screen.x), Math.round(screen.y));
  context.scale(unit * player.facing, unit);
  context.imageSmoothingEnabled = false;
  const pixel = (px, py, w, h, color) => {
    context.fillStyle = color;
    context.fillRect(Math.round(px), Math.round(py), Math.ceil(w), Math.ceil(h));
  };
  // A low, four-legged mechanical dog: articulated legs, muzzle, ears and tail.
  pixel(-15, 8, 28, 5, 'rgba(20,17,35,.38)');
  pixel(-11, -9, 18, 10, '#29324d');
  pixel(-8, -12, 12, 7, '#71839a');
  pixel(-13, -8, 6, 7, '#53647c');
  pixel(5, -8, 8, 6, '#53647c');
  pixel(10, -8, 7, 5, '#9ba9b4');
  pixel(14, -6, 5, 3, '#d8bd9b');
  pixel(17, -5, 3, 2, '#26314b');
  pixel(8, -7, 6, 2, '#67e5df');
  pixel(10, -7, 2, 1, '#e0ffff');
  pixel(5, -14, 4, 7, '#3d4764');
  pixel(6, -15, 2, 3, '#b3bbc0');
  pixel(9, -13, 3, 5, '#3d4764');
  pixel(10, -12, 2, 3, '#ef8e83');
  pixel(-14, -11, 4, 5, '#39435f');
  pixel(-16, -14, 3, 5, '#596b84');
  pixel(-18, -17, 2, 6, '#79889b');
  pixel(-7, -6, 8, 2, '#a9b8c0');
  pixel(-5, -3, 3, 3, '#67e5df');
  pixel(4, -3, 3, 3, '#67e5df');
  pixel(-10, 0, 3, 3, '#d3a66b');
  pixel(-4, 0, 3, 3, '#d3a66b');
  pixel(2, 0, 3, 3, '#d3a66b');
  pixel(7, 0, 3, 3, '#d3a66b');
  const frontLift = Math.round(step * 2);
  const backLift = Math.round(-step * 2);
  pixel(-9, 1 + frontLift, 4, 7 - frontLift, '#75869a');
  pixel(-7, 7 + frontLift, 5, 2, '#d9c39f');
  pixel(3, 1 + backLift, 4, 7 - backLift, '#75869a');
  pixel(4, 7 + backLift, 5, 2, '#d9c39f');
  pixel(-15, 1 + backLift, 4, 7 - backLift, '#53647c');
  pixel(-15, 7 + backLift, 5, 2, '#d9c39f');
  pixel(9, 1 + frontLift, 4, 7 - frontLift, '#53647c');
  pixel(9, 7 + frontLift, 5, 2, '#d9c39f');
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
    drawPixelDog(time);
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
  const focusTarget = panel === storyPanel
    ? panel.querySelector('.story-pane:not([hidden]) h2')
    : panel?.querySelector('h2, button, a');
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
  if (heldKeys.size) {
    let dx = Number(heldKeys.has('d') || heldKeys.has('arrowright')) - Number(heldKeys.has('a') || heldKeys.has('arrowleft'));
    let dy = Number(heldKeys.has('s') || heldKeys.has('arrowdown')) - Number(heldKeys.has('w') || heldKeys.has('arrowup'));
    if (dx || dy) {
      const magnitude = Math.hypot(dx, dy);
      dx = dx / magnitude * elapsed * 0.24;
      dy = dy / magnitude * elapsed * 0.24;
      const nx = player.x + dx, ny = player.y + dy;
      if (pointInPolygon(nx, ny)) {
        player.x = nx; player.y = ny; player.facing = dx ? Math.sign(dx) : player.facing;
        player.moving = true; currentPath = [];
      } else setStatus('The dog stays on walkable streets. Use the map for a direct visit.');
    }
  } else if (pathIndex < currentPath.length) {
    const [tx, ty] = currentPath[pathIndex];
    const dx = tx - player.x, dy = ty - player.y;
    const distance = Math.hypot(dx, dy);
    const travel = elapsed * 0.21;
    if (distance <= travel + 0.001) {
      player.x = tx; player.y = ty; pathIndex += 1;
    } else {
      player.x += dx / distance * travel; player.y += dy / distance * travel;
    }
    if (dx) player.facing = Math.sign(dx);
    player.moving = true;
  } else player.moving = false;
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
  if (player.moving) walkTime += elapsed;
  draw(time);
  if (player.moving && pathIndex >= currentPath.length && !heldKeys.size) player.moving = false;
  if (player.moving || heldKeys.size) frameHandle = requestAnimationFrame(animate);
}

function startAnimation() {
  if (!frameHandle) frameHandle = requestAnimationFrame(animate);
}

if (canvas && context) {
  image.onload = () => {
    imageReady = image.naturalWidth > 0 && image.naturalHeight > 0;
    if (!imageReady) return;
    updateView();
    if (fallback) fallback.hidden = true;
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
}
