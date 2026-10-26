const canvas = document.querySelector('#build-scene');
const status = document.querySelector('#scene-status');
const fallback = document.querySelector('#webgl-fallback');
const storyPanes = [...document.querySelectorAll('[data-pane]')];
const portalButtons = [...document.querySelectorAll('[data-stop]')];
const storyKicker = document.querySelector('#story-kicker');
const storyPanel = document.querySelector('#story-panel');
const closeStoryButton = document.querySelector('#close-story-panel');
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
let scheduleDraw = () => {};

function setStatus(message) {
  if (status && status.textContent !== message) status.textContent = message;
}

function selectStop(id, { focusPanel = false, trigger = null } = {}) {
  const stop = stops[id];
  if (!stop) return;

  activeStop = id;
  if (trigger) lastStoryTrigger = trigger;
  if (storyPanel) storyPanel.hidden = false;
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
  setStatus(`${stop.label} selected. The written story is below the map.`);
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
  lastStoryTrigger?.focus({ preventScroll: true });
  if (!lastStoryTrigger) canvas?.focus({ preventScroll: true });
}

closeStoryButton?.addEventListener('click', closeStoryPanel);

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
    if (stop) selectStop(stop);
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
  setStatus('3D is unavailable here; use the map and text-first portfolio below.');
} else {
  try {
    startWorld(gl, canvas);
    document.documentElement.classList.add('build-lab-ready');
  } catch (error) {
    console.error('Build Lab 3D setup failed:', error);
    if (fallback) fallback.hidden = false;
    setStatus('3D could not start in this browser; all portfolio details remain available below.');
  }
}

