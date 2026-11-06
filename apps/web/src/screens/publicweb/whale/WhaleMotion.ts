import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

export type SwimBehavior = 'cruising' | 'turning' | 'diving' | 'ascending' | 'approaching' | 'receding' | 'passing';
export type WhaleHabitat = { center: Vector3; halfWidth: number; halfHeight: number };

/** Free swimming uses time and viewport dimensions only. Inject RNG for tests. */
export function createWhaleSwimmer(initial: WhaleHabitat, random: () => number = Math.random) {
  const position = initial.center.clone(), velocity = new Vector3(), orientation = new Quaternion();
  const goal = position.clone(), desired = new Vector3(), acceleration = new Vector3();
  const forward = new Vector3(1, 0, 0), up = new Vector3(), across = new Vector3();
  const basis = new Matrix4(), targetOrientation = new Quaternion(), bankRotation = new Quaternion();
  const inverse = new Quaternion(), localHeading = new Vector3(), xAxis = new Vector3(1, 0, 0);
  const visited: Vector3[] = [];
  let elapsed = 0, age = 0, bank = 0, yaw = 0, pitch = 0, nextPlan = 0, destinations = 0;
  let behavior: SwimBehavior = 'cruising';
  let previousBehavior: SwimBehavior = behavior;
  const weights: Record<SwimBehavior, number> = { cruising: 1, turning: 0, diving: 0, ascending: 0, approaching: 0, receding: 0, passing: 0 };
  // Choose varied destinations across the viewport. No document content,
  // reserved navbar area, collision grid or path exclusion enters this choice.
  const plan = (h: WhaleHabitat) => {
    let best = -Infinity;
    for (let i = 0; i < 24; i++) {
      const p = new Vector3(h.center.x + (random() * 2 - 1) * h.halfWidth * .84,
        h.center.y + (random() * 2 - 1) * h.halfHeight * .84, h.center.z);
      const distance = p.distanceTo(position);
      const novelty = visited.length ? Math.min(...visited.map(v => v.distanceTo(p))) : distance;
      const score = Math.min(distance, 5) * .65 + Math.min(novelty, 4) * .8 + random() * 2.5;
      if (score > best) { best = score; goal.copy(p); }
    }
    goal.z = h.center.z - (random() * 7 - 1);
    visited.push(goal.clone()); if (visited.length > 7) visited.shift();
    nextPlan = elapsed + 9 + random() * 7; destinations++;
  };
  plan(initial);
  const update = (seconds: number, h: WhaleHabitat) => {
    const dt = MathUtils.clamp(seconds, 0, .05); elapsed += dt; age += dt;
    if (elapsed >= nextPlan || (position.distanceTo(goal) < .65 && age > 3)) { plan(h); age = 0; }
    desired.copy(goal).sub(position);
    const speed = 1.15 + Math.sin(elapsed * .43) * .16;
    desired.multiplyScalar(.8).clampLength(0, speed);
    forward.copy(desired);
    const horizontal = Math.hypot(forward.x, forward.z);
    forward.y = MathUtils.clamp(forward.y, -horizontal * .5, horizontal * .5);
    if (forward.lengthSq() < .02) forward.set(1, Math.sin(elapsed * .3) * .08, .2);
    forward.normalize(); inverse.copy(orientation).invert(); localHeading.copy(forward).applyQuaternion(inverse);
    const targetYaw = MathUtils.clamp(Math.atan2(localHeading.z, localHeading.x), -.65, .65);
    const targetPitch = MathUtils.clamp(Math.atan2(localHeading.y, Math.hypot(localHeading.x, localHeading.z)), -.3, .3);
    yaw = MathUtils.lerp(yaw, targetYaw, 1 - Math.exp(-dt * 2.5));
    pitch = MathUtils.lerp(pitch, targetPitch, 1 - Math.exp(-dt * 2));
    bank = MathUtils.lerp(bank, -yaw * .38 + Math.sin(elapsed * .37) * .025, 1 - Math.exp(-dt * 1.5));
    up.set(0, 1, 0); across.crossVectors(forward, up).normalize(); up.crossVectors(across, forward).normalize();
    basis.makeBasis(forward, up, across); targetOrientation.setFromRotationMatrix(basis);
    bankRotation.setFromAxisAngle(xAxis, bank); targetOrientation.multiply(bankRotation);
    orientation.rotateTowards(targetOrientation, Math.min(dt * .55, orientation.angleTo(targetOrientation) * (1 - Math.exp(-dt * 1.7))));
    desired.multiplyScalar(1 - Math.min(.55, Math.abs(yaw) * .6));
    acceleration.copy(desired).sub(velocity).multiplyScalar(1.5).clampLength(0, .8);
    velocity.addScaledVector(acceleration, dt); position.addScaledVector(velocity, dt);
    const next: SwimBehavior = Math.abs(yaw) > .28 ? 'turning' : velocity.z > .3 ? 'approaching' :
      velocity.z < -.3 ? 'receding' : velocity.y > .22 ? 'ascending' : velocity.y < -.22 ? 'diving' : velocity.length() > .9 ? 'passing' : 'cruising';
    if (next !== behavior) { previousBehavior = behavior; behavior = next; }
    for (const state of Object.keys(weights) as SwimBehavior[]) weights[state] += ((state === behavior ? 1 : 0) - weights[state]) * (1 - Math.exp(-dt * 1.5));
  };
  return { position, velocity, orientation, update, time: () => elapsed, propulsion: () => velocity.length(),
    articulation: () => ({ yaw, pitch, bank }),
    snapshot: () => ({ behavior, previousBehavior, elapsed, age, bank, position: position.toArray(), velocity: velocity.toArray(),
      quaternion: orientation.toArray(), weights: { ...weights }, goal: goal.toArray(),
      steering: { yaw, pitch, destinations } }) };
}
