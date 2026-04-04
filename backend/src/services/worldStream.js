function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

let world = {
  rainfallMmPerHr: 16,
  consecutiveRainHours: 0,
  deliveryDropPercent: 38,
  flooded: false,
  bandhVerified: false,
  socialSeverityIndex: 1,
  section144Active: false,
  nightCurfewActive: false,
  curfewHours: 0,
  tick: 0,
  bandhTicksLeft: 0,
  curfewTicksLeft: 0
};

export function getWorldSnapshot() {
  return {
    ...world,
    updatedAt: Date.now()
  };
}

function stepWorld() {
  world.tick += 1;

  const wobble = (Math.random() - 0.5) * 10;
  const slowCycle = Math.sin(world.tick / 12) * 9;
  const fastPulse = Math.sin(world.tick / 3) * 2.5;

  let target = 24 + slowCycle + fastPulse * 0.35;
  if (Math.random() > 0.94) {
    target += 18 + Math.random() * 22;
  }

  world.rainfallMmPerHr = clamp(
    world.rainfallMmPerHr * 0.62 + target * 0.38 + wobble * 0.45,
    0,
    95
  );
  world.rainfallMmPerHr = Math.round(world.rainfallMmPerHr * 10) / 10;

  if (world.rainfallMmPerHr > 35) {
    world.consecutiveRainHours = clamp(world.consecutiveRainHours + 0.4, 0, 8);
  } else {
    world.consecutiveRainHours = clamp(world.consecutiveRainHours - 0.45, 0, 8);
  }

  world.deliveryDropPercent = clamp(
    20 + world.rainfallMmPerHr * 0.68 + (Math.random() - 0.5) * 11,
    12,
    99
  );
  world.deliveryDropPercent = Math.round(world.deliveryDropPercent);

  world.flooded = world.rainfallMmPerHr > 22 && world.deliveryDropPercent > 66;

  if (world.bandhTicksLeft > 0) {
    world.bandhTicksLeft -= 1;
    if (world.bandhTicksLeft === 0) {
      world.bandhVerified = false;
      world.socialSeverityIndex = 1;
    }
  } else if (Math.random() > 0.965) {
    world.bandhVerified = true;
    world.socialSeverityIndex = Number((1.12 + Math.random() * 0.18).toFixed(2));
    world.bandhTicksLeft = 14 + Math.floor(Math.random() * 10);
  }

  if (world.curfewTicksLeft > 0) {
    world.curfewTicksLeft -= 1;
    if (world.curfewTicksLeft === 0) {
      world.section144Active = false;
      world.nightCurfewActive = false;
      world.curfewHours = 0;
    }
  } else if (!world.section144Active && !world.nightCurfewActive && Math.random() > 0.985) {
    world.section144Active = Math.random() > 0.45;
    world.nightCurfewActive = !world.section144Active;
    world.curfewHours = 2 + Math.floor(Math.random() * 5);
    world.curfewTicksLeft = 12 + Math.floor(Math.random() * 8);
  }
}

export function startWorldStream(intervalMs = 4000, onTick) {
  function tick() {
    stepWorld();
    onTick?.();
  }
  setInterval(tick, intervalMs);
  tick();
}
