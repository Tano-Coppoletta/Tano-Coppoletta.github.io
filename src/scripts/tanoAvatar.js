const WIDTH = 144;
const HEIGHT = 160;

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec3 aColor;
  attribute vec2 aTexCoord;
  attribute float aFabric;
  uniform mat4 uViewProjection;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec2 vTexCoord;
  varying float vFabric;
  void main() {
    gl_Position = uViewProjection * vec4(aPosition, 1.0);
    vNormal = aNormal;
    vColor = aColor;
    vTexCoord = aTexCoord;
    vFabric = aFabric;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec2 vTexCoord;
  varying float vFabric;
  uniform sampler2D uFabric;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 sun = normalize(vec3(-0.42, 0.78, 0.48));
    float diffuse = max(dot(n, sun), 0.0);
    float bounce = max(dot(n, normalize(vec3(0.5, 0.2, -0.7))), 0.0);
    vec3 light = vec3(0.72) + vec3(0.25, 0.20, 0.15) * diffuse + vec3(0.08, 0.10, 0.15) * bounce;
    float grain = texture2D(uFabric, vTexCoord).r;
    float fabric = mix(1.0, 0.84 + grain * 0.32, vFabric);
    gl_FragColor = vec4(vColor * light * fabric, 1.0);
  }
