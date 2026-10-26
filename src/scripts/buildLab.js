const canvas = document.querySelector('#build-scene');
const status = document.querySelector('#scene-status');
const fallback = document.querySelector('#webgl-fallback');
const storyPanes = [...document.querySelectorAll('[data-pane]')];
const portalButtons = [...document.querySelectorAll('[data-stop]')];
const storyKicker = document.querySelector('#story-kicker');
const storyPanel = document.querySelector('#story-panel');
const closeStoryButton = document.querySelector('#close-story-panel');
const careerOverlay = document.querySelector('#career-overlay');
const mapOverlay = document.querySelector('#workshop-map');
const overlayScrim = document.querySelector('.overlay-scrim');
const overlayTriggers = [...document.querySelectorAll('[data-overlay]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const stops = {
  agents: { x: -3.35, z: -2.55, label: 'Agent Workbench', kicker: '01 / AI systems' },
  product: { x: 3.35, z: -2.55, label: 'Product Studio', kicker: '02 / product engineering' },
  engineering: { x: 3.35, z: 2.55, label: 'Engineering & Research', kicker: '03 / research & delivery' },
  community: { x: -3.35, z: 2.55, label: 'Community & Leadership', kicker: '04 / leadership' },
};

const player = { x: 0, z: 0.8, targetX: 0, targetZ: 0.8 };
const heldKeys = new Set();
let activeStop = 'agents';
let lastStoryTrigger = null;
let overlayTrigger = null;
let scheduleDraw = () => {};

function setStatus(message) {
  if (status && status.textContent !== message) status.textContent = message;
}

function selectStop(id, { focusPanel = false, trigger = null } = {}) {
  const stop = stops[id];
  if (!stop) return;

  activeStop = id;
  if (trigger) lastStoryTrigger = trigger;
  if (mapOverlay) {
    mapOverlay.hidden = true;
    mapOverlay.removeAttribute('aria-modal');
  }
  if (careerOverlay) {
    careerOverlay.hidden = true;
    careerOverlay.removeAttribute('aria-modal');
  }
  if (storyPanel) storyPanel.hidden = false;
  storyPanel?.setAttribute('role', 'dialog');
  storyPanel?.setAttribute('aria-modal', 'true');
  storyPanes.forEach((pane) => {
    pane.hidden = pane.dataset.pane !== id;
  });
  portalButtons.forEach((button) => {
    const selected = button.dataset.stop === id;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-expanded', String(selected));
  });
  if (storyKicker) storyKicker.textContent = stop.kicker;
  player.targetX = stop.x;
  player.targetZ = stop.z;
  setStatus(`${stop.label} selected. Story panel opened.`);
  updateOverlayScrim();
  scheduleDraw();
  if (focusPanel) {
    requestAnimationFrame(() => {
      document.querySelector(`[data-pane="${id}"] h2`)?.focus({ preventScroll: true });
    });
  }
}

portalButtons.forEach((button) => {
  button.setAttribute('aria-expanded', String(button.getAttribute('aria-pressed') === 'true'));
  button.addEventListener('click', () => selectStop(button.dataset.stop, { focusPanel: true, trigger: button }));
});

function closeStoryPanel() {
  if (!storyPanel || storyPanel.hidden) return;
  storyPanel.hidden = true;
  storyPanel.removeAttribute('aria-modal');
  updateOverlayScrim();
  if (lastStoryTrigger?.getClientRects().length) lastStoryTrigger.focus({ preventScroll: true });
  else (document.querySelector('[data-overlay="map"]') || canvas)?.focus({ preventScroll: true });
}

closeStoryButton?.addEventListener('click', closeStoryPanel);

function updateOverlayScrim() {
  const isOpen = [storyPanel, careerOverlay, mapOverlay].some((panel) => panel && !panel.hidden);
  if (overlayScrim) overlayScrim.hidden = !isOpen;
  document.querySelector('.build-scene-card')?.toggleAttribute('inert', isOpen);
  document.querySelector('.game-hud')?.toggleAttribute('inert', isOpen);
  if (isOpen) heldKeys.clear();
}

function keepFocusInDialog(event, dialog) {
  if (event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.getClientRects().length);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openOverlay(name, trigger) {
  overlayTrigger = trigger;
  if (careerOverlay) careerOverlay.hidden = name !== 'career';
  if (mapOverlay) mapOverlay.hidden = name !== 'map';
  if (storyPanel) {
    storyPanel.hidden = true;
    storyPanel.removeAttribute('aria-modal');
  }
  const target = name === 'career' ? careerOverlay : mapOverlay;
  target?.setAttribute('role', 'dialog');
  target?.setAttribute('aria-modal', 'true');
  updateOverlayScrim();
  target?.querySelector('h2, button, a')?.focus({ preventScroll: true });
}

function closeOverlay() {
  const active = [careerOverlay, mapOverlay, storyPanel].find((node) => node && !node.hidden);
  if (!active) return;
  if (active === storyPanel) {
    closeStoryPanel();
    return;
  }
  active.hidden = true;
  active.removeAttribute('aria-modal');
  updateOverlayScrim();
  overlayTrigger?.focus({ preventScroll: true });
}

overlayTriggers.forEach((button) => {
  button.addEventListener('click', () => openOverlay(button.dataset.overlay, button));
});
overlayScrim?.addEventListener('click', closeOverlay);
document.querySelectorAll('[data-overlay-close]').forEach((button) => {
  button.addEventListener('click', closeOverlay);
});
storyPanel?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeStoryPanel();
  else keepFocusInDialog(event, storyPanel);
});
careerOverlay?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeOverlay();
  else keepFocusInDialog(event, careerOverlay);
});
mapOverlay?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeOverlay();
  else keepFocusInDialog(event, mapOverlay);
});
storyPanel && (storyPanel.hidden = true);
updateOverlayScrim();

document.querySelectorAll('[data-move]').forEach((button) => {
  button.addEventListener('click', () => {
    const amount = 0.9;
    const direction = button.dataset.move;
    if (direction === 'forward') player.targetZ -= amount;
    if (direction === 'back') player.targetZ += amount;
    if (direction === 'left') player.targetX -= amount;
    if (direction === 'right') player.targetX += amount;
    player.targetX = Math.max(-5.4, Math.min(5.4, player.targetX));
    player.targetZ = Math.max(-4.2, Math.min(4.2, player.targetZ));
    setStatus('Move toward a portal, then press Enter—or choose a destination from the map.');
    scheduleDraw();
  });
});

function nearestStop() {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const [id, stop] of Object.entries(stops)) {
    const distance = Math.hypot(player.x - stop.x, player.z - stop.z);
    if (distance < nearestDistance) {
      nearest = id;
      nearestDistance = distance;
    }
  }
  return nearestDistance < 1.65 ? nearest : null;
}

function isTextEntryTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

