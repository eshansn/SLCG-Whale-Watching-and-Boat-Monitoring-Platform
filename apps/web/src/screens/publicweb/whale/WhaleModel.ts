import * as THREE from 'three';

export type WhaleUniforms = ReturnType<typeof createWhaleUniforms>;

export function createWhaleUniforms() {
  return {
    uTime: { value: 0 }, uOpacity: { value: 0 }, uDepth: { value: 0 },
    uBase: { value: new THREE.Color('#03131f') }, uLight: { value: new THREE.Color('#0a4558') },
    uCyan: { value: new THREE.Color('#35e6f7') }, uAqua: { value: new THREE.Color('#8af5ff') },
  };
}

function whaleMaterial(uniforms: WhaleUniforms, line = false) {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uLine: { value: line ? 1 : 0 } },
    transparent: true, depthWrite: !line, toneMapped: false,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime, uOpacity, uDepth, uLine;
      uniform vec3 uBase, uLight, uCyan, uAqua;
      varying vec3 vNormal, vView, vLocal;
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDirection = normalize(vView);
        float rim = pow(1.0 - max(0.0, dot(normal, viewDirection)), 4.5);
        float diffuse = max(0.0, dot(normal, normalize(vec3(-0.35, 0.8, 1.0))));
        float caustic = 0.5 + 0.5 * sin(vLocal.x * 2.2 + vLocal.z * 3.0 + uTime * 0.22);
        vec3 skin = mix(uBase, uLight, 0.15 + diffuse * 0.7);
        vec3 color = skin + uCyan * rim * 0.8 + uAqua * diffuse * caustic * 0.018;
        if (uLine > 0.5) color = mix(uCyan, uAqua, 0.25);
        float depthLight = 1.0 - uDepth * 0.45;
        float alpha = uOpacity * (uLine > 0.5 ? 0.65 : 0.98);
        gl_FragColor = vec4(color * depthLight, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

function outline(shape: THREE.Shape, map: (point: THREE.Vector2) => THREE.Vector3, material: THREE.ShaderMaterial) {
  const vertices = shape.getPoints(56).map(map);
  const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertices.flatMap(() => [0, 0, 1]), 3));
  return new THREE.LineLoop(geometry, material);
}

function finGeometry(shape: THREE.Shape, thickness: number, aquaticPlane = true) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true,
    bevelSize: thickness * .45, bevelThickness: thickness * .4, bevelSegments: 2, steps: 1, curveSegments: 10 });
  geometry.translate(0, 0, -thickness / 2);
  if (aquaticPlane) {
    // Shape span -> Z, swept length -> X, thickness -> Y. These are volumetric fins.
    geometry.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  }
  return geometry;
}