`;

const C = {
  hair: [0.105, 0.082, 0.105], hairLight: [0.18, 0.13, 0.16], hairDeep: [0.075, 0.065, 0.085],
  skin: [0.77, 0.43, 0.25], skinLight: [0.91, 0.57, 0.34], skinShade: [0.55, 0.28, 0.18],
  ink: [0.10, 0.065, 0.065], eye: [0.055, 0.045, 0.05],
  jacket: [0.075, 0.12, 0.25], jacketLight: [0.12, 0.19, 0.35], jacketDark: [0.045, 0.075, 0.17],
  seam: [0.24, 0.28, 0.37], orange: [0.82, 0.20, 0.085], orangeLight: [0.96, 0.30, 0.12],
  denim: [0.16, 0.29, 0.49], denimLight: [0.23, 0.38, 0.59], denimDark: [0.10, 0.20, 0.36],
  cuff: [0.48, 0.56, 0.65], ivory: [0.87, 0.84, 0.76], sole: [0.98, 0.94, 0.83],
  shoeDark: [0.32, 0.31, 0.32], pack: [0.15, 0.16, 0.19], packLight: [0.24, 0.25, 0.28],
  teal: [0.08, 0.52, 0.49], lace: [0.96, 0.87, 0.70],
};

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = makeCube();
const CLOTH = makeClothPrism();
const SPHERE = makeSphere(10, 7);
const FABRIC_COLORS = [
  C.jacket, C.jacketLight, C.jacketDark, C.denim, C.denimLight, C.denimDark, C.cuff,
  C.pack, C.packLight,
];

export function createTanoAvatar() {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.setAttribute('aria-hidden', 'true');
  let gl = null;
  let program = null;
  let buffer = null;
  let fabricTexture = null;
  let available = false;
  let disposed = false;
  let locations = null;
  let viewProjection = null;
  let groundAnchorY = 0.94;

  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    });
    if (!gl) throw new Error('WebGL unavailable');
    program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    buffer = gl.createBuffer();
    locations = {
      position: gl.getAttribLocation(program, 'aPosition'),
      normal: gl.getAttribLocation(program, 'aNormal'),
      color: gl.getAttribLocation(program, 'aColor'),
      texCoord: gl.getAttribLocation(program, 'aTexCoord'),
      fabric: gl.getAttribLocation(program, 'aFabric'),
      matrix: gl.getUniformLocation(program, 'uViewProjection'),
      sampler: gl.getUniformLocation(program, 'uFabric'),
    };
    fabricTexture = createFabricTexture(gl);
    viewProjection = makeCamera();
    // Project the standing ground plane for exact feet/shadow compositing.
    groundAnchorY = (1 - (viewProjection[5] * -0.095 + viewProjection[13])) / 2;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, WIDTH, HEIGHT);
    available = Boolean(buffer && fabricTexture);
  } catch {
    available = false;
  }

  const handleContextLost = (event) => {
    event.preventDefault();
    available = false;
  };
  canvas.addEventListener('webglcontextlost', handleContextLost);

  function render(options = {}) {
    if (!available || disposed) return;
    try {
      const { time = 0, moving = false, heading = 0, interacting = false, reducedMotion = false } = options || {};
      const data = buildTano(time, moving, heading, interacting, reducedMotion);
      gl.viewport(0, 0, WIDTH, HEIGHT);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
      const stride = 12 * Float32Array.BYTES_PER_ELEMENT;
      for (const [name, size, offset] of [
        ['position', 3, 0], ['normal', 3, 3], ['color', 3, 6], ['texCoord', 2, 9], ['fabric', 1, 11],
      ]) {
        gl.enableVertexAttribArray(locations[name]);
        gl.vertexAttribPointer(locations[name], size, gl.FLOAT, false, stride, offset * 4);
      }
      gl.uniformMatrix4fv(locations.matrix, false, viewProjection);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fabricTexture);
      gl.uniform1i(locations.sampler, 0);
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 12);
    } catch {
      // A lost context or transient driver failure should not interrupt the city canvas.
      available = false;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    if (gl) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (fabricTexture) gl.deleteTexture(fabricTexture);
    }
  }

  return { canvas, groundAnchorY, get available() { return available && !disposed; }, render, dispose };
}

function buildTano(time, moving, heading, interacting, reducedMotion) {
  const out = [];
  const seconds = (Number.isFinite(time) ? time : 0) * 0.001;
  const phase = reducedMotion ? 0 : seconds * (moving ? 10.5 : 2.2);
  const stride = moving && !reducedMotion ? Math.sin(phase) : 0;
  const breathe = reducedMotion ? 0 : Math.sin(seconds * 2.2) * 0.018;
  const root = multiply(IDENTITY, rotationY(Number.isFinite(heading) ? heading : 0));
  const torso = multiply(root, translation(0, breathe, 0));

  // Backpack and its stitched outer pocket are deliberately behind the torso.
  box(out, root, [0, 2.05, -0.35], [0.62, 0.92, 0.30], C.pack);
  box(out, root, [0, 1.92, -0.515], [0.48, 0.38, 0.035], C.packLight);
  box(out, root, [0, 2.20, -0.515], [0.17, 0.075, 0.025], C.teal);
  box(out, root, [0, 1.71, -0.545], [0.38, 0.035, 0.025], C.pack);
  box(out, root, [0, 2.45, -0.30], [0.27, 0.10, 0.12], C.packLight);

  // Jeans: articulated thigh, shin, and rolled cuff on each leg.
  for (const side of [-1, 1]) {
    const swing = stride * side;
    const knee = moving && !reducedMotion ? Math.max(0, -swing) * 0.48 : 0;
    const hip = multiply(root, translation(side * 0.24, 1.38, 0));
    const leg = multiply(hip, multiply(rotationZ(side * (moving ? 0.035 : 0.10)), rotationX(swing * 0.34)));
    box(out, leg, [0, -0.28, 0], [0.38, 0.72, 0.42], side < 0 ? C.denim : C.denimLight);
    box(out, leg, [side * 0.015, -0.46, 0.205], [0.11, 0.035, 0.018], C.denimDark);
    const shin = multiply(leg, translation(0, -0.62, 0));
    const bent = multiply(shin, rotationX(knee));
    box(out, bent, [0, -0.31, 0], [0.34, 0.70, 0.37], C.denim);
    box(out, bent, [0, -0.625, 0], [0.40, 0.19, 0.42], C.cuff);
    box(out, bent, [0, -0.625, 0.204], [0.24, 0.105, 0.018], C.denimLight);
    const foot = multiply(bent, translation(0, -0.76, 0.12));
    shoe(out, foot, side);
  }
  box(out, root, [0, 1.40, 0], [0.62, 0.28, 0.40], C.denim);
  box(out, root, [0, 1.54, 0.215], [0.58, 0.045, 0.025], C.denimDark);
  for (const side of [-1, 1]) {
    box(out, root, [side * 0.16, 1.35, -0.212], [0.20, 0.20, 0.025], C.denimLight);
    box(out, root, [side * 0.16, 1.35, -0.229], [0.14, 0.018, 0.012], C.denimDark);
  }

  // Torso, visible orange tee, and separated jacket fronts create a clear open silhouette.
  box(out, torso, [0, 2.08, 0], [0.72, 0.91, 0.43], C.orange);
  box(out, torso, [0, 2.12, -0.235], [0.76, 0.90, 0.13], C.jacket);
  box(out, torso, [0, 1.67, 0.008], [0.71, 0.14, 0.45], C.orangeLight);
  box(out, torso, [0, 2.47, 0], [0.73, 0.17, 0.44], C.orange);
  box(out, torso, [0, 2.08, 0.224], [0.105, 0.45, 0.018], [0.69, 0.16, 0.075]);
  for (const side of [-1, 1]) {
    box(out, torso, [side * 0.30, 2.10, 0.22], [0.18, 0.87, 0.12], C.jacket);
    box(out, torso, [side * 0.305, 2.48, 0.274], [0.19, 0.22, 0.035], C.jacketLight, [0, 0, side * -0.18]);
    box(out, torso, [side * 0.30, 1.66, 0.21], [0.20, 0.13, 0.13], C.jacketDark);
    box(out, torso, [side * 0.30, 1.69, 0.285], [0.17, 0.025, 0.018], C.seam);
    box(out, torso, [side * 0.362, 2.09, 0], [0.12, 0.74, 0.39], C.jacketDark);
    box(out, torso, [side * 0.395, 2.43, 0.17], [0.09, 0.18, 0.035], C.jacketLight, [0, 0, side * -0.40]);
  }
  box(out, torso, [0, 2.60, 0], [0.34, 0.17, 0.31], C.orange);

  // Shoulder straps, padded shoulder seams, and buckles are visible from front and side.
  for (const side of [-1, 1]) {
    box(out, root, [side * 0.31, 2.34, 0.265], [0.105, 0.63, 0.075], C.pack);
    box(out, root, [side * 0.31, 2.13, 0.307], [0.11, 0.13, 0.025], C.packLight);
    box(out, root, [side * 0.31, 2.13, 0.326], [0.055, 0.045, 0.016], C.seam);
  }

  // Head and neck. Features sit on the actual head, not a camera-facing billboard.
  const headBob = interacting && !reducedMotion ? Math.sin(seconds * 7) * 0.035 : breathe * 0.5;
  const head = multiply(root, multiply(translation(0, 2.88 + headBob, 0.045), rotationZ(interacting && !reducedMotion ? Math.sin(seconds * 5) * 0.07 : 0)));
  box(out, torso, [0, 2.58, 0], [0.25, 0.25, 0.25], C.skinShade);
  ellipsoid(out, head, [0, 0, 0], [0.405, 0.49, 0.34], C.skin);
  ellipsoid(out, head, [0, -0.10, 0.278], [0.30, 0.31, 0.085], C.skinLight);
  for (const side of [-1, 1]) {
    ellipsoid(out, head, [side * 0.395, -0.02, 0.005], [0.085, 0.13, 0.10], C.skin);
    ellipsoid(out, head, [side * 0.397, -0.025, 0.085], [0.03, 0.055, 0.025], C.skinShade);
    box(out, head, [side * 0.145, 0.035, 0.353], [0.14, 0.125, 0.025], C.sole);
    box(out, head, [side * 0.145, 0.035, 0.374], [0.055, 0.11, 0.025], C.eye);
    box(out, head, [side * 0.145, 0.11, 0.374], [0.17, 0.052, 0.035], C.hairDeep, [0, 0, side * 0.10]);
    box(out, head, [side * 0.127, 0.053, 0.393], [0.018, 0.025, 0.012], C.sole);
  }
  ellipsoid(out, head, [0, -0.075, 0.367], [0.07, 0.09, 0.065], C.skinLight);
  box(out, head, [0, -0.205, 0.344], [0.15, 0.026, 0.025], C.skinShade);
  box(out, head, [0, -0.227, 0.351], [0.105, 0.012, 0.016], [0.31, 0.11, 0.08]);

  // Dense irregular locks: sculpted ellipsoids and tapered tufts make the dark messy hair.
  ellipsoid(out, head, [0, 0.29, -0.015], [0.43, 0.26, 0.36], C.hair);
  ellipsoid(out, head, [0, 0.05, -0.20], [0.40, 0.38, 0.20], C.hair);
  ellipsoid(out, head, [0, 0.20, 0.205], [0.39, 0.19, 0.24], C.hair);
  for (let i = 0; i < 9; i += 1) {
    const x = (i - 4) * 0.087;
    const z = 0.26 + (i % 3) * 0.018;
    ellipsoid(out, head, [x, 0.34 + ((i * 7) % 4) * 0.025, z], [0.115, 0.20 + (i % 2) * 0.035, 0.15], i % 3 === 0 ? C.hairLight : C.hair);
  }
  for (let i = 0; i < 6; i += 1) {
    const side = i < 3 ? -1 : 1;
    const n = i % 3;
    ellipsoid(out, head, [side * (0.34 + n * 0.025), 0.12 - n * 0.11, 0.035], [0.14, 0.18, 0.18], n === 1 ? C.hairLight : C.hair);
  }
  ellipsoid(out, head, [-0.19, 0.40, 0.17], [0.14, 0.12, 0.15], C.hairLight, [0, 0, -0.45]);
  ellipsoid(out, head, [0.08, 0.47, 0.12], [0.13, 0.16, 0.14], C.hairDeep, [0, 0, 0.26]);

  // Independent shoulder/elbow/wrist pivots; right arm waves on interaction.
  const wave = interacting && !reducedMotion ? Math.sin(seconds * 8) : 0;
  for (const side of [-1, 1]) {
    const shoulder = multiply(root, translation(side * 0.44, 2.42, 0));
    const upper = multiply(
      multiply(shoulder, rotationX(-stride * side * 0.52)),
      rotationZ(side * (side > 0 && interacting ? 2.12 + wave * 0.08 : 0.16)),
    );
    box(out, upper, [side * 0.13, -0.26, 0], [0.29, 0.54, 0.35], C.jacket);
    box(out, upper, [side * 0.17, -0.26, 0.18], [0.055, 0.39, 0.025], C.jacketLight);
    const elbow = multiply(upper, translation(0, -0.52, 0));
    const elbowAngle = side > 0 && interacting ? -0.72 + wave * 0.34 : (moving ? Math.max(0, -stride * side) * 0.30 : 0);
    const lower = multiply(elbow, rotationZ(side * elbowAngle));
    box(out, lower, [side * 0.035, -0.25, 0], [0.27, 0.51, 0.33], C.jacket);
    box(out, lower, [side * 0.04, -0.49, 0], [0.30, 0.15, 0.36], C.jacketDark);
    box(out, lower, [side * 0.04, -0.49, 0.19], [0.25, 0.055, 0.025], C.jacketLight);
    let hand = multiply(lower, translation(side * 0.04, -0.61, 0.015));
    if (side > 0 && interacting) hand = multiply(hand, rotationZ(wave * 0.24));
    ellipsoid(out, hand, [0, -0.045, 0.025], [0.13, 0.16, 0.14], C.skin);
    for (let finger = 0; finger < 3; finger += 1) {
      ellipsoid(out, hand, [(finger - 1) * 0.055, -0.15, 0.04], [0.035, 0.075, 0.045], C.skinLight);
    }
    if (side > 0 && interacting) {
      ellipsoid(out, hand, [0.12, -0.02, 0.02], [0.045, 0.105, 0.045], C.skin);
    }
  }
  return out;
}

function shoe(out, transform, side) {
  box(out, transform, [0, -0.02, 0.12], [0.39, 0.15, 0.66], C.sole);
  box(out, transform, [0, 0.07, 0.08], [0.36, 0.21, 0.53], C.ivory);
  box(out, transform, [0, 0.15, 0.22], [0.30, 0.07, 0.25], C.ivory);
  box(out, transform, [0, 0.075, -0.12], [0.33, 0.20, 0.20], C.shoeDark);
  box(out, transform, [0, 0.185, 0.25], [0.24, 0.035, 0.045], C.orange);
  for (let lace = 0; lace < 3; lace += 1) {
    box(out, transform, [0, 0.19, 0.10 - lace * 0.075], [0.19, 0.018, 0.028], C.lace);
  }
  box(out, transform, [side * 0.13, 0.035, 0.18], [0.045, 0.04, 0.23], C.orange);
}

function box(out, parent, position, size, color, rotation = [0, 0, 0]) {
  let transform = multiply(parent, translation(position[0], position[1], position[2]));
  transform = multiply(transform, rotationZ(rotation[2]));
  transform = multiply(transform, rotationY(rotation[1]));
  transform = multiply(transform, rotationX(rotation[0]));
  transform = multiply(transform, scaling(size[0], size[1], size[2]));
  appendMesh(out, FABRIC_COLORS.includes(color) || color === C.ivory ? CLOTH : CUBE, transform, color);
}

function ellipsoid(out, parent, position, size, color, rotation = [0, 0, 0]) {
  let transform = multiply(parent, translation(position[0], position[1], position[2]));
  transform = multiply(transform, rotationZ(rotation[2]));
  transform = multiply(transform, rotationY(rotation[1]));
  transform = multiply(transform, rotationX(rotation[0]));
  transform = multiply(transform, scaling(size[0], size[1], size[2]));
  appendMesh(out, SPHERE, transform, color);
}

function appendMesh(out, mesh, matrix, color) {
  const scaleX = Math.hypot(matrix[0], matrix[1], matrix[2]) || 1;
  const scaleY = Math.hypot(matrix[4], matrix[5], matrix[6]) || 1;
  const scaleZ = Math.hypot(matrix[8], matrix[9], matrix[10]) || 1;
  const fabric = FABRIC_COLORS.includes(color) ? 1 : 0;
  for (let i = 0; i < mesh.length; i += 6) {
    const x = mesh[i], y = mesh[i + 1], z = mesh[i + 2];
    const nx = mesh[i + 3], ny = mesh[i + 4], nz = mesh[i + 5];
    const px = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const py = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const pz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    // The parent rig is rigid; compensate for this primitive's nonuniform scale.
    const localNX = nx / scaleX, localNY = ny / scaleY, localNZ = nz / scaleZ;
    let ox = (matrix[0] / scaleX) * localNX + (matrix[4] / scaleY) * localNY + (matrix[8] / scaleZ) * localNZ;
    let oy = (matrix[1] / scaleX) * localNX + (matrix[5] / scaleY) * localNY + (matrix[9] / scaleZ) * localNZ;
    let oz = (matrix[2] / scaleX) * localNX + (matrix[6] / scaleY) * localNY + (matrix[10] / scaleZ) * localNZ;
    const length = Math.hypot(ox, oy, oz) || 1;
    ox /= length; oy /= length; oz /= length;
    const uvX = (x + (mesh === CUBE ? 0.5 : 1)) * 3;
    const uvY = (y + (mesh === CUBE ? 0.5 : 1)) * 3;
    out.push(px, py, pz, ox, oy, oz, color[0], color[1], color[2], uvX, uvY, fabric);
  }
}

function makeCube() {
  const faces = [
    [[0, 0, 1], [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5]],
    [[0, 0, -1], [0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5]],
    [[1, 0, 0], [0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5]],
    [[-1, 0, 0], [-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5]],
    [[0, 1, 0], [-0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5]],
    [[0, -1, 0], [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5]],
  ];
  const result = [];
  for (const [normal, p] of faces) {
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const at = index * 3;
      result.push(p[at], p[at + 1], p[at + 2], normal[0], normal[1], normal[2]);
    }
  }
  return result;
}

function makeClothPrism() {
  // Beveled side seams give baggy clothing and the pack a faceted silhouette.
  const ring = [[-.38, -.5], [.38, -.5], [.5, -.38], [.5, .38], [.38, .5], [-.38, .5], [-.5, .38], [-.5, -.38]];
  const result = [];
  const emit = (vertices, normal) => vertices.forEach((vertex) => result.push(...vertex, ...normal));
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const normal = normalize([b[1] - a[1], 0, a[0] - b[0]]);
    emit([[a[0], -.5, a[1]], [b[0], -.5, b[1]], [b[0], .5, b[1]]], normal);
    emit([[a[0], -.5, a[1]], [b[0], .5, b[1]], [a[0], .5, a[1]]], normal);
    for (const y of [-.5, .5]) emit([[0, y, 0], [a[0], y, a[1]], [b[0], y, b[1]]], [0, Math.sign(y), 0]);
  }
  return result;
}

function makeSphere(segments, rings) {
  const result = [];
  const point = (u, v) => {
    const theta = v * Math.PI;
    const phi = u * Math.PI * 2;
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.cos(theta);
    const z = Math.sin(theta) * Math.sin(phi);
    return [x, y, z];
  };
  const triangle = (a, b, c) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let normal = cross(ab, ac);
    if (dot(normal, [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]]) < 0) {
      normal = normal.map((component) => -component);
    }
    normal = normalize(normal);
    for (const vertex of [a, b, c]) result.push(...vertex, ...normal);
  };
  for (let y = 0; y < rings; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const u0 = x / segments, u1 = (x + 1) / segments;
      const v0 = y / rings, v1 = (y + 1) / rings;
      const a = point(u0, v0), b = point(u1, v0), c = point(u1, v1), d = point(u0, v1);
      triangle(a, b, c);
      triangle(a, c, d);
    }
  }
  return result;
}

function createFabricTexture(gl) {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Could not create fabric texture');
  const pixels = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      let hash = (x * 73856093) ^ (y * 19349663) ^ (x * y * 83492791);
      hash >>>= 0;
      const value = 51 + (hash % 154);
      const index = (y * 16 + x) * 4;
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 16, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return texture;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || 'Shader compile failed');
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message || 'Program link failed');
  }
  return program;
}

function makeCamera() {
  const view = lookAt([0, 4.3, 8.5], [0, 1.70, 0], [0, 1, 0]);
  const projection = orthographic(-1.90, 1.90, -2.15, 2.05, 0.1, 30);
  return multiply(projection, view);
}

function lookAt(eye, target, up) {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function orthographic(left, right, bottom, top, near, far) {
  return new Float32Array([
    2 / (right - left), 0, 0, 0, 0, 2 / (top - bottom), 0, 0, 0, 0, -2 / (far - near), 0,
    -(right + left) / (right - left), -(top + bottom) / (top - bottom), -(far + near) / (far - near), 1,
  ]);
}

function multiply(a, b) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] =
        a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
  }
  return result;
}

function translation(x, y, z) {
  const matrix = new Float32Array(IDENTITY);
  matrix[12] = x; matrix[13] = y; matrix[14] = z;
  return matrix;
}
function scaling(x, y, z) {
  const matrix = new Float32Array(IDENTITY);
  matrix[0] = x; matrix[5] = y; matrix[10] = z;
  return matrix;
}
function rotationX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}
function rotationY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}
function rotationZ(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function normalize(v) {
  const length = Math.hypot(...v) || 1;
  return v.map((value) => value / length);
}
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
