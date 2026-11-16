// STARSHARD — deterministic randomness. Every random choice in the game flows
// through one seeded stream, so the same seed always replays the same game:
// the screenshot scenes and the autopilot are reproducible frame for frame.
export function createRandom(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  // mulberry32: small, fast, good enough for a game.
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Integer in [min, max] inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** One element of `list`, uniformly. */
    pick: (list) => list[Math.floor(next() * list.length)],
    /** True with probability `p`. */
    chance: (p) => next() < p,
    /** Angle in [0, 2π). */
    angle: () => next() * Math.PI * 2,
  };
}

/** A fresh stream for a screenshot scene: seed 1 is the canonical scene seed. */
export function sceneRandom(seed = 1) {
  return createRandom(seed * 2654435761);
}