function startWorld(context, sceneCanvas) {
  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform mat4 uViewProjection;
    varying vec3 vColor;
    void main() {
      gl_Position = uViewProjection * vec4(aPosition, 1.0);
      vColor = aColor;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(vColor, 1.0);
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
    const halfWidth = 7.7;
    const halfHeight = halfWidth / aspect;
    const projection = orthographic(-halfWidth, halfWidth, -halfHeight, halfHeight, -25, 50);
    const view = lookAt([10, 12, 10], [0, 0.55, 0], [0, 1, 0]);
    viewProjection = multiply(projection, view);
  }

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

    context.clearColor(0.91, 0.86, 0.75, 1);
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
  const cream = [0.88, 0.82, 0.7];
  const plaster = [0.94, 0.89, 0.78];
  const wood = [0.48, 0.29, 0.17];
  const lightWood = [0.67, 0.46, 0.29];
  const sage = [0.36, 0.53, 0.4];
  const coral = [0.79, 0.39, 0.3];
  const dark = [0.17, 0.2, 0.18];
  const teal = [0.22, 0.53, 0.52];

  // Raised timber workshop floor and carefully spaced plank seams.
  addBox(vertices, 0, -0.26, 0, 11.7, 0.52, 9.2, wood);
  addBox(vertices, 0, 0.012, 0, 11.38, 0.035, 8.9, [0.72, 0.57, 0.39]);
  for (let z = -4.15; z <= 4.15; z += 0.55) {
    addBox(vertices, 0, 0.037, z, 11.24, 0.012, 0.018, [0.57, 0.41, 0.28]);
  }

  // Open-front, cream-plaster room with exposed timber trim.
  addBox(vertices, 0, 1.45, -4.52, 11.72, 2.9, 0.3, plaster);
  addBox(vertices, 0, 2.98, -4.48, 11.92, 0.15, 0.44, wood);
  addBox(vertices, 0, 0.2, -4.46, 11.68, 0.2, 0.32, lightWood);
  addBox(vertices, -5.72, 1.25, 0, 0.3, 2.5, 9.05, cream);
  addBox(vertices, -5.7, 2.56, 0, 0.42, 0.13, 9.1, wood);
  for (const x of [-4.8, -1.65, 1.65, 4.8]) {
    addBox(vertices, x, 1.85, -4.3, 1.08, 1.1, 0.08, wood);
    addBox(vertices, x, 1.85, -4.22, 0.86, 0.88, 0.07, [0.67, 0.77, 0.7]);
    addBox(vertices, x, 1.29, -4.19, 1.17, 0.08, 0.28, lightWood);
  }

  // Clear routes connect the central spawn to each exhibit.
  const path = [0.82, 0.71, 0.53];
  for (const stop of Object.values(stops)) {
    const length = Math.hypot(stop.x, stop.z) - 1.5;
    const angle = Math.atan2(stop.x, stop.z);
    addBox(vertices, stop.x / 2, 0.05, stop.z / 2, 0.68, 0.025, length, path, angle);
  }
  addBox(vertices, 0, 0.056, 0, 1.25, 0.03, 1.25, sage);
  addBox(vertices, 0, 0.08, 0, 0.22, 0.03, 0.22, [0.91, 0.72, 0.42]);

  // 01 Agent Workbench: the largest, brightest station, with local monitors and server cabinet.
  addWorkbench(vertices, -3.35, -2.65, 2.2, teal, wood, true);
  addBox(vertices, -4.55, 0.84, -3.42, 0.58, 1.48, 0.58, dark);
  for (let y = 0.42; y < 1.5; y += 0.34) {
    addBox(vertices, -4.55, y, -3.11, 0.36, 0.08, 0.04, [0.36, 0.55, 0.47]);
    addBox(vertices, -4.42, y, -3.07, 0.055, 0.04, 0.04, coral);
  }
  addPlant(vertices, -2.1, -3.5, sage);

  // 02 Product Studio: a second bench and a pinboard for product sketches.
  addWorkbench(vertices, 3.32, -2.65, 1.9, coral, lightWood, false);
  addBox(vertices, 4.55, 1.55, -4.26, 1.28, 1.0, 0.12, wood);
  addBox(vertices, 4.55, 1.55, -4.17, 1.08, 0.8, 0.06, [0.9, 0.79, 0.62]);
  for (const [x, y, color] of [[4.25, 1.7, coral], [4.62, 1.45, sage], [4.85, 1.72, teal]]) {
    addBox(vertices, x, y, -4.12, 0.22, 0.12, 0.035, color);
  }

  // 03 Engineering & Research: a restrained EV charging-station model.
  addBox(vertices, 3.38, 0.19, 2.48, 1.7, 0.28, 1.35, [0.7, 0.57, 0.39]);
  addBox(vertices, 3.38, 0.81, 2.48, 0.62, 1.1, 0.48, dark);
  addBox(vertices, 3.38, 1.12, 2.22, 0.38, 0.48, 0.05, teal);
  addBox(vertices, 3.38, 0.37, 2.48, 0.76, 0.12, 0.62, sage);
  addCylinder(vertices, 4.13, 0.54, 2.72, 0.12, 0.72, dark, 8);
  addBox(vertices, 4.13, 1.25, 2.72, 0.26, 0.24, 0.23, coral);
  addPlant(vertices, 2.28, 3.35, sage);

  // 04 Community: a round meeting table, seating, and a warm coral focal point.
  addCylinder(vertices, -3.35, 0.94, 2.58, 0.86, 0.16, lightWood, 12);
  for (const [x, z] of [[-4.35, 2.55], [-2.35, 2.55], [-3.35, 1.5], [-3.35, 3.62]]) {
    addBox(vertices, x, 0.44, z, 0.38, 0.72, 0.38, sage);
    addBox(vertices, x, 0.83, z, 0.62, 0.14, 0.58, [0.67, 0.76, 0.61]);
  }
  addCylinder(vertices, -3.35, 1.1, 2.58, 0.18, 0.06, coral, 8);
  addPlant(vertices, -4.65, 3.5, sage);
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

function addPlant(vertices, x, z, leafColor) {
  addBox(vertices, x, 0.2, z, 0.48, 0.34, 0.48, [0.62, 0.37, 0.24]);
  addBox(vertices, x, 0.42, z, 0.5, 0.08, 0.5, [0.72, 0.48, 0.3]);
  addBox(vertices, x, 0.82, z, 0.1, 0.8, 0.1, [0.34, 0.43, 0.29]);
  addBox(vertices, x - 0.2, 0.75, z, 0.4, 0.13, 0.15, leafColor, -0.4);
  addBox(vertices, x + 0.2, 0.92, z, 0.4, 0.13, 0.15, [0.47, 0.62, 0.43], 0.4);
  addBox(vertices, x, 1.1, z + 0.18, 0.14, 0.38, 0.13, [0.42, 0.57, 0.38], 0.25);
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

function addBox(vertices, cx, cy, cz, width, height, depth, color, rotation = 0) {
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

  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    for (const cornerIndex of triangleIndices) {
      const [localX, localY, localZ] = faces[faceIndex][cornerIndex];
      const worldX = cx + localX * cos + localZ * sin;
      const worldZ = cz - localX * sin + localZ * cos;
      const shade = shades[faceIndex];
      vertices.push(
        worldX, cy + localY, worldZ,
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
