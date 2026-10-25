const canvas = document.querySelector('#build-scene');
const status = document.querySelector('#scene-status');
const fallback = document.querySelector('#webgl-fallback');
const storyPanes = [...document.querySelectorAll('[data-pane]')];
const portalButtons = [...document.querySelectorAll('[data-stop]')];
const storyKicker = document.querySelector('#story-kicker');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const stops = {
  agents: { x: -3.45, z: -2.45, label: 'Agent Workbench', kicker: '01 / AI systems' },
  product: { x: 3.45, z: -2.45, label: 'Product Studio', kicker: '02 / product engineering' },
  engineering: { x: 3.45, z: 2.45, label: 'Engineering Lab', kicker: '03 / research & delivery' },
  community: { x: -3.45, z: 2.45, label: 'Community & Leadership', kicker: '04 / leadership' },
};

const player = { x: 0, z: 1.25, targetX: 0, targetZ: 1.25 };
const heldKeys = new Set();
let activeStop = 'agents';
let scheduleDraw = () => {};

function setStatus(message) {
  if (status && status.textContent !== message) status.textContent = message;
}

function selectStop(id) {
  const stop = stops[id];
  if (!stop) return;

  activeStop = id;
  storyPanes.forEach((pane) => {
    pane.hidden = pane.dataset.pane !== id;
  });
  portalButtons.forEach((button) => {
    const selected = button.dataset.stop === id;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (storyKicker) storyKicker.textContent = stop.kicker;
  player.targetX = stop.x;
  player.targetZ = stop.z;
  setStatus(`${stop.label} selected. The written story is below the map.`);
  scheduleDraw();
}

portalButtons.forEach((button) => {
  button.addEventListener('click', () => selectStop(button.dataset.stop));
});

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

function isTypingTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName));
}

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) return;
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
    else selectStop(activeStop || 'agents');
  }
});

window.addEventListener('keyup', (event) => heldKeys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => heldKeys.clear());

const gl = canvas?.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'low-power' });

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
    const ratio = Math.min(window.devicePixelRatio || 1, 1.7);
    const width = Math.max(1, Math.floor(bounds.width * ratio));
    const height = Math.max(1, Math.floor(bounds.height * ratio));
    if (sceneCanvas.width !== width || sceneCanvas.height !== height) {
      sceneCanvas.width = width;
      sceneCanvas.height = height;
      context.viewport(0, 0, width, height);
    }
    const projection = perspective(Math.PI / 4.2, width / height, 0.1, 100);
    const view = lookAt([0, 8.6, 12.4], [0, 0.2, 0], [0, 1, 0]);
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

    context.clearColor(0.035, 0.055, 0.068, 1);
    context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
    context.useProgram(program);
    context.uniformMatrix4fv(matrixLocation, false, viewProjection);
    bindAttributes(worldBuffer);
    context.drawArrays(context.TRIANGLES, 0, worldVertexCount);

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
  const concrete = [0.12, 0.18, 0.21];
  const darkFloor = [0.08, 0.13, 0.16];
  const grid = [0.16, 0.25, 0.27];
  const path = [0.13, 0.22, 0.23];

  addBox(vertices, 0, -0.23, 0, 12.2, 0.46, 9.6, concrete);
  addBox(vertices, 0, 0.015, 0, 11.85, 0.035, 9.25, darkFloor);

  for (let x = -5.25; x <= 5.25; x += 1.05) addBox(vertices, x, 0.038, 0, 0.018, 0.012, 9.1, grid);
  for (let z = -4.1; z <= 4.1; z += 1.05) addBox(vertices, 0, 0.038, z, 11.7, 0.012, 0.018, grid);

  for (const stop of Object.values(stops)) {
    const length = Math.hypot(stop.x, stop.z) - 1.1;
    const angle = Math.atan2(stop.x, stop.z);
    addBox(vertices, stop.x / 2, 0.048, stop.z / 2, 0.72, 0.025, length, path, angle);
  }

  addCylinder(vertices, 0, 0.07, 0, 1.35, 0.15, [0.18, 0.32, 0.33], 12);
  addCylinder(vertices, 0, 0.19, 0, 0.85, 0.12, [0.11, 0.51, 0.39], 12);
  addCylinder(vertices, 0, 0.31, 0, 0.35, 0.12, [0.3, 0.92, 0.65], 10);
  addBox(vertices, 0, 0.65, 0, 0.22, 0.58, 0.22, [0.2, 0.8, 0.58]);
  addBox(vertices, 0, 1.02, 0, 0.62, 0.1, 0.62, [0.33, 0.95, 0.7]);

  const portalColors = {
    agents: [0.2, 0.9, 0.69],
    product: [0.39, 0.65, 1],
    engineering: [0.7, 0.48, 1],
    community: [1, 0.66, 0.32],
  };

  for (const [id, stop] of Object.entries(stops)) {
    addPortal(vertices, stop.x, stop.z, portalColors[id]);
  }

  for (let index = 0; index < 4; index += 1) {
    const x = index < 2 ? -5.45 : 5.45;
    const z = index % 2 === 0 ? -3.65 : 3.65;
    addBox(vertices, x, 0.27, z, 0.22, 0.48, 0.22, [0.2, 0.31, 0.33]);
    addBox(vertices, x, 0.55, z, 0.42, 0.12, 0.42, [0.25, 0.46, 0.43]);
  }
}

function addPortal(vertices, x, z, color) {
  const frame = mixColor(color, [0.24, 0.32, 0.36], 0.34);
  const panel = mixColor(color, [0.08, 0.17, 0.19], 0.22);
  addBox(vertices, x, 0.1, z, 1.5, 0.2, 1.3, [0.16, 0.25, 0.27]);
  addBox(vertices, x - 0.48, 0.94, z, 0.16, 1.5, 0.18, frame);
  addBox(vertices, x + 0.48, 0.94, z, 0.16, 1.5, 0.18, frame);
  addBox(vertices, x, 1.68, z, 1.12, 0.16, 0.18, frame);
  addBox(vertices, x, 0.91, z, 0.74, 1.28, 0.06, panel);
  addBox(vertices, x, 1.72, z, 0.38, 0.12, 0.26, color);
  addBox(vertices, x, 0.26, z, 0.9, 0.08, 0.1, color);
}

function buildAvatar(vertices, x, z) {
  const skin = [0.82, 0.58, 0.39];
  const jacket = [0.18, 0.79, 0.55];
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
