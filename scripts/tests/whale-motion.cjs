// Deterministic integration of the production planner, steering and mesh.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const web = path.resolve('apps/web');
const ts = require(path.join(web, 'node_modules/typescript'));
const THREE = require(path.join(web, 'node_modules/three'));
function source(name) {
  const filename = path.join(web, 'src/screens/publicweb/whale', name + '.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = new Module(filename, module); loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename)); loaded._compile(output, filename); return loaded.exports;
}
const { createWhaleSwimmer } = source('WhaleMotion');
const { createWhaleModel, createWhaleUniforms } = source('WhaleModel');
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const habitat = { center: new THREE.Vector3(0, 0, -9), halfWidth: 13, halfHeight: 8 };
for (const key of ['space', 'obstacles', 'scrollY', 'scrollDirection', 'section', 'progress']) {
  Object.defineProperty(habitat, key, { get() { throw new Error('Swimmer must not read content/scroll input: ' + key); } });
}
const swimmer = createWhaleSwimmer(habitat, rng(7)), twin = createWhaleSwimmer(habitat, rng(7));
const states = new Set(), samples = [];
let previous = swimmer.orientation.clone(), previousVelocity = swimmer.velocity.clone();
let maxAngle = 0, maxSpeed = 0, maxAcceleration = 0;
for (let frame = 0; frame < 60 * 180; frame++) {
  swimmer.update(1 / 60, habitat); twin.update(1 / 60, habitat);
  const state = swimmer.snapshot(); assert.deepEqual(state, twin.snapshot()); states.add(state.behavior);
  maxAngle = Math.max(maxAngle, previous.angleTo(swimmer.orientation));
  maxSpeed = Math.max(maxSpeed, swimmer.velocity.length());
  maxAcceleration = Math.max(maxAcceleration, swimmer.velocity.distanceTo(previousVelocity) * 60);
  previous.copy(swimmer.orientation); previousVelocity.copy(swimmer.velocity);
  if (frame % 30 === 0) samples.push(state);
}
assert.ok(maxAngle <= .55 / 60 + .00001, 'Bounded quaternion turns');
assert.ok(maxSpeed <= 1.311 && maxAcceleration <= .801, 'Bounded momentum');
assert.ok(samples.some(s => s.position[0] < -2.5) && samples.some(s => s.position[0] > 2.5), 'Explores both sides without reserving a content area');
assert.ok(new Set(samples.map(s => s.goal.join(','))).size > 10, 'Explores many destinations, not a two-point loop');
for (const axis of [0, 1, 2]) assert.ok(Math.max(...samples.map(s => s.position[axis])) - Math.min(...samples.map(s => s.position[axis])) > 2, 'Explores axis ' + axis);
swimmer.update(1 / 60, habitat);
const before = swimmer.position.clone(); habitat.center.x += 2;
swimmer.update(1 / 60, habitat); assert.ok(swimmer.position.distanceTo(before) < .025, 'Viewport resize cannot teleport');
for (const lowDetail of [false, true]) {
  const model = createWhaleModel(createWhaleUniforms(), lowDetail);
  const size = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3());
  assert.ok(size.z > 3.5 && size.y > 1.8 && size.x > 6.5, 'Volumetric animal');
  model.update(.5, .8); const first = model.pose(), vertices = new Float32Array(model.bodyGeometry.getAttribute('position').array);
  model.update(1.6, .8); const next = model.pose();
  assert.ok(Math.abs(next.tailPitch - first.tailPitch) > .02 && Math.abs(next.finPitch - first.finPitch) > .01);
  assert.notDeepEqual(model.bodyGeometry.getAttribute('position').array, vertices, 'Body wave deforms vertices');
  for (let i = 1; i <= 30; i++) model.update(1.6 + i / 60, .8, { yaw: .6, pitch: .2, bank: -.2 });
  const turn = model.pose();
  assert.ok(turn.spineYaw[0] > .55 && turn.spineYaw[5] > .02 && turn.spineYaw[11] < .02, 'Head leads torso and delayed tail');
  for (let i = 31; i < 200; i++) model.update(1.6 + i / 60, .8, { yaw: .6, pitch: .2, bank: -.2 });
  assert.ok(model.pose().spineYaw[11] > .5, 'Tail eventually follows');
  assert.ok(model.vertexCount <= (lowDetail ? 750 : 1800)); model.dispose();
}
fs.mkdirSync('.runlogs/whale-visible-through-content', { recursive: true });
fs.writeFileSync('.runlogs/whale-visible-through-content/motion-states.json', JSON.stringify({ states: [...states], maxAngle, maxSpeed, maxAcceleration, samples }, null, 2));
console.log('PASS: seeded free exploration, no content/obstacle/scroll inputs, varied destinations/depth, unchanged physics limits, volumetric deformation and delayed head-to-tail turns at both detail levels.');