export function createWhaleModel(uniforms: WhaleUniforms, lowDetail: boolean) {
  const root = new THREE.Group();
  root.name = 'WWMS articulated volumetric whale';
  const skin = whaleMaterial(uniforms);
  const ink = whaleMaterial(uniforms, true);
  const rows = lowDetail ? 36 : 60;
  const sides = lowDetail ? 18 : 28;
  // Rounded head, arched back and tapered peduncle follow the login silhouette.
  const profile = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.2, .07, .07), new THREE.Vector3(-2.7, .18, .18),
    new THREE.Vector3(-2.0, .38, .32), new THREE.Vector3(-1.0, .67, .54),
    new THREE.Vector3(0, .88, .75), new THREE.Vector3(1.0, .93, .79),
    new THREE.Vector3(2.0, .76, .64), new THREE.Vector3(2.8, .49, .44),
    new THREE.Vector3(3.18, .28, .28), new THREE.Vector3(3.38, .11, .14),
    new THREE.Vector3(3.42, .008, .008),
  ]);
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const sample = profile.getPoint(row / rows);
    const tangent = profile.getTangent(row / rows);
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const c = Math.cos(angle), s = Math.sin(angle);
      const ry = Math.max(.008, sample.y), rz = Math.max(.008, sample.z);
      positions.push(sample.x, ry * c, rz * s);
      const normal = new THREE.Vector3(-(tangent.y * c * c / ry + tangent.z * s * s / rz) /
        Math.max(.01, tangent.x), c / ry, s / rz).normalize();
      normals.push(normal.x, normal.y, normal.z);
      if (row < rows && side < sides) {
        const a = row * (sides + 1) + side, b = a + sides + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const bodyGeometry = new THREE.BufferGeometry();
  const bodyPositions = new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const bodyNormals = new THREE.Float32BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage);
  bodyGeometry.setAttribute('position', bodyPositions);
  bodyGeometry.setAttribute('normal', bodyNormals);
  bodyGeometry.setIndex(indices);
  bodyGeometry.computeBoundingSphere();
  const restPositions = new Float32Array(bodyPositions.array);
  const restNormals = new Float32Array(bodyNormals.array);
  const body = new THREE.Mesh(bodyGeometry, skin);
  body.name = 'deforming body';
  body.frustumCulled = false;
  root.add(body);

  const flukes = new THREE.Shape();
  flukes.moveTo(0, .24);
  flukes.bezierCurveTo(-.4, .22, -.95, .12, -1.78, -.32);
  flukes.bezierCurveTo(-1.50, -.37, -1.12, -.82, -.65, -.76);
  flukes.quadraticCurveTo(-.20, -.62, 0, -.48);
  flukes.quadraticCurveTo(.20, -.62, .65, -.76);
  flukes.bezierCurveTo(1.12, -.82, 1.50, -.37, 1.78, -.32);
  flukes.bezierCurveTo(.95, .12, .4, .22, 0, .24);
  const tail = new THREE.Group(); tail.name = 'caudal joint';
  tail.add(new THREE.Mesh(finGeometry(flukes, .035), skin));
  tail.add(outline(flukes, p => new THREE.Vector3(p.y, .025, p.x), ink));
  root.add(tail);

  const paddle = new THREE.Shape();
  paddle.moveTo(0, .15);
  paddle.bezierCurveTo(.5, .05, 1.48, -.65, 1.72, -1.42);
  paddle.bezierCurveTo(1.03, -1.44, .28, -.72, 0, -.27);
  paddle.closePath();
  const flippers = [-1, 1].map(side => {
    const joint = new THREE.Group(); joint.name = side > 0 ? 'near pectoral joint' : 'far pectoral joint';
    joint.scale.z = side;
    const mesh = new THREE.Mesh(finGeometry(paddle, .025), skin);
    mesh.geometry.rotateX(.32);
    joint.add(mesh);
    joint.add(outline(paddle, p => new THREE.Vector3(p.y, -Math.sin(.32) * p.x + .02, Math.cos(.32) * p.x), ink));
    root.add(joint);
    return joint;
  });
  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(-.32, 0);
  dorsalShape.bezierCurveTo(-.22, .2, -.15, .43, .12, .46);
  dorsalShape.quadraticCurveTo(.06, .15, .34, 0);
  dorsalShape.closePath();
  const dorsal = new THREE.Group(); dorsal.name = 'dorsal joint';
  dorsal.add(new THREE.Mesh(finGeometry(dorsalShape, .08, false), skin));
  dorsal.add(outline(dorsalShape, p => new THREE.Vector3(p.x, p.y, .055), ink));
  root.add(dorsal);

  const details: { line: THREE.Line; rest: Float32Array }[] = [];
  const addDetail = (points: THREE.Vector3[]) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(44)), ink);
    const attribute = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    attribute.setUsage(THREE.DynamicDrawUsage);
    line.geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: attribute.count }, () => [0, 0, 1]).flat(), 3));
    root.add(line); details.push({ line, rest: new Float32Array(attribute.array) });
  };
  const eyes: { mesh: THREE.Mesh; rest: THREE.Vector3 }[] = [];
  for (const side of [-1, 1]) {
    addDetail([new THREE.Vector3(3.18, -.05, side * .17), new THREE.Vector3(2.84, -.16, side * .40),
      new THREE.Vector3(2.35, -.22, side * .60), new THREE.Vector3(1.88, -.22, side * .67)]);
    // A restrained ventral contour echoes the reference SVG's lower detail line.
    addDetail([new THREE.Vector3(2.4, -.45, side * .42), new THREE.Vector3(1.4, -.72, side * .47),
      new THREE.Vector3(.4, -.79, side * .38), new THREE.Vector3(-.5, -.65, side * .28)]);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), ink);
    eye.position.set(2.55, .07, side * .535); root.add(eye);
    eyes.push({ mesh: eye, rest: eye.position.clone() });
  }

  let tailPitch = 0, finPitch = 0, bodyBend = 0;
  let swimPhase = 0, lastElapsed = 0;
  // A procedural spine: the head receives steering first, then successive
  // vertebrae follow. This adds real curvature to the existing volumetric mesh.
  const spineYaw = new Float32Array(12), spinePitch = new Float32Array(12);
  const spineAt = (x: number, spine: Float32Array) => {
    const t = THREE.MathUtils.clamp((3.42 - x) / 6.62, 0, 1) * 11;
    const i = Math.min(10, Math.floor(t));
    return THREE.MathUtils.lerp(spine[i], spine[i + 1], t - i);
  };
  const curveAt = (x: number) => spineAt(x, spineYaw) * (x > 0 ? x * .45 : x * x * .15);
  const bendAt = (x: number, phase: number, amplitude: number) => {
    const weight = THREE.MathUtils.clamp((3.2 - x) / 6.4, 0, 1);
    return amplitude * (.08 + weight * weight) * Math.sin(phase - weight * 4.2) +
      spineAt(x, spinePitch) * (x > 0 ? x * .3 : x * x * .1);
  };
  const update = (elapsed: number, propulsion: number, steering = { yaw: 0, pitch: 0, bank: 0 }) => {
    const dt = Math.min(.1, Math.max(0, elapsed - lastElapsed));
    // Update from tail to head so the response travels along the spine.
    const follow = 1 - Math.exp(-dt * 8);
    for (let i = 11; i >= 0; i--) {
      spineYaw[i] += ((i ? spineYaw[i - 1] : steering.yaw) - spineYaw[i]) * follow;
      spinePitch[i] += ((i ? spinePitch[i - 1] : steering.pitch) - spinePitch[i]) * follow;
    }
    swimPhase += Math.max(0, elapsed - lastElapsed) * (1.55 + propulsion * .3);
    lastElapsed = elapsed;
    const phase = swimPhase;
    const amplitude = .24 + propulsion * .09;
    for (let row = 0; row <= rows; row++) {
      const first = row * (sides + 1) * 3;
      const x = restPositions[first];
      const bend = bendAt(x, phase, amplitude);
      const slope = (bendAt(x + .01, phase, amplitude) - bendAt(x - .01, phase, amplitude)) / .02;
      const curve = curveAt(x), sideSlope = (curveAt(x + .01) - curveAt(x - .01)) / .02;
      const cy = Math.cos(-Math.atan(sideSlope)), sy = Math.sin(-Math.atan(sideSlope));
      const cz = Math.cos(Math.atan(slope)), sz = Math.sin(Math.atan(slope));
      for (let side = 0; side <= sides; side++) {
        const at = first + side * 3;
        const y = restPositions[at + 1], z = restPositions[at + 2];
        bodyPositions.array[at] = x - y * sz * cy + z * sy;
        bodyPositions.array[at + 1] = y * cz + bend;
        bodyPositions.array[at + 2] = z * cy + y * sz * sy + curve;
        const nx = restNormals[at] * cz - restNormals[at + 1] * sz;
        bodyNormals.array[at] = nx * cy + restNormals[at + 2] * sy;
        bodyNormals.array[at + 1] = restNormals[at] * sz + restNormals[at + 1] * cz;
        bodyNormals.array[at + 2] = -nx * sy + restNormals[at + 2] * cy;
      }
    }
    bodyPositions.needsUpdate = true; bodyNormals.needsUpdate = true;
    tailPitch = Math.sin(phase - 4.2 + .45) * (.28 + propulsion * .1);
    tail.position.set(-3.2, bendAt(-3.2, phase, amplitude), curveAt(-3.2));
    tail.rotation.z = tailPitch;
    tail.rotation.y = -(curveAt(-3.19) - curveAt(-3.21)) / .02;
    tail.rotation.x = .15 + Math.sin(phase * .5) * .06;
    finPitch = Math.sin(phase * .6 + .8) * .10;
    flippers.forEach((joint, index) => {
      joint.position.set(.25, -.59 + bendAt(.25, phase, amplitude), (index === 0 ? -.50 : .50) + curveAt(.25));
      joint.rotation.x = finPitch * (index === 0 ? -1 : 1) + steering.bank * .35;
      joint.rotation.z = Math.sin(phase * .6 + index * .5) * .045 + spineAt(.25, spineYaw) * (index ? .16 : -.16);
    });
    dorsal.position.set(-1.10, .68 + bendAt(-1.10, phase, amplitude), curveAt(-1.10));
    dorsal.rotation.z = Math.sin(phase - 2) * .025;
    for (const detail of details) {
      const attribute = detail.line.geometry.getAttribute('position');
      for (let index = 0; index < attribute.count; index++) {
        const at = index * 3;
        attribute.setY(index, detail.rest[at + 1] + bendAt(detail.rest[at], phase, amplitude));
        attribute.setZ(index, detail.rest[at + 2] + curveAt(detail.rest[at]));
      }
      attribute.needsUpdate = true;
    }
    for (const { mesh, rest } of eyes) mesh.position.set(rest.x, rest.y + bendAt(rest.x, phase, amplitude), rest.z + curveAt(rest.x));
    bodyBend = bendAt(-2.4, phase, amplitude);
    uniforms.uTime.value = elapsed;
  };
  const dispose = () => {
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) geometries.add(object.geometry);
    });
    geometries.forEach(geometry => geometry.dispose()); skin.dispose(); ink.dispose();
  };
  // Draw surfaces first so far-side eyes and fin contours cannot show through the body.
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.renderOrder = object.material === ink ? 2 : 1;
  });
  return { root, update, dispose, pose: () => ({ tailPitch, finPitch, bodyBend,
    spineYaw: Array.from(spineYaw), spinePitch: Array.from(spinePitch) }),
    vertexCount: bodyPositions.count, bodyGeometry };
}
