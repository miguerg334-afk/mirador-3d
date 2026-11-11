const get = (selector) => document.querySelector(selector);
const stage = get('.stage');
const scenePanel = get('.scene');
const enter = get('#enter');
const hint = get('#hint');
const entryStatus = get('#entry-status');

enter.addEventListener('click', () => {
  enter.disabled = true;
  entryStatus.textContent = 'Cargando apartamento…';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    stage.classList.add('inside');
    scenePanel.hidden = false;
    try {
      createViewer().resize();
      enter.hidden = true;
      get('#apartment-menu').hidden = false;
      get('.room-menu button').focus();
      entryStatus.textContent = '';
    } catch (error) {
      stage.classList.remove('inside');
      scenePanel.hidden = true;
      scenePanel.querySelector('canvas')?.remove();
      get('.room-menu').replaceChildren();
      get('.lighting-menu').replaceChildren();
      enter.disabled = false;
      entryStatus.textContent = 'No se pudo abrir el visor 3D. Inténtalo de nuevo.';
      console.error(error);
    }
  }));
});

function createViewer() {
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scenePanel.prepend(renderer.domElement);
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#aebdc3');
  scene.fog = new THREE.Fog('#aebdc3', 20, 90);
  const camera = new THREE.PerspectiveCamera(53, 1, 0.08, 100);
  const ambient = new THREE.HemisphereLight('#fff6e8', '#92816e', 0.94);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#ffe4bf', 1.75);
  sun.position.set(-6, 9, 5);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -10, right: 10, top: 10, bottom: -10});
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.normalBias = 0.018;
  scene.add(sun);

  const apartment = new THREE.Group();
  scene.add(apartment);
  function box(parent, color, x, y, z, width, height, depth) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({color, roughness: 0.85}));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const add = (...args) => box(apartment, ...args);
  const wood = '#916442';
  const iron = '#313832';

  // Small repeating maps add grain without downloading large textures.
  function surface(color, type, repeatX, repeatY) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const ctx = tile.getContext('2d');
    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, 0, 128, 128);
    let seed = 83;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 5200; i++) {
      const value = Math.floor(115 + random() * 115);
      ctx.fillStyle = 'rgb(' + value + ',' + value + ',' + value + ')';
      ctx.fillRect(random() * 128, random() * 128, type === 'wood' ? 1 : 2,
        type === 'wood' ? 4 + random() * 46 : 1 + random() * 2);
    }
    const map = new THREE.CanvasTexture(tile);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return new THREE.MeshStandardMaterial({color, map, bumpMap: map, bumpScale: type === 'stone' ? 0.002 : 0.005, roughness: 0.87});
  }

  function wovenFabric(tint = '#fff1dc', bumpScale = 0.0022) {
    const size = 256;
    const colorTile = document.createElement('canvas');
    const reliefTile = document.createElement('canvas');
    colorTile.width = colorTile.height = reliefTile.width = reliefTile.height = size;
    const colorContext = colorTile.getContext('2d');
    const reliefContext = reliefTile.getContext('2d');
    const color = colorContext.createImageData(size, size);
    const relief = reliefContext.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const warp = x / 8;
        const weft = y / 8;
        const warpOnTop = (Math.floor(warp) + Math.floor(weft)) % 2 === 0;
        const across = warpOnTop ? warp : weft;
        const along = warpOnTop ? weft : warp;
        const ridge = Math.sin(Math.PI * (across % 1)) ** 0.72;
        const twist = Math.sin((along * 3 + across * 2) * Math.PI * 2);
        const fiber = ((Math.imul(x + 1, 1973) ^ Math.imul(y + 1, 9277)) % 37) / 37 - 0.5;
        const variation = Math.sin(warp * Math.PI / 4) * Math.cos(weft * Math.PI / 8);
        const height = 0.18 + ridge * (0.57 + twist * 0.095) + fiber * 0.12;
        const shade = 192 + ridge * 38 + variation * 7 + twist * 4 + fiber * 9;
        const offset = (y * size + x) * 4;
        color.data.set([shade, shade * 0.963, shade * 0.898, 255], offset);
        const level = height * 255;
        relief.data.set([level, level, level, 255], offset);
      }
    }
    colorContext.putImageData(color, 0, 0);
    reliefContext.putImageData(relief, 0, 0);
    function texture(tile, encoding) {
      const map = new THREE.CanvasTexture(tile);
      map.encoding = encoding;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return map;
    }
    return new THREE.MeshPhysicalMaterial({
      color: tint,
      map: texture(colorTile, THREE.sRGBEncoding),
      bumpMap: texture(reliefTile, THREE.LinearEncoding),
      bumpScale,
      roughness: 0.88,
      sheen: new THREE.Color('#65513d')
    });
  }

  const oak = surface('#d4a775', 'wood', 1, 4);
  const walnut = surface('#9a673e', 'wood', 2, 2);
  const boucle = surface('#f3e2c8', 'cloth', 4, 3);
  const linen = surface('#fff4df', 'cloth', 3, 4);
  const olive = surface('#788069', 'cloth', 4, 4);
  const rust = surface('#b76345', 'cloth', 3, 3);
  const rug = surface('#d8c3a2', 'cloth', 12, 10);
  const brass = new THREE.MeshStandardMaterial({color: '#b48b52', metalness: 0.53, roughness: 0.3});

  function mesh(geometry, material, x, y, z) {
    const object = new THREE.Mesh(geometry, material.isMaterial ? material :
      new THREE.MeshStandardMaterial({color: material, roughness: 0.72}));
    object.position.set(x, y, z);
    object.castShadow = object.receiveShadow = true;
    apartment.add(object);
    return object;
  }
  function rounded(material, x, y, z, width, height, depth, radius) {
    const w = width / 2 - radius;
    const h = depth / 2 - radius;
    const shape = new THREE.Shape();
    shape.moveTo(-w, -h);
    shape.lineTo(w, -h);
    shape.lineTo(w, h);
    shape.lineTo(-w, h);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height - radius * 2, bevelEnabled: true, bevelSize: radius,
      bevelThickness: radius, bevelSegments: 4, steps: 1
    });
    geometry.center();
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      uv.setXY(i, positions.getX(i) / width + 0.5,
        positions.getZ(i) / depth + positions.getY(i) / height * 0.35 + 0.5);
    }
    return mesh(geometry, material, x, y, z);
  }
  // A continuous padded shell with a stitched seam around its widest section.
  function cushion(material, x, y, z, width, height, depth, seamColor, indentations = []) {
    const geometry = new THREE.SphereGeometry(1, indentations.length ? 160 : 48, indentations.length ? 96 : 32);
    const positions = geometry.attributes.position;
    const signedPower = (value, power) => Math.sign(value) * Math.abs(value) ** power;
    for (let i = 0; i < positions.count; i++) {
      const u = positions.getX(i);
      const v = positions.getY(i);
      const w = positions.getZ(i);
      const crease = 1 - 0.025 * Math.sin(u * 15 + w * 9) * Math.abs(v) ** 3;
      const px = signedPower(u, 0.42) * width / 2;
      const pz = signedPower(w, 0.42) * depth / 2;
      let inset = 0;
      if (v > 0) {
        for (const [cx, cz] of indentations) {
          const distance = ((px - cx) / 0.088) ** 2 + ((pz - cz) / 0.065) ** 2;
          inset += 0.023 * Math.exp(-distance) * v;
        }
      }
      positions.setXYZ(i, px, signedPower(v, 0.84) * height / 2 * crease - inset, pz);
      geometry.attributes.uv.setXY(i, px / width + 0.5,
        pz / depth + signedPower(v, 0.84) * 0.23 + 0.5);
    }
    geometry.computeVertexNormals();
    const shell = mesh(geometry, material, x, y, z);
    const stitches = [];
    for (let i = 0; i < 64; i++) {
      const angle = i * Math.PI / 32;
      stitches.push(new THREE.Vector3(signedPower(Math.cos(angle), 0.42) * width / 2,
        0, signedPower(Math.sin(angle), 0.42) * depth / 2));
    }
    shell.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stitches, true), 80, 0.003, 5, true),
      new THREE.MeshStandardMaterial({color: seamColor, roughness: 0.92})
    ));
    return shell;
  }

  const cylinder = (material, x, y, z, top, base, height) =>
    mesh(new THREE.CylinderGeometry(top, base, height, 24), material, x, y, z);
  function ellipsoid(material, x, y, z, width, height, depth) {
    const object = mesh(new THREE.SphereGeometry(1, 20, 12), material, x, y, z);
    object.scale.set(width, height, depth);
    return object;
  }

  add('#846b52', 0, -0.19, 0, 12, 0.27, 8);
  for (let row = 0; row < 30; row++) {
    let left = -4;
    for (let end = -4 + (row % 3 + 1) * 0.77; left < 4; end += 2.31) {
      const right = Math.min(end, 4);
      mesh(new THREE.BoxGeometry(0.396, 0.06, right - left - 0.007), oak,
        -5.8 + row * 0.4, -0.03, (left + right) / 2);
      left = right;
    }
  }
  // Periodic noise keeps the plaster seamless at a consistent scale on each wall.
  function mineralFinish(tint, relief, contrast, seed) {
    const size = 256;
    const colorCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = bumpCanvas.width = bumpCanvas.height = size;
    const colorContext = colorCanvas.getContext('2d');
    const bumpContext = bumpCanvas.getContext('2d');
    const color = colorContext.createImageData(size, size);
    const bump = bumpContext.createImageData(size, size);
    function hash(x, y) {
      let n = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed, 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    }
    function noise(u, v, cells) {
      const x = u * cells;
      const y = v * cells;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const tx = x - ix;
      const ty = y - iy;
      const fx = tx * tx * (3 - 2 * tx);
      const fy = ty * ty * (3 - 2 * ty);
      const left = (ix + cells) % cells;
      const top = (iy + cells) % cells;
      const right = (left + 1) % cells;
      const bottom = (top + 1) % cells;
      return THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(hash(left, top), hash(right, top), fx),
        THREE.MathUtils.lerp(hash(left, bottom), hash(right, bottom), fx), fy);
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const mottling = noise(u, v, 5) - 0.5;
        const trowel = noise(u + mottling * 0.08, v, 14) - 0.5;
        const sand = noise(u, v, 76) - 0.5;
        const grit = hash(x, y) - 0.5;
        const shade = 249 + contrast * (trowel * 4 + sand * 5 + grit * 2);
        const height = 127 + trowel * 16 + sand * 48 + grit * 9;
        const offset = (y * size + x) * 4;
        color.data.set([shade, shade, shade, 255], offset);
        bump.data.set([height, height, height, 255], offset);
      }
    }
    colorContext.putImageData(color, 0, 0);
    bumpContext.putImageData(bump, 0, 0);
    const map = new THREE.CanvasTexture(colorCanvas);
    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    map.encoding = THREE.sRGBEncoding;
    for (const texture of [map, bumpMap]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    return new THREE.MeshStandardMaterial({color: tint, map, bumpMap, bumpScale: relief, roughness: 0.94});
  }

  function texturedWall(material, x, y, z, width, height, depth, sampleSize = 1.1) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const {position, normal, uv} = geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      const u = normal.getX(i) ? z + position.getZ(i) : x + position.getX(i);
      const v = normal.getY(i) ? z + position.getZ(i) : y + position.getY(i);
      uv.setXY(i, u / sampleSize, v / sampleSize);
    }
    return mesh(geometry, material, x, y, z);
  }
  const limewash = mineralFinish('#fffdfa', 0.0032, 0.85, 13);
  const bedroomPlaster = mineralFinish('#fdfbf8', 0.0026, 0.75, 47);
  const partitionPlaster = mineralFinish('#fffdfa', 0.003, 0.8, 23);
  const kitchenPlaster = mineralFinish('#ffffff', 0.0028, 0.8, 39);
  texturedWall(limewash, -2.525, 1.45, -4, 6.95, 2.9, 0.16);
  texturedWall(kitchenPlaster, 3.475, 1.45, -4, 5.05, 2.9, 0.16);
  texturedWall(bedroomPlaster, 6, 1.45, 1.075, 0.16, 2.9, 5.85);
  texturedWall(kitchenPlaster, 6, 1.45, -2.925, 0.16, 2.9, 2.15);
  texturedWall(partitionPlaster, 0.95, 1.45, -2.8, 0.15, 2.9, 2.4);
  texturedWall(partitionPlaster, 0.95, 1.45, 2.3, 0.15, 2.9, 3.4);
  add('#c6b9a5', 0, 0.075, -3.9, 12, 0.15, 0.05);
  add('#c6b9a5', 5.89, 0.075, 0, 0.05, 0.15, 8);
  for (let i = 0; i <= 8; i++) add(iron, -6 + i * 1.5, 1.45, 4, 0.055, 2.9, 0.075);
  for (let i = 1; i <= 5; i++) add(iron, -6, 1.45, 4 - i * 1.6, 0.075, 2.9, 0.055);
  for (const y of [0.06, 2.87]) {
    add(iron, 0, y, 4, 12, 0.075, 0.08);
    add(iron, -6, y, 0, 0.08, 0.075, 8);
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#b6d3dd', transparent: true, opacity: 0.12, roughness: 0.18,
    side: THREE.DoubleSide, depthWrite: false
  });
  for (const [width, x, z, rotation] of [[12, 0, 4, 0], [8, -6, 0, Math.PI / 2]]) {
    const pane = mesh(new THREE.PlaneGeometry(width, 2.8), glass, x, 1.45, z);
    pane.rotation.y = rotation;
    pane.castShadow = pane.receiveShadow = false;
  }

  const wool = wovenFabric('#e8dac2', 0.006);
  scaleFabric(rounded(wool, -3.05, 0.023, 1.3, 4.5, 0.044, 3.45, 0.019),
    4.5, 0.044, 3.45, 8);
  // Ivory bench sofa, based on the upholstery and construction of the Sven and Metro.
  const sofaFabric = wovenFabric();
  function scaleFabric(object, width, height, depth, density = 12) {
    const material = object.material.clone();
    material.map = material.map.clone();
    material.bumpMap = material.bumpMap.clone();
    for (const map of [material.map, material.bumpMap]) {
      map.repeat.set(width * density, Math.max(depth, height) * density);
      map.needsUpdate = true;
    }
    object.material = material;
  }
  const center = -3.35;
  const sofaCurve = (x) => -0.30 * (x / 1.45) ** 2;
  const seat = cushion(sofaFabric, center, 0.321, 2.65, 2.98, 0.34, 1.12, '#c8b8a0');
  seat.traverse((part) => {
    const points = part.geometry.attributes.position;
    for (let i = 0; i < points.count; i++) {
      points.setZ(i, points.getZ(i) + sofaCurve(points.getX(i)));
    }
    part.geometry.computeVertexNormals();
  });
  scaleFabric(seat, 2.98, 0.34, 1.12, 9);
  const backPath = [];
  for (let i = 0; i <= 16; i++) {
    const angle = -1.43 + i * 2.86 / 16;
    backPath.push(new THREE.Vector3(1.27 * Math.sin(angle), 0, 0.63 * Math.cos(angle)));
  }
  const backGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(backPath), 72, 0.192, 20, false);
  backGeometry.scale(1, 1.48, 1);
  scaleFabric(mesh(backGeometry, sofaFabric, center, 0.55, 2.47), 3.0, 0.57, 1.1, 8);
  for (const side of [-1, 1]) {
    ellipsoid(sofaFabric, center + side * 1.255, 0.55, 2.56, 0.196, 0.282, 0.196);
  }
  rounded('#34291f', center, 0.091, 2.64, 2.34, 0.16, 0.65, 0.07);
  const accent = cushion(rust, center - 0.68, 0.61, 2.83, 0.45, 0.166, 0.42, '#a7563e');
  accent.rotation.set(1.23, -0.22, 0.16);

  const ash = surface('#ba946c', 'wood', 2, 3);
  const tabletop = new THREE.Shape();
  tabletop.moveTo(-0.76, 0.06);
  tabletop.bezierCurveTo(-0.8, -0.44, -0.31, -0.55, 0.04, -0.44);
  tabletop.bezierCurveTo(0.42, -0.36, 0.79, -0.16, 0.76, 0.15);
  tabletop.bezierCurveTo(0.71, 0.53, 0.16, 0.43, -0.03, 0.39);
  tabletop.bezierCurveTo(-0.36, 0.29, -0.69, 0.39, -0.76, 0.06);
  const tableGeometry = new THREE.ExtrudeGeometry(tabletop, {
    depth: 0.038, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.016,
    bevelSegments: 4, curveSegments: 24
  });
  tableGeometry.rotateX(-Math.PI / 2);
  mesh(tableGeometry, ash, -3.15, 0.345, 1.05);
  for (const [x, z] of [[-3.53, 1.1], [-2.82, 0.92], [-3.03, 1.27]]) {
    cylinder(ash, x, 0.188, z, 0.08, 0.107, 0.319);
  }
  const bookCover = '#36504a';
  for (const [y, height, color] of [[0.407, 0.007, bookCover], [0.426, 0.031, '#e4d8bf'], [0.445, 0.007, bookCover]]) {
    rounded(color, -3.43, y, 1.14, 0.31, height, 0.22, 0.003).rotation.y = 0.19;
  }
  lampProfile([[0, 0], [0.056, 0], [0.075, 0.008], [0.105, 0.029], [0.126, 0.056],
    [0.117, 0.056], [0.094, 0.031], [0.065, 0.014], [0, 0.014]],
    new THREE.MeshStandardMaterial({color: '#d5c2a3', roughness: 0.58}), -2.85, 0.402, 0.97);
  for (let i = 0; i < 24; i++) {
    mesh(new THREE.BoxGeometry(0.075, 2.88, 0.09), walnut, -5.5 + i * 0.14, 1.45, -3.86);
  }
  add('#352a23', -3.9, 1.79, -3.76, 1.48, 1.14, 0.075);
  add('#b76a4b', -3.9, 1.79, -3.714, 1.39, 1.05, 0.025);
  add('#e3a064', -4.15, 1.99, -3.698, 0.72, 0.57, 0.012);
  add('#743e3c', -3.67, 1.57, -3.694, 0.78, 0.36, 0.012);
  rounded(olive, -3.9, 0.38, -3.46, 2.55, 0.53, 0.57, 0.04);
  for (const x of [-4.7, -3.9, -3.1]) {
    add('#52594b', x, 0.38, -3.16, 0.78, 0.46, 0.025);
    mesh(new THREE.BoxGeometry(0.14, 0.024, 0.03), brass, x, 0.51, -3.135);
  }
  cylinder(iron, -5.3, 0.045, -2.98, 0.23, 0.23, 0.09);
  cylinder(brass, -5.3, 0.92, -2.98, 0.019, 0.022, 1.77);
  cylinder('#d9be91', -5.3, 1.77, -2.98, 0.18, 0.3, 0.28);

  const potX = -5.18;
  const potZ = 3.39;
  lampProfile([[0, 0], [0.16, 0], [0.187, 0.015], [0.224, 0.22],
    [0.22, 0.39], [0.213, 0.415], [0.196, 0.415], [0.19, 0.365]],
    new THREE.MeshStandardMaterial({color: '#b29980', roughness: 0.91}), potX, 0.005, potZ);
  cylinder('#4c3b2c', potX, 0.36, potZ, 0.191, 0.19, 0.027);
  const trunk = cylinder('#79634a', potX, 1.11, potZ, 0.011, 0.028, 1.49);
  trunk.rotation.z = 0.042;
  const leafMaterials = ['#405b2e', '#344d2b', '#546936'].map(color =>
    new THREE.MeshStandardMaterial({color, roughness: 0.62, side: THREE.DoubleSide}));
  for (let i = 0; i < 15; i++) {
    const angle = i * 2.399;
    const height = 0.77 + i * 0.078;
    const length = 0.31 + 0.07 * Math.sin(i * 1.73);
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const across = new THREE.Vector3(-direction.z, 0, direction.x);
    const stemStart = new THREE.Vector3(potX - (height - 1.11) * 0.042, height, potZ);
    const root = stemStart.clone().addScaledVector(direction, 0.12);
    root.y += 0.06;
    const stem = cylinder('#77764a', 0, 0, 0, 0.003, 0.005, root.distanceTo(stemStart));
    stem.position.copy(root).lerp(stemStart, 0.5);
    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), root.clone().sub(stemStart).normalize());
    function bladePoint(t, u) {
      const width = 0.115 * Math.sin(Math.PI * t) ** 0.72 *
        (1 - 0.24 * Math.exp(-((t - 0.4) ** 2) / 0.016));
      const point = direction.clone().multiplyScalar(t * length).addScaledVector(across, u * width);
      point.y = 0.13 * Math.sin(t * 2.05) - 0.09 * t * t
        - 0.035 * u * u * Math.sin(Math.PI * t) + 0.01 * u * Math.sin(t * 23);
      return point;
    }
    const blade = new THREE.PlaneGeometry(2, 1, 10, 22);
    const points = blade.attributes.position;
    for (let j = 0; j < points.count; j++) {
      const point = bladePoint(0.5 - points.getY(j), points.getX(j));
      points.setXYZ(j, point.x, point.y, point.z);
    }
    blade.computeVertexNormals();
    mesh(blade, leafMaterials[i % 3], root.x, root.y, root.z);
    const midrib = [];
    for (let j = 0; j <= 10; j++) {
      const point = bladePoint(j / 10, 0);
      point.y += 0.0015;
      midrib.push(point);
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(midrib), 16, 0.0016, 5, false),
      '#82935d', root.x, root.y, root.z).castShadow = false;
  }

  // Veins follow the slab across its top and edges.
  const marble = new THREE.MeshPhysicalMaterial({color: '#0a0b0c', roughness: 0.17, clearcoat: 0.96, clearcoatRoughness: 0.08});
  marble.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 slabPosition;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n slabPosition = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = `
      varying vec3 slabPosition;

      // Each finite vein has its own origin, direction, curvature and taper.
      float marbleVein(vec2 p, vec2 origin, vec2 axis, float length, float bend, float width) {
        vec2 delta = p - origin;
        float along = dot(delta, axis) / length;
        float across = dot(delta, vec2(-axis.y, axis.x));
        float curve = bend * along * along + 0.026 * sin(along * 9.0)
          + 0.011 * sin(along * 21.0 + bend * 8.0);
        float taper = smoothstep(0.0, 0.18, along) * (1.0 - smoothstep(0.64, 1.0, along));
        float d = abs(across - curve);
        float band = width * (0.54 + taper * 0.46);
        return exp(-d / band) * taper;
      }
    ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 p = slabPosition.xz + (slabPosition.y - 1.0) * vec2(0.35, -0.28);
      float veins = marbleVein(p, vec2(2.39, -2.58), vec2(0.85, 0.527), 1.79, 0.13, 0.010);
      veins += marbleVein(p, vec2(3.02, -2.17), vec2(0.985, 0.173), 0.91, 0.23, 0.005);
      veins += marbleVein(p, vec2(3.28, -2.00), vec2(0.79, -0.613), 0.68, -0.12, 0.004);
      veins += marbleVein(p, vec2(4.69, -2.57), vec2(-0.38, 0.925), 1.32, -0.14, 0.009);
      veins += marbleVein(p, vec2(4.46, -2.03), vec2(-0.82, 0.572), 0.81, -0.09, 0.004);
      veins += marbleVein(p, vec2(4.36, -1.84), vec2(0.62, 0.784), 0.65, -0.09, 0.005);
      veins += marbleVein(p, vec2(2.37, -1.52), vec2(0.97, -0.243), 0.88, -0.08, 0.007);
      veins += marbleVein(p, vec2(2.45, -3.88), vec2(0.96, 0.28), 2.03, 0.21, 0.009);
      veins += marbleVein(p, vec2(3.48, -3.57), vec2(0.77, -0.638), 0.88, 0.10, 0.004);
      veins += marbleVein(p, vec2(5.83, -3.90), vec2(-0.8, 0.6), 1.35, -0.03, 0.007);
      float mottling = sin(p.x * 15.0 + sin(p.y * 13.0)) * cos(p.y * 16.0 - p.x * 5.0);
      diffuseColor.rgb *= 1.0 + mottling * 0.13;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.75, 0.76),
        clamp(veins * 0.88, 0.0, 0.95));`);
    shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
      // Approximate the reflections of the two warm pendant diffusers on the horizontal slabs.
      vec3 reflected = reflect(normalize(slabPosition - cameraPosition), vec3(0.0, 1.0, 0.0));
      vec2 hit = slabPosition.xz + reflected.xz * ((2.21 - slabPosition.y) / max(reflected.y, 0.05));
      float leftGlow = exp(-18.0 * dot(hit - vec2(3.12, -1.96), hit - vec2(3.12, -1.96)));
      float rightGlow = exp(-18.0 * dot(hit - vec2(4.18, -1.96), hit - vec2(4.18, -1.96)));
      float slabTop = step(0.979, slabPosition.y);
      outgoingLight += vec3(0.38, 0.23, 0.115) * (leftGlow + rightGlow) * slabTop;
      gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
  };
  const cabinetFrame = '#202b24';
  add(cabinetFrame, 4.14, 2.17, -3.82, 3.14, 0.81, 0.28);
  const cabinetDoor = new THREE.MeshStandardMaterial({color: '#26372d', roughness: 0.82});
  const cabinetPanel = new THREE.MeshStandardMaterial({color: '#304438', roughness: 0.79});
  for (let i = 0; i < 5; i++) {
    const x = 2.9 + i * 0.62;
    add(cabinetFrame, x, 0.45, -3.65, 0.618, 0.76, 0.6);
    rounded(cabinetDoor, x, 0.452, -3.324, 0.605, 0.753, 0.061, 0.014);
    rounded(cabinetPanel, x, 0.452, -3.292, 0.52, 0.665, 0.016, 0.005);
    cylinder(brass, x + 0.194, 0.703, -3.257, 0.01, 0.01, 0.115);
    for (const y of [0.663, 0.743]) add('#a58960', x + 0.194, y, -3.274, 0.016, 0.015, 0.032);
    rounded(cabinetDoor, x, 2.16, -3.655, 0.607, 0.783, 0.096, 0.016);
    rounded(cabinetPanel, x, 2.19, -3.605, 0.516, 0.669, 0.021, 0.006);
    cylinder(brass, x + 0.17, 1.878, -3.57, 0.012, 0.012, 0.109);
    for (const y of [1.84, 1.92]) {
      mesh(new THREE.BoxGeometry(0.019, 0.017, 0.031), brass, x + 0.17, y, -3.582);
    }
  }
  add('#3d433a', 4.14, 0.045, -3.65, 3.03, 0.09, 0.56);
  const counter = new THREE.Shape();
  counter.moveTo(2.55, 3.165);
  counter.lineTo(5.75, 3.165);
  counter.lineTo(5.75, 3.995);
  counter.lineTo(2.55, 3.995);
  counter.closePath();
  const opening = new THREE.Path();
  opening.moveTo(2.75, 3.35);
  opening.lineTo(2.75, 3.76);
  opening.lineTo(3.32, 3.76);
  opening.lineTo(3.32, 3.35);
  opening.closePath();
  counter.holes.push(opening);
  const counterGeometry = new THREE.ExtrudeGeometry(counter, {depth: 0.076, bevelEnabled: false});
  counterGeometry.rotateX(-Math.PI / 2);
  mesh(counterGeometry, marble, 0, 0.908, 0);
  const charcoal = mineralFinish('#343335', 0.006, 1.28, 61);
  texturedWall(charcoal, 4.15, 1.38, -3.9, 3.2, 0.79, 0.038, 0.82);
  const steel = new THREE.MeshStandardMaterial({color: '#84908f', metalness: 0.52, roughness: 0.31});
  const basin = new THREE.BufferGeometry();
  const vertices = [];
  for (const [halfWidth, halfDepth, y] of [[0.286, 0.206, 0.98], [0.245, 0.161, 0.835]]) {
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      vertices.push(x * halfWidth, y, z * halfDepth);
    }
  }
  basin.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  basin.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7]);
  basin.computeVertexNormals();
  steel.side = THREE.DoubleSide;
  mesh(basin, steel, 3.035, 0, -3.555);
  cylinder(iron, 3.035, 0.838, -3.555, 0.037, 0.037, 0.006);
  cylinder(brass, 3.02, 0.993, -3.82, 0.044, 0.044, 0.019);
  const faucetCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.02, 0.99, -3.82), new THREE.Vector3(3.02, 1.24, -3.82),
    new THREE.Vector3(3.02, 1.32, -3.68), new THREE.Vector3(3.02, 1.22, -3.58)
  ]);
  mesh(new THREE.TubeGeometry(faucetCurve, 40, 0.019, 16, false), brass, 0, 0, 0);
  cylinder(brass, 3.02, 1.077, -3.82, 0.031, 0.034, 0.154);
  cylinder(brass, 3.02, 1.209, -3.58, 0.021, 0.02, 0.035);
  cylinder(iron, 3.02, 1.19, -3.58, 0.016, 0.016, 0.004);
  const valve = cylinder(brass, 3.066, 1.065, -3.82, 0.023, 0.023, 0.071);
  valve.rotation.z = Math.PI / 2;
  cylinder(brass, 3.1, 1.106, -3.82, 0.006, 0.007, 0.095);
  add('#222927', 4.81, 0.993, -3.57, 0.72, 0.02, 0.48);
  for (const x of [4.61, 4.99]) {
    for (const z of [-3.7, -3.45]) {
      const ring = mesh(new THREE.TorusGeometry(0.08, 0.004, 6, 20), '#8c9290', x, 1.006, z);
      ring.rotation.x = -Math.PI / 2;
    }
  }
  const islandOak = surface('#c4a17b', 'wood', 1, 2);
  rounded('#8b6d50', 3.65, 0.453, -1.96, 2.10, 0.9, 0.90, 0.035);
  for (let i = 0; i < 54; i++) {
    const x = 2.61 + i * 0.039;
    mesh(new THREE.BoxGeometry(0.028, 0.862, 0.023), islandOak, x, 0.469, -1.501);
  }
  for (const x of [2.59, 4.71]) {
    for (let i = 0; i < 22; i++) {
      mesh(new THREE.BoxGeometry(0.022, 0.862, 0.028), islandOak, x, 0.469, -2.38 + i * 0.04);
    }
  }
  rounded(marble, 3.65, 0.95, -1.96, 2.35, 0.106, 1.12, 0.014);
  const contactTile = document.createElement('canvas');
  contactTile.width = contactTile.height = 128;
  const contactContext = contactTile.getContext('2d');
  const contactGradient = contactContext.createRadialGradient(64, 64, 20, 64, 64, 64);
  contactGradient.addColorStop(0, 'rgba(45,31,20,0.48)');
  contactGradient.addColorStop(0.58, 'rgba(45,31,20,0.25)');
  contactGradient.addColorStop(1, 'rgba(45,31,20,0)');
  contactContext.fillStyle = contactGradient;
  contactContext.fillRect(0, 0, 128, 128);
  const contact = mesh(new THREE.PlaneGeometry(3.05, 1.67), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(contactTile), transparent: true, depthWrite: false
  }), 3.65, 0.004, -1.96);
  contact.rotation.x = -Math.PI / 2;
  contact.castShadow = contact.receiveShadow = false;
  const stoolFabric = wovenFabric('#e7d8c2', 0.0033);
  const blackMetal = new THREE.MeshStandardMaterial({color: '#202020', metalness: 0.32, roughness: 0.83});
  const pendant = new THREE.MeshStandardMaterial({color: '#0c0c0e', roughness: 0.83});
  const pendantDiffuser = new THREE.MeshStandardMaterial({
    color: '#c09348', emissive: '#ffbe6f', emissiveIntensity: 0.48, roughness: 0.57
  });
  for (const x of [3.12, 4.18]) {
    const z = -1.04;
    scaleFabric(cushion(stoolFabric, x, 0.621, z, 0.432, 0.086, 0.405, '#a08d74'),
      0.432, 0.086, 0.405);
    const back = cushion(stoolFabric, x, 0.773, z + 0.173, 0.414, 0.072, 0.269, '#a08d74');
    back.rotation.x = Math.PI / 2 + 0.13;
    scaleFabric(back, 0.414, 0.072, 0.269);
    for (const dx of [-0.16, 0.16]) {
      for (const dz of [-0.14, 0.14]) {
        const leg = cylinder(blackMetal, x + dx, 0.297, z + dz, 0.012, 0.011, 0.6);
        leg.rotation.set(-Math.sign(dz) * 0.075, 0, Math.sign(dx) * 0.075);
      }
      cylinder(blackMetal, x + dx, 0.68, z + 0.159, 0.011, 0.011, 0.18);
    }
    mesh(new THREE.BoxGeometry(0.366, 0.018, 0.018), blackMetal, x, 0.24, z - 0.153);
    cylinder(brass, x, 2.63, -1.96, 0.009, 0.009, 0.53);
    lampProfile([[0.237, 0], [0.231, 0.022], [0.202, 0.067], [0.15, 0.112],
      [0.073, 0.146], [0.033, 0.155], [0.033, 0.188]], pendant, x, 2.215, -1.96);
    cylinder(pendantDiffuser, x, 2.218, -1.96, 0.227, 0.227, 0.007);
  }
  const bowlMaterial = new THREE.MeshStandardMaterial({color: '#aea18d', roughness: 0.3});
  lampProfile([[0, 0], [0.105, 0], [0.11, 0.015], [0.148, 0.026], [0.195, 0.057],
    [0.227, 0.105], [0.229, 0.119], [0.22, 0.12], [0.204, 0.091], [0.17, 0.059],
    [0.102, 0.033], [0, 0.033]], bowlMaterial, 3.97, 1, -1.99);

  function fruit(x, y, z, kind, angle) {
    const skinColors = {apple: '#b74e32', pear: '#a6a14d', orange: '#de8d37'};
    const skin = surface(skinColors[kind], 'stone', 2, 2);
    const geometry = new THREE.SphereGeometry(1, 36, 24);
    const points = geometry.attributes.position;
    const colors = [];
    const tint = new THREE.Color();
    for (let i = 0; i < points.count; i++) {
      const px = points.getX(i), py = points.getY(i), pz = points.getZ(i);
      const azimuth = Math.atan2(pz, px);
      const lobes = 1 + 0.045 * Math.cos(azimuth * 5) * Math.abs(py);
      const taper = kind === 'pear' ? 1 - 0.32 * py : 1 + 0.07 * py;
      const dimple = kind === 'orange' ? 0.035 : 0.16;
      points.setXYZ(i, px * 0.071 * taper * lobes,
        (py - Math.sign(py) * dimple * Math.abs(py) ** 12) * (kind === 'pear' ? 0.1 : 0.071),
        pz * 0.069 * taper * lobes);
      const blush = 0.73 + 0.25 * (0.5 + 0.5 * Math.sin(azimuth * 3 + py * 3));
      tint.setRGB(1, blush, 0.89 + 0.11 * blush);
      colors.push(tint.r, tint.g, tint.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    skin.vertexColors = true;
    skin.roughness = kind === 'orange' ? 0.78 : 0.49;
    const body = mesh(geometry, skin, x, y, z);
    body.rotation.set(0.12, angle, angle * 0.21);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.005, 0.027, 8),
      new THREE.MeshStandardMaterial({color: '#5a422c', roughness: 0.9}));
    stem.position.y = kind === 'pear' ? 0.09 : 0.07;
    stem.rotation.z = 0.24;
    body.add(stem);
  }
  fruit(3.865, 1.111, -1.978, 'apple', -0.7);
  fruit(4.045, 1.129, -2.035, 'pear', 0.85);
  fruit(4.02, 1.108, -1.896, 'apple', 0.4);
  fruit(3.91, 1.166, -2.081, 'pear', -1.05);

  rounded(rug, 3.75, 0.016, 2.05, 3.6, 0.03, 3.2, 0.012);
  const percale = wovenFabric('#f2ebdc', 0.00085);
  const duvetLinen = wovenFabric('#ded4c1', 0.0015);
  const velvet = wovenFabric('#493027', 0.0017);
  velvet.roughness = 0.88;
  velvet.sheen.set('#ae735b');
  const bedroomWalnut = new THREE.MeshPhysicalMaterial({
    color: '#593820', roughness: 0.42, clearcoat: 0.38, clearcoatRoughness: 0.34
  });
  bedroomWalnut.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 woodPoint;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n woodPoint = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 woodPoint;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', `#include <color_fragment>
      float grainX = woodPoint.x + woodPoint.z * 0.62;
      float warp = sin(woodPoint.y * 4.2 + grainX * 9.0) * 0.015
        + sin(woodPoint.y * 11.0 + grainX * 5.0) * 0.005;
      float band = sin((grainX + warp) * 158.0 + sin(grainX * 37.0) * 0.6);
      float pores = sin((grainX + warp) * 478.0) * sin(woodPoint.y * 103.0);
      diffuseColor.rgb *= 0.91 + 0.17 * band + 0.14 * sin(grainX * 21.0) + pores * 0.035;`);
  };
  const headboardFabric = wovenFabric('#ad9b86', 0.0025);
  const bedX = 3.85;

  // Recessed plinth and individually upholstered rails.
  rounded('#3b3028', bedX, 0.067, 2.14, 1.88, 0.13, 2.35, 0.045);
  for (const side of [-1, 1]) {
    const rail = rounded(headboardFabric, bedX + side * 0.985, 0.26, 2.16, 0.25, 0.38, 2.53, 0.1);
    scaleFabric(rail, 0.25, 0.38, 2.53, 9);
    const foot = rounded(headboardFabric, bedX + side * 0.55, 0.265, 0.935, 1.09, 0.39, 0.25, 0.1);
    scaleFabric(foot, 1.09, 0.39, 0.25, 9);
  }
  scaleFabric(rounded(percale, bedX, 0.501, 2.16, 2.03, 0.29, 2.48, 0.095),
    2.03, 0.29, 2.48, 15);

  rounded('#2c211a', bedX, 0.82, 3.58, 2.24, 1.41, 0.16, 0.068);
  for (let i = 0; i < 26; i++) {
    rounded(bedroomWalnut, bedX + (i - 12.5) * 0.084, 0.82, 3.483,
      0.071, 1.39, 0.118, 0.017);
  }

  // Sample the same cloth surface for its mesh and its sewn edges.
  function bedCloth(material, width, length, position, hemColor, density) {
    const geometry = new THREE.PlaneGeometry(width, length, 96, 64);
    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const point = position(vertices.getX(i), -vertices.getY(i));
      vertices.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.computeVertexNormals();
    material.side = THREE.DoubleSide;
    const cloth = mesh(geometry, material, bedX, 0, 0);
    scaleFabric(cloth, width, 0, length, density);
    const edge = [];
    for (const [ax, az, bx, bz] of [
      [-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]
    ]) {
      for (let i = 0; i < 48; i++) {
        const t = i / 48;
        edge.push(position((ax + (bx - ax) * t) * width / 2, (az + (bz - az) * t) * length / 2));
      }
    }
    cloth.add(new THREE.Mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(edge, true), 256, 0.0045, 6, true
    ), new THREE.MeshStandardMaterial({color: hemColor, roughness: 0.96})));
    return cloth;
  }

  function duvetPoint(x, z) {
    const side = Math.max(0, (Math.abs(x) - 0.87) / 0.36);
    const foot = Math.max(0, (-z - 0.98) / 0.17);
    const fall = Math.max(side, foot);
    const fold = Math.sin(x * 11 + z * 4 + Math.sin(z * 5))
      + 0.48 * Math.sin(x * 24 - z * 11);
    const turn = Math.exp(-((z - 0.95) ** 2) / 0.011);
    return new THREE.Vector3(
      x - Math.sign(x) * 0.105 * side ** 2 + 0.018 * Math.sin(z * 9) * fall,
      0.735 + 0.031 * turn + fold * (0.011 + 0.014 * fall) - 0.215 * fall ** 1.65,
      1.94 + z + 0.035 * foot ** 2
    );
  }
  bedCloth(duvetLinen, 2.46, 2.30, duvetPoint, '#b7ab95', 12);

  // A heavier throw crosses the bed, with long folds and a darker bound edge.
  function throwPoint(x, z) {
    const point = duvetPoint(x * 0.95, z - 0.43 + 0.035 * Math.sin(x * 2.2));
    const edge = Math.max(0, (Math.abs(x) - 1.03) / 0.26);
    point.x += Math.sign(x) * (0.021 + 0.033 * edge);
    point.y += 0.029 + 0.015 * Math.cos(z * 19 + x * 3) - 0.095 * edge ** 2;
    point.z += 0.015 * Math.sin(x * 8);
    return point;
  }
  const blanket = bedCloth(velvet, 2.58, 0.58, throwPoint, '#68473b', 12);
  const strands = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 50; i++) {
      const point = throwPoint(side * 1.29, -0.285 + i * 0.0116);
      const length = 0.025 + 0.012 * (1 + Math.sin(i * 2.4 + side));
      strands.push(point.x, point.y, point.z,
        point.x + side * 0.012, point.y - length, point.z + 0.005 * Math.sin(i));
    }
  }
  const fringe = new THREE.BufferGeometry();
  fringe.setAttribute('position', new THREE.Float32BufferAttribute(strands, 3));
  blanket.add(new THREE.LineSegments(fringe, new THREE.LineBasicMaterial({color: '#9a8a7d'})));

  const pillowSilk = wovenFabric('#eee1c9', 0.0011);
  pillowSilk.roughness = 0.64;
  for (const side of [-1, 1]) {
    const back = cushion(pillowSilk, bedX + side * 0.492, 0.913 + side * 0.012,
      3.185, 0.73, 0.237, 0.65, '#ede0ca');
    back.rotation.set(1.07, side * 0.062, side * 0.055);
    scaleFabric(back, 0.73, 0.237, 0.65, 16);
    const front = cushion(pillowSilk, bedX + side * 0.41, 0.823,
      2.953 - side * 0.024, 0.84, 0.18, 0.39, '#dfcdb1');
    front.rotation.set(0.77, -side * 0.095, side * 0.045);
    scaleFabric(front, 0.84, 0.18, 0.39, 16);
  }
  const bedsidePositions = [2.37, 5.24];
  const shadeFabric = wovenFabric('#8e7861', 0.0011);
  shadeFabric.roughness = 0.65;
  shadeFabric.sheen.set('#d6bda0');
  const agedBrass = new THREE.MeshPhysicalMaterial({
    color: '#a57c43', metalness: 0.57, roughness: 0.28, clearcoat: 0.34
  });
  shadeFabric.map.repeat.set(12, 3);
  shadeFabric.bumpMap.repeat.copy(shadeFabric.map.repeat);
  const shadeLining = new THREE.MeshStandardMaterial({
    color: '#d6c09e', roughness: 0.94, emissive: '#e5a35c', emissiveIntensity: 0
  });
  const lampBulb = new THREE.MeshStandardMaterial({
    color: '#fff1d4', roughness: 0.46, emissive: '#ffc481', emissiveIntensity: 0
  });
  function lampProfile(points, material, x, y, z) {
    const profile = points.map(([radius, height]) => new THREE.Vector2(radius, height));
    return mesh(new THREE.LatheGeometry(profile, 48), material, x, y, z);
  }

  for (const x of bedsidePositions) {
    rounded(bedroomWalnut, x, 0.39, 3.12, 0.57, 0.48, 0.53, 0.045);
    rounded(bedroomWalnut, x, 0.45, 2.846, 0.51, 0.22, 0.026, 0.008);
    mesh(new THREE.BoxGeometry(0.12, 0.021, 0.028), brass, x, 0.47, 2.826);
    const z = 3.16;
    lampProfile([[0, 0], [0.098, 0], [0.112, 0.008], [0.112, 0.022],
      [0.103, 0.033], [0.042, 0.042], [0, 0.042]], agedBrass, x, 0.63, z);
    cylinder(agedBrass, x, 0.784, z, 0.012, 0.017, 0.235);
    cylinder(iron, x, 0.897, z, 0.024, 0.024, 0.052);
    ellipsoid(lampBulb, x, 0.96, z, 0.038, 0.056, 0.038);
    // Open drum: fabric outside, warm lining inside, and rolled rims.
    lampProfile([[0.141, 0], [0.137, 0.01], [0.116, 0.197], [0.118, 0.207]],
      shadeFabric, x, 0.907, z);
    lampProfile([[0.113, 0.204], [0.112, 0.194], [0.133, 0.01], [0.136, 0]],
      shadeLining, x, 0.907, z);
    for (const [radius, y] of [[0.138, 0.907], [0.116, 1.114]]) {
      const rim = mesh(new THREE.TorusGeometry(radius, 0.004, 8, 48), iron, x, y, z);
      rim.rotation.x = Math.PI / 2;
    }
  }

  const diffuser = new THREE.MeshPhysicalMaterial({
    color: '#593624', roughness: 0.25, clearcoat: 0.72
  });
  lampProfile([[0, 0], [0.041, 0], [0.046, 0.009], [0.046, 0.075],
    [0.023, 0.091], [0.023, 0.108], [0, 0.108]], diffuser, 5.39, 0.63, 2.98);
  cylinder(agedBrass, 5.39, 0.729, 2.98, 0.024, 0.024, 0.014);
  for (let i = 0; i < 5; i++) {
    const reed = cylinder('#6e4d34', 5.39, 0.806, 2.98, 0.0019, 0.0022, 0.16);
    reed.rotation.set(Math.sin(i * 2.4) * 0.31, 0, Math.cos(i * 2.4) * 0.32);
  }

  // Bathroom off the central passage, using the existing rear wall and kitchen partition.
  const bathroomStone = mineralFinish('#c9b69b', 0.0042, 0.82, 73);
  bathroomStone.roughness = 0.68;
  bathroomStone.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 stonePosition;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n stonePosition = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 stonePosition;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', `#include <color_fragment>
      vec3 p = stonePosition;
      float strata = sin(p.y * 32.0 + p.z * 18.0 + p.x * 2.4
        + 0.75 * sin(p.x * 8.0 + p.z * 6.0));
      float bands = pow(0.5 + 0.5 * strata, 6.0);
      diffuseColor.rgb *= 0.96 + 0.08 * strata - 0.12 * bands;`);
  };
  const porcelain = new THREE.MeshPhysicalMaterial({
    color: '#f5f0e8', roughness: 0.22, clearcoat: 0.55
  });
  texturedWall(partitionPlaster, -1.13, 1.45, -2.91, 0.12, 2.9, 2.18);
  texturedWall(partitionPlaster, -0.83, 1.45, -1.82, 0.52, 2.9, 0.12);
  texturedWall(partitionPlaster, 0.67, 1.45, -1.82, 0.56, 2.9, 0.12);
  texturedWall(partitionPlaster, -0.095, 2.57, -1.82, 0.95, 0.66, 0.12);
  for (const x of [-0.575, 0.39]) add('#796047', x, 1.11, -1.81, 0.036, 2.22, 0.14);
  add('#796047', -0.095, 2.22, -1.81, 0.99, 0.04, 0.14);

  // Cut stone panels with narrow recessed joints.
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      texturedWall(bathroomStone, -0.855 + col * 0.507, 0.016, -3.66 + row * 0.523,
        0.503, 0.027, 0.519);
      texturedWall(bathroomStone, -0.855 + col * 0.507, 0.29 + row * 0.58, -3.903,
        0.503, 0.576, 0.033);
    }
  }

  // Floating walnut vanity, ceramic vessel and aged brass fittings.
  rounded(bedroomWalnut, -0.656, 0.63, -2.71, 0.76, 0.40, 0.47, 0.036);
  for (const z of [-2.883, -2.54]) {
    rounded(bedroomWalnut, -0.415, 0.65, z, 0.025, 0.322, 0.30, 0.008);
    mesh(new THREE.BoxGeometry(0.025, 0.015, 0.12), agedBrass, -0.393, 0.754, z);
  }
  texturedWall(bathroomStone, -0.655, 0.857, -2.71, 0.79, 0.06, 0.49);
  lampProfile([[0, 0], [0.091, 0], [0.15, 0.03], [0.172, 0.081], [0.174, 0.105],
    [0.165, 0.105], [0.149, 0.071], [0.092, 0.034], [0, 0.034]],
    porcelain, -0.61, 0.89, -2.71);
  cylinder(agedBrass, -0.61, 0.926, -2.71, 0.019, 0.019, 0.006);
  const soapGlass = new THREE.MeshPhysicalMaterial({
    color: '#8d6144', roughness: 0.24, clearcoat: 0.62
  });
  rounded(soapGlass, -0.7, 0.951, -2.42, 0.063, 0.122, 0.064, 0.017);
  cylinder(agedBrass, -0.7, 1.022, -2.42, 0.012, 0.014, 0.025);
  add('#8f6c40', -0.685, 1.039, -2.42, 0.04, 0.01, 0.013);
  const basinTap = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.905, 0.89, -2.71), new THREE.Vector3(-0.905, 1.101, -2.71),
    new THREE.Vector3(-0.808, 1.146, -2.71), new THREE.Vector3(-0.747, 1.075, -2.71)
  ]);
  mesh(new THREE.TubeGeometry(basinTap, 28, 0.012, 12, false), agedBrass, 0, 0, 0);
  cylinder(agedBrass, -0.905, 0.904, -2.71, 0.025, 0.025, 0.026);
  const mirror = new THREE.MeshPhysicalMaterial({
    color: '#a9b4b5', metalness: 0.65, roughness: 0.17, clearcoat: 1
  });
  const mirrorGlass = cylinder(mirror, -1.053, 1.54, -2.71, 0.344, 0.344, 0.018);
  mirrorGlass.rotation.z = Math.PI / 2;
  const mirrorRim = mesh(new THREE.TorusGeometry(0.35, 0.008, 8, 64),
    agedBrass, -1.039, 1.54, -2.71);
  mirrorRim.rotation.y = Math.PI / 2;

  // Walk-in shower with a clear fixed screen, fittings and linear drain.
  texturedWall(bathroomStone, 0.36, 0.051, -3.434, 1.01, 0.063, 0.92);
  add('#454545', 0.4, 0.085, -3.765, 0.46, 0.008, 0.029);
  const showerGlass = mesh(new THREE.PlaneGeometry(0.58, 1.99), glass, 0.594, 1.081, -2.982);
  showerGlass.castShadow = showerGlass.receiveShadow = false;
  add(iron, 0.878, 1.081, -2.982, 0.024, 2.0, 0.025);
  add(iron, 0.594, 0.088, -2.982, 0.58, 0.022, 0.025);
  cylinder(agedBrass, 0.51, 1.69, -3.855, 0.012, 0.012, 1.02);
  add('#997647', 0.51, 2.195, -3.73, 0.022, 0.023, 0.26);
  cylinder(agedBrass, 0.51, 2.175, -3.61, 0.117, 0.117, 0.024);
  cylinder('#5c5146', 0.51, 2.161, -3.61, 0.104, 0.104, 0.006);
  for (const [radius, count] of [[0.032, 7], [0.062, 12], [0.089, 18]]) {
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      cylinder('#a18d76', 0.51 + radius * Math.cos(angle), 2.156,
        -3.61 + radius * Math.sin(angle), 0.0022, 0.0022, 0.005);
    }
  }
  for (let i = 0; i < 16; i++) {
    add('#82766a', 0.195 + i * 0.027, 0.09, -3.765, 0.013, 0.003, 0.021);
  }
  const towelFabric = wovenFabric('#ded7c8', 0.0045);
  towelFabric.side = THREE.DoubleSide;
  const towelGeometry = new THREE.PlaneGeometry(0.39, 0.42, 32, 24);
  const towelPoints = towelGeometry.attributes.position;
  for (let i = 0; i < towelPoints.count; i++) {
    const x = towelPoints.getX(i);
    const y = towelPoints.getY(i);
    towelPoints.setZ(i, Math.sin(x * 68 + y * 3) * (0.006 + (0.21 - y) * 0.029));
  }
  towelGeometry.rotateY(-Math.PI / 2);
  towelGeometry.computeVertexNormals();
  scaleFabric(mesh(towelGeometry, towelFabric, 0.831, 0.99, -2.41), 0.39, 0.42, 0.02, 10);
  const towelRail = cylinder(agedBrass, 0.821, 1.203, -2.41, 0.009, 0.009, 0.46);
  towelRail.rotation.x = Math.PI / 2;
  for (const z of [-2.62, -2.20]) add('#997647', 0.849, 1.203, z, 0.059, 0.018, 0.018);
  cylinder(agedBrass, 0.51, 1.17, -3.848, 0.043, 0.043, 0.028).rotation.x = Math.PI / 2;

  // Compact toilet faces the passage from the rear corner.
  rounded(porcelain, -0.42, 0.55, -3.73, 0.40, 0.43, 0.19, 0.055);
  ellipsoid(porcelain, -0.42, 0.23, -3.48, 0.149, 0.22, 0.206);
  const toiletSeat = mesh(new THREE.TorusGeometry(0.155, 0.033, 12, 48),
    porcelain, -0.42, 0.42, -3.438);
  toiletSeat.rotation.x = -Math.PI / 2;
  toiletSeat.scale.y = 1.28;
  const water = new THREE.MeshStandardMaterial({color: '#bec7c7', roughness: 0.15});
  ellipsoid(water, -0.42, 0.395, -3.438, 0.121, 0.014, 0.16);
  add('#a88e64', -0.42, 0.767, -3.73, 0.075, 0.008, 0.038);

  const bathroomLight = new THREE.PointLight('#ffe1be', 0.79, 4.1, 2);
  bathroomLight.position.set(-0.08, 2.49, -2.68);
  scene.add(bathroomLight);
  const bathroomDiffuser = new THREE.MeshStandardMaterial({
    color: '#f2deca', emissive: '#f3bc7e', emissiveIntensity: 0.55, roughness: 0.52
  });
  cylinder(bathroomDiffuser, -0.08, 2.86, -2.68, 0.126, 0.126, 0.055);

  const ceiling = add('#eee6d9', 0, 2.94, 0, 12, 0.08, 8);
  ceiling.castShadow = false;
  ceiling.visible = false;

  // The same geometry serves the model and the eye-level views.
  const dining = rounded(walnut, -2.35, 0.756, -1.61, 1.57, 0.065, 1.14, 0.029);
  dining.rotation.y = 0.07;
  for (const dx of [-0.57, 0.57]) {
    for (const dz of [-0.36, 0.36]) {
      const leg = cylinder(walnut, -2.35 + dx, 0.365, -1.61 + dz, 0.046, 0.025, 0.73);
      leg.rotation.set(Math.sign(dz) * 0.09, 0, -Math.sign(dx) * 0.095);
    }
  }
  const seatFabric = wovenFabric('#777d6c', 0.002);
  for (const z of [-2.47, -0.76]) {
    const side = Math.sign(z + 1.61);
    const seat = cushion(seatFabric, -2.35, 0.48, z, 0.48, 0.113, 0.44, '#686b5e');
    scaleFabric(seat, 0.48, 0.113, 0.44);
    const back = cushion(seatFabric, -2.35, 0.76, z + side * 0.213,
      0.48, 0.102, 0.32, '#686b5e');
    back.rotation.x = Math.PI / 2 + side * 0.18;
    scaleFabric(back, 0.48, 0.102, 0.32);
    for (const dx of [-0.172, 0.172]) {
      for (const dz of [-0.155, 0.155]) {
        const leg = cylinder(walnut, -2.35 + dx, 0.22, z + dz, 0.026, 0.016, 0.45);
        leg.rotation.set(Math.sign(dz) * 0.09, 0, -Math.sign(dx) * 0.09);
      }
      const upright = cylinder(walnut, -2.35 + dx, 0.605, z + side * 0.195, 0.017, 0.024, 0.32);
      upright.rotation.x = side * 0.17;
    }
  }
  cylinder('#d7b194', -2.35, 0.87, -1.61, 0.095, 0.12, 0.18);
  for (const x of [-2.68, -2.02]) {
    cylinder('#e6ddc4', x, 0.8, -1.61, 0.11, 0.09, 0.025);
  }

  const curtainLinen = wovenFabric('#ddd0ba', 0.0026);
  curtainLinen.side = THREE.DoubleSide;
  const curtain = new THREE.PlaneGeometry(0.86, 2.76, 100, 28);
  const folds = curtain.attributes.position;
  for (let i = 0; i < folds.count; i++) {
    const x = folds.getX(i);
    const y = folds.getY(i);
    folds.setXYZ(i, x * (1 - 0.045 * y), y,
      Math.sin(x * 89 + y * 0.43) * (0.028 - y * 0.005) + 0.008 * Math.sin(x * 29 - y));
  }
  curtain.computeVertexNormals();
  scaleFabric(mesh(curtain, curtainLinen, 1.55, 1.45, 3.90), 0.86, 2.76, 0.07, 11);
  add(iron, 1.52, 2.86, 3.91, 0.9, 0.023, 0.035);
  const benchFabric = wovenFabric('#f0e5d0', 0.007);
  benchFabric.sheen.set('#a98e70');
  scaleFabric(rounded(benchFabric, 3.85, 0.39, 0.54, 1.65, 0.22, 0.43, 0.085),
    1.65, 0.22, 0.43, 5);
  for (const x of [3.24, 4.46]) {
    for (const z of [0.39, 0.69]) cylinder(wood, x, 0.14, z, 0.037, 0.025, 0.28);
  }

  function lampGlow(x, y, z, reach, power) {
    const light = new THREE.PointLight('#ffd398', 0, reach, 2);
    light.position.set(x, y, z);
    scene.add(light);
    return {light, power};
  }
  for (const x of [3.12, 4.18]) {
    const fill = lampGlow(x, 2.11, -1.96, 2.6, 0.53);
    fill.light.intensity = fill.power;
  }
  const warmLights = [
    lampGlow(-5.3, 1.61, -2.98, 3.8, 3.6),
    lampGlow(3.12, 2.04, -1.96, 3.6, 4.3),
    lampGlow(4.18, 2.04, -1.96, 3.6, 4.3)
  ];

  for (const x of bedsidePositions) {
    for (const [direction, power] of [[-1, 1.2], [1, 0.4]]) {
      const light = new THREE.SpotLight('#ffbe78', 0, 1.8, 0.72, 0.75, 2);
      light.position.set(x, direction < 0 ? 0.9 : 1.115, 3.16);
      light.target.position.set(x, light.position.y + direction, 3.21);
      scene.add(light, light.target);
      warmLights.push({light, power});
    }
  }

  const sky = mesh(new THREE.SphereGeometry(79, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: {value: new THREE.Color()},
      horizon: {value: new THREE.Color()},
      glow: {value: new THREE.Color()}
    },
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 direction;
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 glow;
      void main() {
        vec3 ray = normalize(direction);
        float altitude = smoothstep(-0.14, 0.43, ray.y);
        float sunlight = pow(max(0.0, dot(ray, normalize(vec3(-0.75, 0.11, 0.8)))), 9.0);
        vec3 color = mix(horizon, zenith, altitude);
        gl_FragColor = vec4(mix(color, glow, sunlight * 0.63), 1.0);
      }
    `
  }), 0, 0, 0);
  sky.castShadow = sky.receiveShadow = false;
  sky.renderOrder = -2;

  const city = new THREE.Group();
  scene.add(city);
  const facadeMaterials = ['#657583', '#948878', '#526773', '#839098'].map(color =>
    new THREE.MeshStandardMaterial({color, roughness: 0.72}));
  const glassMaterial = new THREE.MeshStandardMaterial({color: '#344956', roughness: 0.38});
  const litWindowMaterial = new THREE.MeshStandardMaterial({
    color: '#42505a', emissive: '#ffc47d', emissiveIntensity: 0, roughness: 0.42
  });
  const roofMaterial = new THREE.MeshStandardMaterial({color: '#53616a', roughness: 0.86});
  const towers = facadeMaterials.map(() => []);
  const roofs = [];
  const darkWindows = [];
  const litWindows = [];
  function buildTower(x, z, height, width, depth, index) {
    const base = -17;
    const palette = index % facadeMaterials.length;
    towers[palette].push([x, base + height / 2, z, width, height, depth]);
    roofs.push([x, base + height, z, width + 0.09, 0.14, depth + 0.09]);
    if (index % 3 !== 1) {
      const crown = 0.6 + index % 5 * 0.23;
      towers[palette].push([x - 0.13, base + height + crown / 2, z, width * 0.63, crown, depth * 0.67]);
      roofs.push([x - 0.13, base + height + crown, z, width * 0.67, 0.12, depth * 0.71]);
    }
    const bays = Math.max(2, Math.round(width / 0.54));
    const sideBays = Math.max(2, Math.round(depth / 0.63));
    for (let row = 1; row * 0.87 < height - 0.32; row++) {
      const y = base + row * 0.87;
      const windowHeight = index % 3 === 0 ? 0.6 : 0.44;
      for (let bay = 0; bay < bays; bay++) {
        const batch = (index * 17 + row * 13 + bay * 7) % 19 < 5 ? litWindows : darkWindows;
        batch.push([x + width * ((bay + 0.5) / bays - 0.5), y,
          z - depth / 2 - 0.008, width / bays * 0.69, windowHeight, 0.019]);
      }
      for (let bay = 0; bay < sideBays; bay++) {
        const batch = (index * 11 + row * 7 + bay * 13) % 23 < 6 ? litWindows : darkWindows;
        const dz = z + depth * ((bay + 0.5) / sideBays - 0.5);
        for (const side of [-1, 1]) {
          batch.push([x + side * (width / 2 + 0.008), y, dz, 0.019, windowHeight, depth / sideBays * 0.7]);
        }
      }
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 17; i++) {
      const id = row * 17 + i;
      buildTower(-43 + i * 5.05 + Math.sin(id * 2.4) * 1.5,
        14 + row * 11 + (i % 4) * 1.35, 6 + (id * 19 % 41) * 0.37,
        1.65 + (id * 7 % 13) * 0.17, 1.7 + (id * 3 % 9) * 0.19, id);
    }
  }
  for (let i = 0; i < 12; i++) {
    buildTower(-18 - (i % 3) * 8, -24 + i * 4.25, 8 + (i * 13 % 17) * 0.7,
      2.3 + i % 4 * 0.35, 2.8, 51 + i);
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const pose = new THREE.Object3D();
  function batchCity(material, pieces) {
    const batch = new THREE.InstancedMesh(unitBox, material, pieces.length);
    pieces.forEach(([x, y, z, width, height, depth], index) => {
      pose.position.set(x, y, z);
      pose.scale.set(width, height, depth);
      pose.updateMatrix();
      batch.setMatrixAt(index, pose.matrix);
    });
    city.add(batch);
  }
  towers.forEach((pieces, index) => batchCity(facadeMaterials[index], pieces));
  batchCity(roofMaterial, roofs);
  batchCity(glassMaterial, darkWindows);
  batchCity(litWindowMaterial, litWindows);

  const views = [
    {name: 'Maqueta', eye: [13, 13, 15], target: [0, 0, 0], orbit: true},
    {name: 'Sala', eye: [-0.65, 1.47, -1.41], target: [-3.34, 0.98, 1.84]},
    {name: 'Cocina', eye: [5.02, 1.54, 0.98], target: [3.75, 1.14, -2.48]},
    {name: 'Comedor', eye: [-0.35, 1.62, 0.47], target: [-2.45, 0.76, -1.79]},
    {name: 'Habitación', eye: [4.97, 1.56, -0.72], target: [3.75, 0.83, 2.41]},
    {name: 'Baño', eye: [-0.095, 1.52, -1.62], target: [-0.17, 1.22, -3.56], fov: 68}
  ];
  const roomMenu = get('.room-menu');
  const target = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const offset = new THREE.Spherical();
  let view;
  let frame;
  let drag;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controls = views.map((item) => {
    const button = document.createElement('button');
    button.textContent = item.name;
    button.addEventListener('click', () => setView(item));
    roomMenu.append(button);
    return button;
  });
  const lightingMenu = get('.lighting-menu');
  const lightingButtons = ['Día', 'Noche'].map((label, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      setLighting(index === 1);
      render();
    });
    lightingMenu.append(button);
    return button;
  });
  function setLighting(night) {
    lightingButtons.forEach((button, index) => button.setAttribute('aria-pressed', (index === 1) === night));
    bathroomLight.intensity = night ? 1.15 : 0.79;
    ambient.intensity = night ? 0.38 : 0.94;
    ambient.color.set(night ? '#a6beff' : '#fff6e8');
    sun.intensity = night ? 0.2 : 1.75;
    sun.color.set(night ? '#91aaff' : '#ffe4bf');
    litWindowMaterial.emissiveIntensity = night ? 0.86 : 0;
    for (const {light, power} of warmLights) light.intensity = night ? power : 0;
    shadeLining.emissiveIntensity = night ? 0.42 : 0;
    lampBulb.emissiveIntensity = night ? 1.7 : 0;
    const colors = sky.material.uniforms;
    colors.zenith.value.set(night ? '#080f24' : '#7babc9');
    colors.horizon.value.set(night ? '#243650' : '#d4e4ea');
    colors.glow.value.set(night ? '#374964' : '#fff1d6');
    scene.fog.color.set(night ? '#202f48' : '#b5bec2');
  }
  setLighting(false);

  function render() {
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  function setView(item) {
    cancelAnimationFrame(frame);
    const initialEye = camera.position.clone();
    const initialTarget = target.clone();
    const first = !view;
    view = item;
    camera.fov = view.fov ?? (camera.aspect < 1 ? 66 : 53);
    camera.updateProjectionMatrix();
    drag = undefined;
    controls.forEach((button, index) => button.setAttribute('aria-pressed', views[index] === item));
    hint.textContent = item.orbit ? 'Arrastra para girar la maqueta' : 'Arrastra para mirar alrededor';
    const endTarget = new THREE.Vector3(...item.target);
    eye.set(...item.eye);
    const start = performance.now();
    function tick(now) {
      const progress = first || reduced.matches ? 1 : Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - progress) ** 3;
      camera.position.lerpVectors(initialEye, eye, eased);
      target.lerpVectors(initialTarget, endTarget, eased);
      ceiling.visible = !item.orbit && camera.position.y < 2.82;
      render();
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    tick(start);
  }
  function resize() {
    const {clientWidth: width, clientHeight: height} = scenePanel;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.fov = view?.fov ?? (camera.aspect < 1 ? 66 : 53);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }
  function rotate(dx, dy) {
    cancelAnimationFrame(frame);
    if (view.orbit) {
      offset.setFromVector3(camera.position.clone().sub(target));
      offset.theta -= dx * 0.008;
      offset.phi = THREE.MathUtils.clamp(offset.phi - dy * 0.008, 0.15, 1.42);
      camera.position.setFromSpherical(offset).add(target);
    } else {
      offset.setFromVector3(target.clone().sub(camera.position));
      offset.theta -= dx * 0.005;
      offset.phi = THREE.MathUtils.clamp(offset.phi - dy * 0.005, 0.35, 2.8);
      target.setFromSpherical(offset).add(camera.position);
    }
    render();
  }
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Apartamento 3D. Usa las flechas para girar la vista.');
  canvas.addEventListener('keydown', (event) => {
    const steps = {ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12]};
    if (!steps[event.key]) return;
    event.preventDefault();
    rotate(...steps[event.key]);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (drag) return;
    canvas.setPointerCapture(event.pointerId);
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
  });
  canvas.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    rotate(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('lostpointercapture', () => { drag = undefined; });
  new ResizeObserver(resize).observe(stage);
  setView(views[0]);
  return {resize};
}