window.addEventListener('keydown', (event) => {
  if (isTextEntryTarget(event.target)) return;
  if (event.key === 'Escape' && storyPanel && !storyPanel.hidden) {
    event.preventDefault();
    closeStoryPanel();
    return;
  }
  if (event.key === 'Escape' && ((careerOverlay && !careerOverlay.hidden) || (mapOverlay && !mapOverlay.hidden))) {
    event.preventDefault();
    closeOverlay();
    return;
  }
  if (event.key.toLowerCase() === 'm' && !event.repeat) {
    const mapButton = document.querySelector('[data-overlay="map"]');
    openOverlay('map', mapButton);
    return;
  }
  if (document.activeElement !== canvas) return;
  const key = event.key.toLowerCase();
  const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'];
  if (movementKeys.includes(key)) {
    event.preventDefault();
    heldKeys.add(key);
    scheduleDraw();
  }
  if ((key === 'enter' || key === 'e') && !event.repeat) {
    const stop = nearestStop();
    if (stop) selectStop(stop, { focusPanel: true, trigger: canvas });
    else setStatus('Walk closer to an exhibit, or choose any destination from the map.');
  }
});

window.addEventListener('keyup', (event) => heldKeys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => heldKeys.clear());

const gl = canvas?.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'low-power' });
canvas?.addEventListener('click', () => canvas.focus({ preventScroll: true }));
canvas?.addEventListener('blur', () => heldKeys.clear());

if (!canvas || !gl) {
  if (fallback) fallback.hidden = false;
  setStatus('3D is unavailable here; use the Map and Career Path controls to explore the portfolio.');
} else {
  try {
    startWorld(gl, canvas);
    document.documentElement.classList.add('build-lab-ready');
  } catch (error) {
    console.error('Build Lab 3D setup failed:', error);
    if (fallback) fallback.hidden = false;
    setStatus('3D could not start in this browser; use the Map and Career Path controls for every detail.');
  }
}

