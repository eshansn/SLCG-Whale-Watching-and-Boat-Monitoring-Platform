import * as THREE from 'three';
import { measureOceanEnvironment } from './OceanEnvironment';
import { createWhaleModel, createWhaleUniforms } from './WhaleModel';
import { createWhaleSwimmer, type WhaleHabitat } from './WhaleMotion';

export type OceanSceneHandle = { dispose: () => void; snapshot: () => unknown };

/** Owns one transparent WebGL scene. No frame work runs through React. */
export function createOceanWhaleScene(
  host: HTMLElement, site: HTMLElement, onUnavailable: () => void,
): OceanSceneHandle | null {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!context) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x020912, 0);
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const lowDetail = innerWidth < 768 || (device.hardwareConcurrency || 8) <= 4 ||
    (device.deviceMemory || 8) <= 4 || !!device.connection?.saveData;
  let frameRate = lowDetail ? 30 : 60;
  let pixelRatio = Math.min(devicePixelRatio || 1, lowDetail ? 1 : 1.5);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 150);
  camera.position.set(0, 0, 18);
  const uniforms = createWhaleUniforms();
  const whale = createWhaleModel(uniforms, lowDetail);
  scene.add(whale.root);
  let environment = measureOceanEnvironment(site);
  const habitat: WhaleHabitat = { center: new THREE.Vector3(), halfWidth: 1, halfHeight: 1 };
  const fitViewport = () => {
    const { width, height } = environment;
    const scale = THREE.MathUtils.clamp(width / height * .96, .32, 1.15);
    whale.root.scale.setScalar(scale);
    const length = Math.min(440, width * (width < 768 ? .65 : .32));
    const distance = THREE.MathUtils.clamp(7.7 * scale * height / (2 * Math.tan(Math.PI / 10) * length), 16, 34);
    const unitsPerPixel = 2 * Math.tan(Math.PI / 10) * distance / height;
    habitat.center.set(0, 0, 18 - distance);
    habitat.halfWidth = width * unitsPerPixel / 2;
    habitat.halfHeight = height * unitsPerPixel / 2;
  };
  fitViewport();
  const swimmer = createWhaleSwimmer(habitat);

  // A few points occupy actual depths. Their slow drift is independent of scrolling.
  const particleCount = lowDetail ? 24 : 48;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = ((i * .618034) % 1 - .5) * 35;
    particlePositions[i * 3 + 1] = ((i * .381966 + .2) % 1 - .5) * 24;
    particlePositions[i * 3 + 2] = -2 - (i * .754878 % 1) * 28;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMaterial = new THREE.PointsMaterial({ color: '#8af5ff', size: .025,
    transparent: true, opacity: .14, depthWrite: false, sizeAttenuation: true });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);
  let disposed = false, frame = 0, needsMeasure = true, lastTime = 0, lastRender = 0;
  let frames = 0, opacity = 0;
  let frameCost = 0, sampleCount = 0, sampleStart = 0;
  let bufferWidth = 0, bufferHeight = 0, bufferRatio = 0;
  const measure = () => {
    environment = measureOceanEnvironment(site);
    const { width, height } = environment;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    if (bufferWidth !== width || bufferHeight !== height || bufferRatio !== pixelRatio) {
      renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height);
      bufferWidth = width; bufferHeight = height; bufferRatio = pixelRatio;
    }
    fitViewport(); needsMeasure = false;
  };
  const queue = () => { if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(draw); };
  const draw = (now: number) => {
    frame = 0;
    if (disposed || document.hidden) return;
    if (now - lastRender < 1000 / frameRate - 1) { queue(); return; }
    const started = performance.now();
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 1 / frameRate;
    lastTime = now; lastRender = now;
    if (needsMeasure) measure();
    swimmer.update(dt, habitat);
    whale.root.position.copy(swimmer.position); whale.root.quaternion.copy(swimmer.orientation);
    whale.update(swimmer.time(), swimmer.propulsion(), swimmer.articulation());
    const depth = THREE.MathUtils.clamp((-swimmer.position.z - 1) / 30, 0, 1);
    opacity = .96 - depth * .25;
    uniforms.uOpacity.value = opacity; uniforms.uDepth.value = depth;
    particles.rotation.z = Math.sin(swimmer.time() * .025) * .035;
    particles.position.y = Math.sin(swimmer.time() * .045) * .4;
    // A sparse, local wake displaces nearby points and relaxes behind the tail.
    const particleAttribute = particleGeometry.getAttribute('position');
    for (let i = 0; i < particleCount; i++) {
      const x = ((i * .618034) % 1 - .5) * 35;
      const y = ((i * .381966 + .2) % 1 - .5) * 24;
      const z = -2 - (i * .754878 % 1) * 28;
      const distance = Math.hypot(x - swimmer.position.x, y - swimmer.position.y, z - swimmer.position.z);
      const wake = Math.max(0, 1 - distance / 4) * swimmer.propulsion() * .28;
      particleAttribute.setXYZ(i, x + Math.sin(swimmer.time() * .7 + i) * wake,
        y + Math.cos(swimmer.time() * .6 + i) * wake, z);
    }
    particleAttribute.needsUpdate = true;
    renderer.render(scene, camera); frames++;
    site.style.setProperty('--ocean-depth', String(depth));
    host.parentElement!.dataset.active = String(opacity > .015);
    frameCost += performance.now() - started; sampleCount++;
    if (!sampleStart) sampleStart = now;
    if (now - sampleStart > 3000 && sampleCount > 15) {
      if (frameCost / sampleCount > 18 && frameRate > 30) {
        frameRate = 30; pixelRatio = 1; needsMeasure = true;
      }
      sampleStart = now; frameCost = 0; sampleCount = 0;
    }
    queue();
  };
  const dirty = () => { needsMeasure = true; queue(); };
  const onVisibility = () => {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (document.hidden) host.parentElement!.dataset.active = 'false'; else dirty();
  };
  const onContextLost = (event: Event) => { event.preventDefault(); dispose(); onUnavailable(); };
  const resizeObserver = new ResizeObserver(dirty);
  resizeObserver.observe(site);
  window.addEventListener('resize', dirty);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  void document.fonts.ready.then(() => { if (!disposed) dirty(); });
  const dispose = () => {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); frame = 0;
    resizeObserver.disconnect(); window.removeEventListener('resize', dirty);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    whale.dispose(); particleGeometry.dispose(); particleMaterial.dispose();
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    site.style.removeProperty('--ocean-depth');
  };
  const snapshot = () => {
    whale.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(whale.root);
    const projected: number[][] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera);
      projected.push([(point.x + 1) * environment.width / 2, (1 - point.y) * environment.height / 2]);
    }
    return { ...swimmer.snapshot(), scale: whale.root.scale.x,
      rendered: { position: whale.root.position.toArray(), quaternion: whale.root.quaternion.toArray() },
      pose: whale.pose(), frames, opacity, disposed,
      renderer: 'webgl', geometry: { bodyVertices: whale.vertexCount, meshes: renderer.info.memory.geometries },
      quality: { frameRate, pixelRatio, lowDetail, particleCount },
      environment: { width: environment.width, height: environment.height },
      projectedBounds: { left: Math.min(...projected.map(p => p[0])), right: Math.max(...projected.map(p => p[0])),
        top: Math.min(...projected.map(p => p[1])), bottom: Math.max(...projected.map(p => p[1])) },
    };
  };
  queue();
  return { dispose, snapshot };
}