function startWorld(context, sceneCanvas) {
  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform mat4 uViewProjection;
    varying vec3 vColor;
    varying vec3 vWorldPosition;
    void main() {
      gl_Position = uViewProjection * vec4(aPosition, 1.0);
      vColor = aColor;
      vWorldPosition = aPosition;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec3 vColor;
    varying vec3 vWorldPosition;
    void main() {
      float windowLight = max(0.0, 1.0 - length(vWorldPosition.xz - vec2(4.4, -2.6)) * 0.16);
      float warmFill = max(0.0, 1.0 - length(vWorldPosition.xz - vec2(-3.6, -2.7)) * 0.11);
      vec3 color = vColor * (0.91 + windowLight * 0.11 + warmFill * 0.035);
      color += vec3(0.075, 0.031, 0.012) * windowLight;
      gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
    }
  `;
  const textureVertexSource = `
    attribute vec3 aPosition;
    attribute vec2 aTexCoord;
    uniform mat4 uViewProjection;
    varying vec2 vTexCoord;
    void main() {
      gl_Position = uViewProjection * vec4(aPosition, 1.0);
      vTexCoord = aTexCoord;
    }
  `;
  const textureFragmentSource = `
    precision mediump float;
    uniform sampler2D uTexture;
    varying vec2 vTexCoord;
    void main() {
      gl_FragColor = texture2D(uTexture, vTexCoord);
    }
  `;

  const program = createProgram(context, vertexSource, fragmentSource);
  const positionLocation = context.getAttribLocation(program, 'aPosition');
  const colorLocation = context.getAttribLocation(program, 'aColor');
  const matrixLocation = context.getUniformLocation(program, 'uViewProjection');
  const textureProgram = createProgram(context, textureVertexSource, textureFragmentSource);
  const texturePositionLocation = context.getAttribLocation(textureProgram, 'aPosition');
  const textureCoordinateLocation = context.getAttribLocation(textureProgram, 'aTexCoord');
  const textureMatrixLocation = context.getUniformLocation(textureProgram, 'uViewProjection');
  const textureSamplerLocation = context.getUniformLocation(textureProgram, 'uTexture');
  const worldData = [];

  buildWorld(worldData);

  const worldBuffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, worldBuffer);
  context.bufferData(context.ARRAY_BUFFER, new Float32Array(worldData), context.STATIC_DRAW);
  const worldVertexCount = worldData.length / 6;
  const playerBuffer = context.createBuffer();
  const faceBuffer = context.createBuffer();
  const faceTexture = context.createTexture();
  let faceTextureReady = false;

  if (faceTexture) {
    const faceImage = new Image();
    faceImage.onload = () => {
      context.bindTexture(context.TEXTURE_2D, faceTexture);
      context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
      context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, faceImage);
      faceTextureReady = true;
      scheduleDraw();
    };
    faceImage.onerror = () => console.warn('Pixel portrait could not be loaded; using the default avatar face.');
    faceImage.src = '/images/gaetano-avatar-pixel.png';
  }

  context.enable(context.DEPTH_TEST);
  context.depthFunc(context.LEQUAL);
  context.disable(context.CULL_FACE);
  context.useProgram(program);

  let viewProjection = new Float32Array(16);
  let lastFrame = 0;
  let frameHandle = 0;
  let cameraPanX = 0;
  let cameraPanZ = 0;
  let zoom = 1;
  let dragOrigin = null;

  function resize() {
    const bounds = sceneCanvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5) * 0.74;
    const width = Math.max(1, Math.floor(bounds.width * ratio));
    const height = Math.max(1, Math.floor(bounds.height * ratio));
    if (sceneCanvas.width !== width || sceneCanvas.height !== height) {
      sceneCanvas.width = width;
      sceneCanvas.height = height;
      context.viewport(0, 0, width, height);
    }
    const aspect = width / height;
    const compactViewport = aspect < 1.05;
    // Fit the complete room bounds, not just its floor, at desktop sizes.
    const baseView = lookAt([10, 13.5, 10], [0, 1.5, 0], [0, 1, 0]);
    const projected = [];
    for (const x of [-6.3, 6.4]) for (const y of [-0.8, 4.9]) for (const z of [-4.8, 4.8]) {
      projected.push([
        baseView[0] * x + baseView[4] * y + baseView[8] * z + baseView[12],
        baseView[1] * x + baseView[5] * y + baseView[9] * z + baseView[13],
      ]);
    }
    const minX = Math.min(...projected.map((p) => p[0]));
    const maxX = Math.max(...projected.map((p) => p[0]));
    const minY = Math.min(...projected.map((p) => p[1]));
    const maxY = Math.max(...projected.map((p) => p[1]));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const halfHeight = (compactViewport ? 6.65 : Math.max((maxY - minY) / 2 + 0.45, ((maxX - minX) / 2 + 0.45) / aspect)) / zoom;
    const halfWidth = halfHeight * aspect;
    const target = [cameraPanX, 1.5, cameraPanZ];
    const projection = orthographic(centerX - halfWidth, centerX + halfWidth, centerY - halfHeight, centerY + halfHeight, -25, 50);
    const view = lookAt([target[0] + 10, target[1] + 12, target[2] + 10], target, [0, 1, 0]);
    viewProjection = multiply(projection, view);
    positionSceneLabels(bounds);
  }

  function positionSceneLabels(bounds) {
    const labelPoints = {
      agents: [-3.45, 3.35, -2.15],
      product: [3.42, 3.3, -2.35],
      engineering: [3.55, 1.95, 0.55],
      community: [-3.72, 1.28, 2.1],
    };
    for (const [id, point] of Object.entries(labelPoints)) {
      const label = document.querySelector(`.scene-label[data-stop="${id}"]`);
      if (!label) continue;
      const projected = projectPoint(viewProjection, point);
      const x = (projected[0] * 0.5 + 0.5) * bounds.width;
      const y = (0.5 - projected[1] * 0.5) * bounds.height;
      label.style.left = `${Math.max(8, Math.min(bounds.width - label.offsetWidth - 8, x - label.offsetWidth / 2))}px`;
      const reservedBottom = window.innerWidth < 700 ? 150 : 80;
      label.style.top = `${Math.max(52, Math.min(bounds.height - label.offsetHeight - reservedBottom, y - label.offsetHeight - 12))}px`;
      label.style.right = 'auto';
      label.style.bottom = 'auto';
    }
  }

  sceneCanvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragOrigin = { x: event.clientX, y: event.clientY, panX: cameraPanX, panZ: cameraPanZ };
    sceneCanvas.setPointerCapture(event.pointerId);
  });
  sceneCanvas.addEventListener('pointermove', (event) => {
    if (!dragOrigin || !sceneCanvas.hasPointerCapture(event.pointerId)) return;
    const bounds = sceneCanvas.getBoundingClientRect();
    const aspect = bounds.width / Math.max(bounds.height, 1);
    const verticalScale = (aspect < 1.05 ? 13.3 : 10.1) / zoom;
    const scale = verticalScale / Math.max(bounds.height, 1);
    cameraPanX = Math.max(-5.5, Math.min(5.5, dragOrigin.panX - (event.clientX - dragOrigin.x) * scale));
    cameraPanZ = Math.max(-5.5, Math.min(5.5, dragOrigin.panZ + (event.clientY - dragOrigin.y) * scale));
    resize();
    scheduleDraw();
  });
  const endPan = (event) => {
    dragOrigin = null;
    if (sceneCanvas.hasPointerCapture(event.pointerId)) sceneCanvas.releasePointerCapture(event.pointerId);
  };
  sceneCanvas.addEventListener('pointerup', endPan);
  sceneCanvas.addEventListener('pointercancel', endPan);
  sceneCanvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoom = Math.max(0.78, Math.min(1.8, zoom + (event.deltaY < 0 ? 0.08 : -0.08)));
    resize();
    scheduleDraw();
  }, { passive: false });

  function bindAttributes(buffer) {
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.enableVertexAttribArray(positionLocation);
    context.vertexAttribPointer(positionLocation, 3, context.FLOAT, false, 24, 0);
    context.enableVertexAttribArray(colorLocation);
    context.vertexAttribPointer(colorLocation, 3, context.FLOAT, false, 24, 12);
  }

  function frame(time) {
    frameHandle = 0;
    const elapsed = Math.min((time - lastFrame) / 1000 || 0, 0.05);
    lastFrame = time;
    resize();

    const step = (key, amount) => {
      if (heldKeys.has(key)) player.targetZ += amount * elapsed;
    };
    step('w', -3.2);
    step('arrowup', -3.2);
    step('s', 3.2);
    step('arrowdown', 3.2);
    if (heldKeys.has('a') || heldKeys.has('arrowleft')) player.targetX -= 3.2 * elapsed;
    if (heldKeys.has('d') || heldKeys.has('arrowright')) player.targetX += 3.2 * elapsed;
    player.targetX = Math.max(-5.4, Math.min(5.4, player.targetX));
    player.targetZ = Math.max(-4.2, Math.min(4.2, player.targetZ));

    const ease = reducedMotion ? 1 : Math.min(1, elapsed * 7);
    player.x += (player.targetX - player.x) * ease;
    player.z += (player.targetZ - player.z) * ease;

    context.clearColor(0.129, 0.114, 0.094, 1);
    context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
    context.useProgram(program);
    context.uniformMatrix4fv(matrixLocation, false, viewProjection);
    bindAttributes(worldBuffer);
    context.drawArrays(context.TRIANGLES, 0, worldVertexCount);

    const ambientData = [];
    buildAmbientProps(ambientData, time);
    context.bindBuffer(context.ARRAY_BUFFER, playerBuffer);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array(ambientData), context.DYNAMIC_DRAW);
    bindAttributes(playerBuffer);
    context.drawArrays(context.TRIANGLES, 0, ambientData.length / 6);

    const figureData = [];
    buildAvatar(figureData, player.x, player.z);
    context.bindBuffer(context.ARRAY_BUFFER, playerBuffer);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array(figureData), context.DYNAMIC_DRAW);
    bindAttributes(playerBuffer);
    context.drawArrays(context.TRIANGLES, 0, figureData.length / 6);

    if (faceTextureReady) {
      const faceData = buildAvatarFace(player.x, player.z);
      context.useProgram(textureProgram);
      context.uniformMatrix4fv(textureMatrixLocation, false, viewProjection);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, faceTexture);
      context.uniform1i(textureSamplerLocation, 0);
      context.bindBuffer(context.ARRAY_BUFFER, faceBuffer);
      context.bufferData(context.ARRAY_BUFFER, faceData, context.DYNAMIC_DRAW);
      context.enableVertexAttribArray(texturePositionLocation);
      context.vertexAttribPointer(texturePositionLocation, 3, context.FLOAT, false, 20, 0);
      context.enableVertexAttribArray(textureCoordinateLocation);
      context.vertexAttribPointer(textureCoordinateLocation, 2, context.FLOAT, false, 20, 12);
      context.enable(context.BLEND);
      context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
      context.depthMask(false);
      context.drawArrays(context.TRIANGLES, 0, 6);
      context.depthMask(true);
      context.disable(context.BLEND);
    }

    const nearby = nearestStop();
    if (nearby) {
      setStatus(`${stops[nearby].label} is nearby. Press Enter to open, or use the map.`);
    } else if (!heldKeys.size) {
      setStatus('Walk toward a portal and press Enter, or choose any destination from the map.');
    }
    const stillMoving = heldKeys.size > 0 ||
      Math.abs(player.targetX - player.x) > 0.01 ||
      Math.abs(player.targetZ - player.z) > 0.01;
    if (stillMoving) scheduleDraw();
    else if (!reducedMotion) window.setTimeout(scheduleDraw, 120);
  }

  scheduleDraw = () => {
    if (!frameHandle) frameHandle = window.requestAnimationFrame(frame);
  };
  window.addEventListener('resize', scheduleDraw, { passive: true });
  resize();
  scheduleDraw();
}

function createProgram(glContext, vertexSource, fragmentSource) {
  const compile = (type, source) => {
    const shader = glContext.createShader(type);
    glContext.shaderSource(shader, source);
    glContext.compileShader(shader);
    if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
      const message = glContext.getShaderInfoLog(shader);
      glContext.deleteShader(shader);
      throw new Error(message || 'Shader compilation failed');
    }
    return shader;
  };

  const vertex = compile(glContext.VERTEX_SHADER, vertexSource);
  const fragment = compile(glContext.FRAGMENT_SHADER, fragmentSource);
  const linked = glContext.createProgram();
  glContext.attachShader(linked, vertex);
  glContext.attachShader(linked, fragment);
  glContext.linkProgram(linked);
  if (!glContext.getProgramParameter(linked, glContext.LINK_STATUS)) {
    const message = glContext.getProgramInfoLog(linked);
    glContext.deleteProgram(linked);
    throw new Error(message || 'Shader linking failed');
  }
  return linked;
}

function buildWorld(vertices) {
  const stone = [0.87, 0.69, 0.53], mortar = [0.38, 0.27, 0.2];
  const plaster = [0.92, 0.74, 0.56], timber = [0.33, 0.19, 0.12];
  const oak = [0.61, 0.34, 0.17], honey = [0.86, 0.56, 0.31];
  const leaf = [0.21, 0.30, 0.19], leafLight = [0.38, 0.51, 0.22];
  const teal = [0.12, 0.43, 0.39], ink = [0.11, 0.13, 0.12];
  const cream = [0.96, 0.84, 0.61], red = [0.65, 0.22, 0.12];

  // Honey-oak planked floor and dark cutaway masonry foundation.
  addBox(vertices, 0, -0.38, 0, 12.2, 0.72, 9.45, [0.20, 0.14, 0.10]);
  addBox(vertices, 0, -0.015, 0, 11.85, 0.09, 9.12, [0.44, 0.25, 0.14]);
  const floorTones = [[0.60, 0.34, 0.18], [0.72, 0.42, 0.22], [0.63, 0.35, 0.18], [0.79, 0.48, 0.26], [0.67, 0.38, 0.2]];
  let plankRow = 0;
  for (let z = -4.42; z <= 4.3; z += 0.29, plankRow += 1) {
    const offset = plankRow % 2 ? -0.55 : 0;
    for (let x = -5.42 + offset; x < 5.6; x += 1.12) {
      addBox(vertices, x + 0.53, 0.039, z, 1.08, 0.025, 0.265, floorTones[(Math.abs(plankRow + Math.round(x * 3)) % floorTones.length)]);
      addBox(vertices, x + 0.53, 0.055, z + 0.13, 1.08, 0.009, 0.012, [0.37, 0.2, 0.11]);
    }
  }

  // Brickwork shell: individually laid cream blocks, deep seams, and oak framing.
  addBox(vertices, 0, 2.28, -4.55, 12.05, 4.65, 0.36, mortar);
  const brickTones = [[0.82, 0.63, 0.47], [0.91, 0.73, 0.56], [0.76, 0.57, 0.42], [0.88, 0.68, 0.51], [0.95, 0.78, 0.61]];
  for (let row = 0; row < 13; row += 1) {
    const y = 0.13 + row * 0.36;
    for (let x = -5.82 + (row % 2) * 0.45; x < 5.98; x += 0.9) {
      const tone = brickTones[(row * 3 + Math.round((x + 6) * 2)) % brickTones.length];
      addBox(vertices, x, y + 0.16, -4.335, 0.86, 0.32, 0.10, tone);
      addBox(vertices, x - 0.18, y + 0.17, -4.278, 0.28, 0.012, 0.012, [0.97, 0.82, 0.67]);
    }
  }
  addBox(vertices, 0, 4.62, -4.31, 12.18, 0.19, 0.42, timber);
  addBox(vertices, 0, 0.2, -4.28, 12.08, 0.22, 0.4, oak);
  addBox(vertices, -5.85, 2.28, 0, 0.36, 4.65, 9.25, mortar);
  for (let row = 0; row < 13; row += 1) {
    for (let z = -4.08 + (row % 2) * 0.38; z < 4.35; z += 0.76) {
      const tone = brickTones[(row + Math.floor((z + 4.2) * 3)) % brickTones.length];
      addBox(vertices, -5.625, 0.24 + row * 0.37, z, 0.11, 0.33, 0.72, tone);
      addBox(vertices, -5.564, 0.25 + row * 0.37, z - 0.19, 0.012, 0.014, 0.22, [0.97, 0.82, 0.67]);
    }
  }
  for (const x of [-5.55, -2.8, 0, 2.8, 5.55]) {
    addBox(vertices, x, 2.3, -4.25, 0.18, 4.6, 0.2, timber);
  }

  // Broad right-hand mullioned window with warm daylight panes.
  addBox(vertices, 3.95, 3.15, -4.15, 3.0, 2.35, 0.17, timber);
  addBox(vertices, 3.95, 3.15, -4.04, 2.76, 2.11, 0.055, [0.96, 0.76, 0.48]);
  for (const x of [2.57, 3.26, 3.95, 4.64, 5.33]) {
    addBox(vertices, x, 3.15, -3.99, 0.065, 2.18, 0.09, timber);
  }
  for (const y of [2.08, 3.15, 4.22]) addBox(vertices, 3.95, y, -3.98, 2.85, 0.07, 0.1, timber);
  addBox(vertices, 3.95, 2.0, -3.94, 3.16, 0.14, 0.42, oak);

  // Two small, distinct upper rooms instead of a single empty mezzanine slab.
  // The left balcony is a real work loft with a desk, pinned sketches and rail.
  addBox(vertices, -3.25, 2.08, -2.38, 3.55, 0.2, 2.6, timber);
  addBox(vertices, -3.25, 2.2, -2.38, 3.4, 0.05, 2.44, honey);
  for (const x of [-4.8, -3.9, -3.0, -2.1]) {
    addBox(vertices, x, 2.66, -1.05, 0.09, 0.82, 0.09, timber);
    addBox(vertices, x, 3.06, -1.05, 0.1, 0.07, 0.1, honey);
  }
  addBox(vertices, -3.45, 3.08, -1.05, 3.2, 0.12, 0.13, oak);
  addBox(vertices, -3.55, 2.67, -3.48, 2.05, 0.14, 0.72, oak);
  for (const x of [-4.35, -2.78]) for (const z of [-3.72, -3.24]) {
    addBox(vertices, x, 2.42, z, 0.12, 0.52, 0.12, timber);
  }
  for (const x of [-4.05, -3.1]) {
    addBox(vertices, x, 3.08, -3.52, 0.55, 0.48, 0.075, ink);
    addBox(vertices, x, 3.09, -3.47, 0.45, 0.36, 0.025, teal);
    for (let i = 0; i < 3; i += 1) addBox(vertices, x - 0.13 + i * 0.12, 3.08 + i * 0.07, -3.44, 0.07, 0.018, 0.015, [0.62, 0.79, 0.53]);
  }
  for (const [x, color] of [[-4.38, [0.78, 0.34, 0.18]], [-3.54, [0.87, 0.68, 0.43]], [-2.72, [0.41, 0.56, 0.38]]]) {
    addBox(vertices, x, 2.9, -1.94, 0.35, 0.25, 0.025, color, -0.08);
  }

  // A compact right reading nook: bookcase, tea table, chair, and leafy planter.
  addBox(vertices, 2.8, 2.08, -2.33, 3.1, 0.2, 2.35, timber);
  addBox(vertices, 2.8, 2.2, -2.33, 2.94, 0.05, 2.2, honey);
  for (const x of [1.55, 2.8, 4.05]) {
    addBox(vertices, x, 2.66, -1.23, 0.09, 0.82, 0.09, timber);
    addBox(vertices, x, 3.06, -1.23, 0.1, 0.07, 0.1, honey);
  }
  addBox(vertices, 2.8, 3.08, -1.23, 2.65, 0.12, 0.13, oak);
  addBookshelf(vertices, 1.55, 2.28, -4.12, 1.25, 1.75, oak);
  addBox(vertices, 2.2, 2.45, -2.25, 0.78, 0.12, 0.55, oak);
  addBox(vertices, 2.2, 2.76, -2.25, 0.1, 0.55, 0.1, timber);
  addBox(vertices, 2.2, 3.04, -2.25, 0.56, 0.08, 0.38, honey);
  addBox(vertices, 1.8, 2.48, -2.75, 0.46, 0.16, 0.44, [0.49, 0.23, 0.16]);
  addBox(vertices, 1.8, 2.88, -2.94, 0.46, 0.62, 0.14, [0.49, 0.23, 0.16]);
  addBox(vertices, 4.05, 2.35, -2.03, 0.42, 0.28, 0.42, [0.49, 0.26, 0.16]);
  addBox(vertices, 4.05, 2.55, -2.03, 0.44, 0.08, 0.44, honey);
  for (let i = 0; i < 8; i += 1) {
    addBox(vertices, 3.78 + (i % 4) * 0.17, 2.91 + Math.floor(i / 4) * 0.16, -2.19 + (i % 2) * 0.22, 0.24, 0.2, 0.22, i % 3 ? leaf : leafLight);
  }

  // A short plaster divider anchors the central project board and breaks up
  // the tall rear wall like the stepped masonry in the reference workshop.
  addBox(vertices, 0.15, 1.08, -0.72, 2.75, 2.12, 0.34, plaster);
  addBox(vertices, 0.15, 2.18, -0.72, 2.92, 0.15, 0.44, oak);
  addBox(vertices, 0.15, 1.62, -0.525, 1.72, 1.0, 0.055, timber);
  addBox(vertices, 0.15, 1.62, -0.49, 1.53, 0.82, 0.025, [0.26, 0.36, 0.27]);
  for (let x = -0.52; x <= 0.82; x += 0.32) {
    const shades = [[0.9, 0.72, 0.47], [0.68, 0.35, 0.21], [0.8, 0.79, 0.64], [0.39, 0.55, 0.43]];
    addBox(vertices, x, 1.7 + ((Math.round(x * 10) & 1) * 0.08), -0.465, 0.19, 0.23, 0.025, shades[Math.abs(Math.round(x * 10)) % shades.length]);
    addBox(vertices, x, 1.52, -0.462, 0.12, 0.025, 0.02, [0.93, 0.84, 0.65]);
  }
  addBox(vertices, -1.05, 1.35, -0.49, 0.07, 0.11, 0.03, [0.77, 0.25, 0.13]);
  addBox(vertices, 1.0, 1.88, -0.49, 0.07, 0.11, 0.03, [0.77, 0.25, 0.13]);
  addVoxelTree(vertices, -0.95, -2.55);
  // Right-side stairs rise to the balcony.
  for (let step = 0; step < 9; step += 1) {
    addBox(vertices, 4.42, 0.17 + step * 0.25, 3.45 - step * 0.42, 1.32, 0.2, 0.64, oak);
    addBox(vertices, 4.42, 0.28 + step * 0.25, 3.42 - step * 0.42, 1.35, 0.045, 0.66, honey);
    for (const x of [3.72, 5.08]) addBox(vertices, x, 0.53 + step * 0.25, 3.42 - step * 0.42, 0.09, 0.54, 0.09, timber);
  }
  addBox(vertices, 3.72, 1.55, 1.55, 0.12, 0.12, 4.05, oak, 0, 0.55);
  addBox(vertices, 5.08, 1.55, 1.55, 0.12, 0.12, 4.05, oak, 0, 0.55);

  // Long continuous left-hand workshop bench, crowded with useful tools.
  addBox(vertices, -3.52, 0.93, -2.4, 3.25, 0.17, 0.82, oak);
  for (const x of [-4.8, -3.6, -2.35]) {
    for (const z of [-2.68, -2.12]) addBox(vertices, x, 0.47, z, 0.14, 0.88, 0.14, timber);
  }
  for (const x of [-4.15, -3.15]) {
    addBox(vertices, x, 1.38, -2.74, 0.84, 0.65, 0.09, ink);
    addBox(vertices, x, 1.39, -2.68, 0.7, 0.48, 0.035, teal);
    for (let row = 0; row < 3; row += 1) addBox(vertices, x - 0.13 + row * 0.13, 1.39 + row * 0.08, -2.65, 0.08, 0.025, 0.02, [0.45, 0.72, 0.56]);
  }
  for (let x = -4.95; x < -2.1; x += 0.32) {
    addBox(vertices, x, 1.05, -2.16, 0.18, 0.12, 0.2, [0.31, 0.24, 0.16]);
    addBox(vertices, x, 1.13, -2.16, 0.1, 0.05, 0.1, honey);
  }
  addBox(vertices, -4.8, 1.08, -2.2, 0.2, 0.18, 0.2, [0.82, 0.42, 0.22]);
  addBox(vertices, -4.8, 1.19, -2.2, 0.11, 0.05, 0.11, [0.91, 0.75, 0.5]);
  addBox(vertices, -2.65, 1.1, -2.18, 0.24, 0.16, 0.22, [0.78, 0.73, 0.61]);
  addBox(vertices, -2.65, 1.21, -2.18, 0.14, 0.035, 0.12, [0.56, 0.28, 0.16]);
  addBox(vertices, -3.68, 1.08, -2.18, 0.38, 0.025, 0.24, [0.93, 0.81, 0.61], 0.05);
  addBox(vertices, -3.62, 1.1, -2.17, 0.23, 0.012, 0.018, red, 0.05);
  addBox(vertices, -2.15, 0.62, -2.28, 0.52, 0.62, 0.54, [0.39, 0.24, 0.15]);
  addBox(vertices, -2.15, 0.96, -2.28, 0.55, 0.12, 0.58, honey);
  // Lower-left bookcases have individually colored, varied-height spines.
  addBookshelf(vertices, -4.3, 0.12, -0.95, 1.25, 2.0, oak);
  addBookshelf(vertices, -2.7, 0.12, -1.05, 1.2, 1.9, timber);
  addBookshelf(vertices, -3.35, 1.1, -4.08, 2.55, 1.65, oak);
  for (const [x, color] of [[-4.1, red], [-3.25, [0.75, 0.65, 0.43]], [-2.4, teal]]) {
    addBox(vertices, x, 2.02, -3.72, 0.56, 0.52, 0.07, timber);
    addBox(vertices, x, 2.02, -3.67, 0.43, 0.39, 0.025, color);
  }

  // Lower-left old timber door and its warm stone arch surround.
  addBox(vertices, -5.39, 1.06, -2.2, 0.12, 2.0, 1.55, timber);
  addBox(vertices, -5.30, 1.06, -2.2, 0.08, 1.67, 1.22, [0.39, 0.22, 0.14]);
  addBox(vertices, -5.24, 1.06, -2.2, 0.035, 1.58, 1.12, [0.55, 0.31, 0.18]);
  for (const z of [-2.84, -1.56]) addBox(vertices, -5.2, 1.08, z, 0.18, 2.1, 0.16, honey);
  addBox(vertices, -5.2, 2.1, -2.2, 0.18, 0.16, 1.42, honey);
  addBox(vertices, -5.12, 0.98, -1.75, 0.05, 0.1, 0.05, [0.93, 0.72, 0.35]);

  // Central drafting table and substantial woven red / green rug.
  addBox(vertices, 0.35, 0.055, 2.7, 3.65, 0.035, 2.3, [0.18, 0.31, 0.2]);
  addBox(vertices, 0.35, 0.08, 2.7, 3.4, 0.018, 2.08, [0.69, 0.44, 0.21]);
  addBox(vertices, 0.35, 0.101, 2.7, 3.0, 0.012, 1.7, [0.47, 0.17, 0.12]);
  for (let x = -1.05; x < 1.75; x += 0.22) addBox(vertices, x, 0.11, 2.7, 0.025, 0.012, 1.6, [0.81, 0.61, 0.34]);
  for (let z = 1.9; z < 3.55; z += 0.22) addBox(vertices, 0.35, 0.112, z, 2.9, 0.012, 0.025, [0.81, 0.61, 0.34]);
  for (const z of [1.62, 3.78]) {
    addBox(vertices, 0.35, 0.12, z, 3.65, 0.025, 0.08, honey);
    for (let x = -1.3; x <= 2.0; x += 0.3) addBox(vertices, x, 0.13, z, 0.075, 0.035, 0.12, [0.91, 0.7, 0.42]);
  }
  for (let x = -1.0; x <= 1.7; x += 0.43) {
    for (let z = 2.08; z <= 3.38; z += 0.42) {
      addBox(vertices, x, 0.125, z, 0.11, 0.025, 0.11, ((Math.round((x + z) * 10) & 1) ? [0.76, 0.42, 0.22] : [0.25, 0.39, 0.26]), Math.PI / 4);
    }
  }
  addBox(vertices, 0.25, 1.03, 0.12, 2.08, 0.16, 1.16, oak, -0.1);
  for (const x of [-0.53, 1.03]) for (const z of [-0.28, 0.52]) addBox(vertices, x, 0.56, z, 0.14, 0.92, 0.14, timber);
  addBox(vertices, 0.15, 1.14, 0.06, 0.86, 0.025, 0.56, cream, -0.1);
  addBox(vertices, 0.78, 1.15, 0.1, 0.43, 0.035, 0.32, [0.17, 0.37, 0.31], -0.1);
  addBox(vertices, 0.13, 1.17, 0.38, 0.36, 0.025, 0.24, [0.91, 0.81, 0.63], 0.08);
  addBox(vertices, 0.22, 1.19, 0.37, 0.19, 0.012, 0.015, [0.68, 0.31, 0.18], 0.08);
  addBox(vertices, -0.26, 1.19, 0.09, 0.13, 0.08, 0.13, [0.75, 0.39, 0.19]);
  addBox(vertices, -0.26, 1.24, 0.09, 0.1, 0.02, 0.1, [0.89, 0.7, 0.41]);
  addBox(vertices, 1.02, 1.26, 0.32, 0.09, 0.28, 0.09, timber);
  addBox(vertices, 1.02, 1.41, 0.32, 0.32, 0.08, 0.28, honey);
  addBox(vertices, 1.02, 1.35, 0.32, 0.22, 0.06, 0.2, [0.97, 0.72, 0.39]);
  for (const [x, z] of [[-0.55, 0.02], [1.0, 0.0], [0.4, 0.55], [-0.15, -0.3]]) {
    addBox(vertices, x, 1.19, z, 0.18, 0.08, 0.12, ink);
    addBox(vertices, x, 1.25, z, 0.1, 0.035, 0.08, honey);
  }

  // Right work station, charcoal server rack, and restrained illuminated screens.
  addWorkbench(vertices, 3.72, 0.12, 1.95, teal, oak, false);
  addBox(vertices, 2.38, 1.04, -0.14, 0.7, 1.9, 0.72, [0.25, 0.24, 0.22]);
  addBox(vertices, 2.38, 1.04, 0.24, 0.48, 1.56, 0.04, [0.12, 0.14, 0.13]);
  for (let y = 0.43; y < 1.8; y += 0.24) {
    addBox(vertices, 2.38, y, 0.27, 0.34, 0.06, 0.025, [0.22, 0.36, 0.31]);
    addBox(vertices, 2.22, y, 0.29, 0.035, 0.035, 0.02, [0.18, 0.64, 0.43]);
    addBox(vertices, 2.49, y, 0.29, 0.035, 0.035, 0.02, [0.82, 0.51, 0.22]);
  }
  addBox(vertices, 2.8, 0.075, 0.15, 1.18, 0.025, 1.05, [0.25, 0.15, 0.1]);
  addBox(vertices, -3.5, 0.072, -2.38, 3.8, 0.02, 1.38, [0.24, 0.14, 0.09]);
  addBox(vertices, 0.25, 0.072, 0.12, 2.36, 0.02, 1.43, [0.24, 0.14, 0.09]);
  addBox(vertices, 4.42, 1.84, -4.18, 1.12, 1.03, 0.12, oak);
  addBox(vertices, 4.42, 1.84, -4.1, 0.94, 0.82, 0.035, [0.8, 0.72, 0.58]);
  for (const [x, y, c] of [[4.15, 1.95, red], [4.42, 1.68, leaf], [4.69, 2.0, teal], [4.68, 1.73, honey]]) {
    addBox(vertices, x, y, -4.06, 0.16, 0.12, 0.025, c);
  }

  // Plants, potted herbs and warm hanging lamps make the room inhabited.
  for (const [x, z] of [[-5, -3.1], [-1.5, -3.55], [1.9, -3.55], [3.0, 3.45], [-4.8, 2.95], [1.8, 1.8], [4.85, 0.45]]) {
    addPlant(vertices, x, z, leaf);
    addBox(vertices, x - 0.22, 0.8, z + 0.05, 0.34, 0.16, 0.28, leafLight, 0.5);
    addBox(vertices, x + 0.18, 0.96, z - 0.04, 0.32, 0.14, 0.28, leaf, -0.45);
  }
  for (const [x, z] of [[-3.8, -1.9], [0.3, -3.5], [4.7, -0.25], [1.2, 2.55]]) {
    addBox(vertices, x, 2.78, z, 0.08, 0.7, 0.08, timber);
    addBox(vertices, x, 2.4, z, 0.42, 0.12, 0.42, honey);
    addBox(vertices, x, 2.31, z, 0.3, 0.06, 0.3, cream);
  }
  // A small community table keeps the rear-left gathering corner furnished.
  addCylinder(vertices, -3.75, 0.88, 2.1, 0.68, 0.14, oak, 12);
  for (const [x, z] of [[-4.5, 2.1], [-3, 2.1], [-3.75, 1.25], [-3.75, 2.95]]) {
    addBox(vertices, x, 0.44, z, 0.36, 0.72, 0.36, timber);
    addBox(vertices, x, 0.84, z, 0.56, 0.14, 0.5, honey);
  }

  // Trailing balcony vines, herbs, and desk objects at the finer voxel scale.
  for (const [x, z] of [[-4.7, -1.0], [-3.75, -1.0], [-1.9, -1.0], [1.7, -1.2]]) {
    for (let i = 0; i < 13; i += 1) {
      const y = 2.98 - i * 0.105;
      const sway = Math.sin(i * 1.8) * 0.12;
      addBox(vertices, x + sway, y, z + 0.07, 0.1, 0.15, 0.1, leaf);
      addBox(vertices, x + sway + (i % 2 ? -0.12 : 0.12), y, z + 0.12, 0.16, 0.075, 0.15, i % 3 ? leaf : leafLight);
    }
  }
  for (const [x, z, base] of [[-4.5, -3.4, 2.78], [-2.5, -3.4, 2.78], [2.7, -3.8, 2.1], [4.8, -3.8, 2.1], [3.1, 0.1, 1.02]]) {
    addBox(vertices, x, base + 0.09, z, 0.2, 0.18, 0.2, [0.63, 0.3, 0.14]);
    for (let i = 0; i < 7; i += 1) {
      const a = i * 2.4;
      addBox(vertices, x + Math.cos(a) * 0.13, base + 0.24 + (i % 3) * 0.07, z + Math.sin(a) * 0.12, 0.15, 0.1, 0.13, i % 3 ? leaf : leafLight);
    }
  }
  // Low cutaway masonry edges retain the miniature-room silhouette.
  for (const x of [-5.4, -4.7, -4.0, 3.6, 4.3, 5.0, 5.7]) {
    for (let row = 0; row < 2; row += 1) {
      addBox(vertices, x + row * 0.12, 0.18 + row * 0.32, 4.52, 0.66, 0.3, 0.34, brickTones[(Math.round((x + 6) * 10) + row) % brickTones.length]);
    }
  }
}

function addWorkbench(vertices, x, z, width, screenColor, wood, featured) {
  const depth = featured ? 0.88 : 0.78;
  addBox(vertices, x, 0.9, z, width, 0.16, depth, wood);
  for (const legX of [x - width * 0.4, x + width * 0.4]) {
    for (const legZ of [z - depth * 0.36, z + depth * 0.36]) {
      addBox(vertices, legX, 0.48, legZ, 0.13, 0.8, 0.13, [0.32, 0.23, 0.17]);
    }
  }
  addBox(vertices, x, 1.36, z - depth * 0.31, featured ? 0.78 : 0.64, 0.55, 0.09, [0.19, 0.22, 0.21]);
  addBox(vertices, x, 1.37, z - depth * 0.255, featured ? 0.63 : 0.5, 0.37, 0.035, screenColor);
  addBox(vertices, x, 1.04, z - depth * 0.29, 0.12, 0.22, 0.13, [0.28, 0.31, 0.28]);
  addBox(vertices, x, 0.91, z - depth * 0.23, 0.45, 0.06, 0.28, [0.32, 0.35, 0.3]);
  if (featured) {
    addBox(vertices, x + 0.64, 1.03, z - 0.05, 0.48, 0.1, 0.36, [0.3, 0.33, 0.3]);
    addBox(vertices, x + 0.64, 1.17, z - 0.05, 0.12, 0.2, 0.12, [0.73, 0.55, 0.35]);
  }
}

function addBookshelf(vertices, centerX, baseY, backZ, width, height, wood) {
  const shelfColor = mixColor(wood, [0.86, 0.56, 0.29], 0.28);
  addBox(vertices, centerX, baseY + height / 2, backZ, width, height, 0.18, mixColor(wood, [0.16, 0.1, 0.08], 0.22));
  for (const x of [centerX - width / 2 + 0.07, centerX + width / 2 - 0.07]) {
    addBox(vertices, x, baseY + height / 2, backZ + 0.13, 0.14, height, 0.2, wood);
  }
  const levels = height > 1.8 ? 4 : 3;
  const bookColors = [
    [0.62, 0.23, 0.13], [0.16, 0.31, 0.23], [0.84, 0.59, 0.3],
    [0.32, 0.22, 0.18], [0.72, 0.38, 0.16], [0.43, 0.52, 0.34],
    [0.82, 0.72, 0.53], [0.28, 0.38, 0.38], [0.56, 0.28, 0.19],
  ];
  for (let level = 0; level < levels; level += 1) {
    const shelfY = baseY + (level / levels) * height + 0.08;
    addBox(vertices, centerX, shelfY, backZ + 0.18, width + 0.06, 0.09, 0.42, shelfColor);
    let x = centerX - width / 2 + 0.18;
    const edge = centerX + width / 2 - 0.14;
    let index = level * 7;
    while (x < edge) {
      const bookWidth = 0.12 + ((index * 7) % 4) * 0.025;
      const bookHeight = Math.min(height / levels - 0.13, 0.32 + ((index * 11) % 5) * 0.055);
      const color = bookColors[(index * 3 + level) % bookColors.length];
      addBox(vertices, x + bookWidth / 2, shelfY + 0.045 + bookHeight / 2, backZ + 0.13, bookWidth, bookHeight, 0.27, color);
      addBox(vertices, x + bookWidth / 2, shelfY + 0.045 + bookHeight * 0.25, backZ + 0.272, bookWidth * 0.56, 0.018, 0.014, [0.94, 0.72, 0.43]);
      x += bookWidth + 0.035;
      index += 1;
    }
  }
}

function addVoxelTree(vertices, x, z) {
  const bark = [0.29, 0.18, 0.11];
  const leafTones = [[0.18, 0.30, 0.17], [0.25, 0.38, 0.18], [0.36, 0.49, 0.21], [0.49, 0.56, 0.24], [0.23, 0.34, 0.16]];
  addBox(vertices, x, 1.25, z, 0.42, 2.5, 0.42, bark);
  addBox(vertices, x - 0.18, 2.35, z - 0.08, 0.22, 1.55, 0.2, [0.37, 0.22, 0.12], -0.55);
  addBox(vertices, x + 0.22, 2.65, z + 0.08, 0.2, 1.3, 0.2, [0.37, 0.22, 0.12], 0.55);
  addBox(vertices, x, 2.8, z + 0.2, 0.2, 1.2, 0.2, bark, 0.35);
  for (let layer = 0; layer < 4; layer += 1) {
    const y = 2.72 + layer * 0.31;
    for (let gx = -2; gx <= 2; gx += 1) {
      for (let gz = -2; gz <= 2; gz += 1) {
        if (Math.abs(gx) + Math.abs(gz) > 3 && layer % 2 === 0) continue;
        if (((gx * 5 + gz * 3 + layer * 7) % 7) === 0) continue;
        const size = 0.32 + ((Math.abs(gx + gz + layer) % 2) * 0.045);
        const tone = leafTones[Math.abs(gx * 7 + gz * 3 + layer) % leafTones.length];
        addBox(vertices, x + gx * 0.34, y + ((gx + gz + layer) % 2) * 0.055, z + gz * 0.3, size, size, size, tone);
      }
    }
  }
  // Extra highlight cubes make the canopy read as layered foliage, not a block.
  for (const [dx, dy, dz, color] of [
    [-0.62, 3.55, -0.16, leafTones[3]], [0.55, 3.38, 0.23, leafTones[2]],
    [-0.18, 3.82, 0.44, leafTones[2]], [0.34, 3.72, -0.48, leafTones[3]],
    [-0.48, 3.12, 0.51, leafTones[1]], [0.65, 2.95, -0.2, leafTones[2]],
  ]) addBox(vertices, x + dx, dy, z + dz, 0.3, 0.29, 0.3, color);
}

function addPlant(vertices, x, z, leafColor) {
  const foliage = [leafColor, [0.25, 0.38, 0.2], [0.36, 0.49, 0.23], [0.48, 0.57, 0.27]];
  addBox(vertices, x, 0.2, z, 0.48, 0.34, 0.48, [0.48, 0.27, 0.16]);
  addBox(vertices, x, 0.42, z, 0.5, 0.08, 0.5, [0.75, 0.48, 0.27]);
  addBox(vertices, x, 0.82, z, 0.09, 0.78, 0.09, [0.34, 0.35, 0.18]);
  for (let layer = 0; layer < 2; layer += 1) {
    for (let ix = -1; ix <= 1; ix += 1) {
      for (let iz = -1; iz <= 1; iz += 1) {
        if ((ix === 0 && iz === 0) || (Math.abs(ix) + Math.abs(iz) > 2 && layer === 1)) continue;
        const color = foliage[Math.abs(ix * 3 + iz * 5 + layer) % foliage.length];
        const size = 0.2 + ((ix + iz + layer) & 1) * 0.045;
        addBox(vertices, x + ix * 0.18, 0.98 + layer * 0.22 + ((ix + iz) & 1) * 0.04, z + iz * 0.17, size, size, size, color);
      }
    }
  }
  addBox(vertices, x - 0.25, 0.9, z + 0.08, 0.28, 0.15, 0.18, foliage[2], -0.42);
  addBox(vertices, x + 0.23, 1.11, z - 0.12, 0.28, 0.15, 0.18, foliage[3], 0.42);
}

function buildAmbientProps(vertices, time) {
  const phase = reducedMotion ? 0 : time / 500;
  const centerX = -3.35;
  const centerZ = -2.91;
  const color = [0.83, 0.66, 0.4];
  addBox(vertices, centerX, 1.17, centerZ, 0.11, 0.4, 0.11, [0.29, 0.31, 0.28]);
  addBox(vertices, centerX, 1.37, centerZ, 0.26, 0.07, 0.24, [0.34, 0.36, 0.32]);
  for (let index = 0; index < 4; index += 1) {
    const angle = phase + index * Math.PI / 2;
    addBox(
      vertices,
      centerX + Math.cos(angle) * 0.19,
      1.39,
      centerZ + Math.sin(angle) * 0.19,
      0.31,
      0.055,
      0.1,
      color,
      angle,
    );
  }
  const pulse = reducedMotion ? 0.62 : 0.46 + Math.sin(time / 420) * 0.08;
  addBox(vertices, -2.91, 1.28, -3.0, 0.075, 0.06, 0.05, [0.25, pulse, 0.42]);
}

function buildAvatar(vertices, x, z) {
  const skin = [0.82, 0.58, 0.39];
  const jacket = [0.43, 0.56, 0.42];
  const dark = [0.09, 0.15, 0.2];
  const hair = [0.12, 0.11, 0.13];
  addBox(vertices, x - 0.13, 0.26, z, 0.17, 0.48, 0.2, dark);
  addBox(vertices, x + 0.13, 0.26, z, 0.17, 0.48, 0.2, dark);
  addBox(vertices, x, 0.83, z, 0.52, 0.65, 0.37, jacket);
  addBox(vertices, x - 0.34, 0.82, z, 0.16, 0.48, 0.16, jacket);
  addBox(vertices, x + 0.34, 0.82, z, 0.16, 0.48, 0.16, jacket);
  addBox(vertices, x, 1.43, z, 0.44, 0.43, 0.4, skin);
  addBox(vertices, x, 1.66, z - 0.015, 0.46, 0.16, 0.43, hair);
  addBox(vertices, x, 1.53, z - 0.21, 0.16, 0.08, 0.035, [0.08, 0.12, 0.14]);
  addBox(vertices, x - 0.35, 0.88, z + 0.2, 0.15, 0.46, 0.12, [0.96, 0.68, 0.29]);
}

function buildAvatarFace(x, z) {
  const left = x - 0.2;
  const right = x + 0.2;
  const bottom = 1.23;
  const top = 1.63;
  const front = z + 0.206;
  return new Float32Array([
    left, bottom, front, 0, 0,
    right, bottom, front, 1, 0,
    right, top, front, 1, 1,
    left, bottom, front, 0, 0,
    right, top, front, 1, 1,
    left, top, front, 0, 1,
  ]);
}

function addBox(vertices, cx, cy, cz, width, height, depth, color, rotation = 0, rotationX = 0) {
  const x0 = -width / 2;
  const x1 = width / 2;
  const y0 = -height / 2;
  const y1 = height / 2;
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const faces = [
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
  ];
  const shades = [1, 0.72, 1.12, 0.58, 0.84, 0.68];
  const triangleIndices = [0, 1, 2, 0, 2, 3];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);

  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    for (const cornerIndex of triangleIndices) {
      const [localX, localY, localZ] = faces[faceIndex][cornerIndex];
      const tiltedY = localY * cosX - localZ * sinX;
      const tiltedZ = localY * sinX + localZ * cosX;
      const worldX = cx + localX * cos + tiltedZ * sin;
      const worldZ = cz - localX * sin + tiltedZ * cos;
      const shade = shades[faceIndex];
      vertices.push(
        worldX, cy + tiltedY, worldZ,
        Math.min(1, color[0] * shade),
        Math.min(1, color[1] * shade),
        Math.min(1, color[2] * shade),
      );
    }
  }
}

function addCylinder(vertices, cx, cy, cz, radius, height, color, sides) {
  const bottom = cy;
  const top = cy + height;
  for (let index = 0; index < sides; index += 1) {
    const a1 = (index / sides) * Math.PI * 2;
    const a2 = ((index + 1) / sides) * Math.PI * 2;
    const p1 = [cx + Math.cos(a1) * radius, cz + Math.sin(a1) * radius];
    const p2 = [cx + Math.cos(a2) * radius, cz + Math.sin(a2) * radius];
    pushColoredTriangle(vertices, [cx, top, cz], [p1[0], top, p1[1]], [p2[0], top, p2[1]], color, 1.16);
    pushColoredTriangle(vertices, [cx, bottom, cz], [p2[0], bottom, p2[1]], [p1[0], bottom, p1[1]], color, 0.58);
    pushColoredTriangle(vertices, [p1[0], bottom, p1[1]], [p2[0], bottom, p2[1]], [p2[0], top, p2[1]], color, 0.82);
    pushColoredTriangle(vertices, [p1[0], bottom, p1[1]], [p2[0], top, p2[1]], [p1[0], top, p1[1]], color, 0.82);
  }
}

function pushColoredTriangle(vertices, a, b, c, color, shade) {
  for (const point of [a, b, c]) {
    vertices.push(
      point[0], point[1], point[2],
      Math.min(1, color[0] * shade),
      Math.min(1, color[1] * shade),
      Math.min(1, color[2] * shade),
    );
  }
}

function mixColor(first, second, amount) {
  return first.map((value, index) => value * (1 - amount) + second[index] * amount);
}

function perspective(fieldOfView, aspect, near, far) {
  const f = 1 / Math.tan(fieldOfView / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * range, -1,
    0, 0, 2 * near * far * range, 0,
  ]);
}

function orthographic(left, right, bottom, top, near, far) {
  return new Float32Array([
    2 / (right - left), 0, 0, 0,
    0, 2 / (top - bottom), 0, 0,
    0, 0, -2 / (far - near), 0,
    -(right + left) / (right - left),
    -(top + bottom) / (top - bottom),
    -(far + near) / (far - near),
    1,
  ]);
}

function lookAt(eye, target, up) {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function multiply(a, b) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let inner = 0; inner < 4; inner += 1) {
        value += a[inner * 4 + row] * b[column * 4 + inner];
      }
      result[column * 4 + row] = value;
    }
  }
  return result;
}

function projectPoint(matrix, point) {
  const [x, y, z] = point;
  const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
  const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
  const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const divisor = Math.abs(clipW) > 0.0001 ? clipW : 1;
  return [clipX / divisor, clipY / divisor];
}

function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
