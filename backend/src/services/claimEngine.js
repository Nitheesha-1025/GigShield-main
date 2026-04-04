import { predictM3SeverityMultiplier } from "./MLintegrate.js";

export function calculatePayout(hourlyIncome, lostHours, severityFactor, tierCoverage = 0.5) {
  const raw = hourlyIncome * lostHours * severityFactor * tierCoverage;
  return Math.round(raw);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function severityFromSignals(weather, traffic, government, zoneKey) {
  return predictM3SeverityMultiplier({
    rainfallMmPerHr: weather.rainfallMmPerHr,
    deliveryDropPercent: traffic.deliveryDropPercent,
    affectedZones: zoneKey ? [zoneKey] : [],
    curfew: government.section144Active || government.nightCurfewActive
  });
}

function shiftHoursToCover(workingHours, maxHours) {
  return Math.max(1, Math.min(workingHours, maxHours));
}

/**
 * Parametric triggers (spec-aligned):
 * Heavy Rain → rainfall > 35 mm/hr
 * Waterlogging → rain + traffic drop > 70%
 * Bandh / Curfew → simulated via social / government streams
 */
export function evaluateDisruptionScenarios({
  weather,
  traffic,
  social,
  government,
  workingHours,
  zone
}) {
  const scenarios = [];
  const zoneKey = zone ? String(zone).toLowerCase().replace(/\s+/g, "_") : "";

  const heavyRainTriggered = (weather.rainfallMmPerHr || 0) > 35;
  if (heavyRainTriggered) {
    const multiplier = severityFromSignals(weather, traffic, government, zoneKey);
    const lostHours = shiftHoursToCover(workingHours, Math.max(2, Math.round(weather.consecutiveRainHours || 2)));
    scenarios.push({
      type: "Heavy Rain",
      triggerCondition: "Rainfall > 35 mm/hr",
      severityFactor: multiplier,
      lostHours
    });
  }

  const waterloggingTriggered =
    (weather.rainfallMmPerHr || 0) > 12 && (traffic.deliveryDropPercent || 0) > 70;
  if (waterloggingTriggered) {
    const multiplier = severityFromSignals(weather, traffic, government, zoneKey);
    const lostHours = shiftHoursToCover(workingHours, 4);
    scenarios.push({
      type: "Waterlogging",
      triggerCondition: "Active rain + delivery density drop > 70%",
      severityFactor: multiplier,
      lostHours
    });
  }

  if (social.bandhVerified) {
    const lostHours = shiftHoursToCover(workingHours, 3);
    scenarios.push({
      type: "Bandh",
      triggerCondition: "Simulated bandh / strike signal in cluster",
      severityFactor: Number(clamp(social.socialSeverityIndex, 1, 1.35).toFixed(2)),
      lostHours
    });
  }

  const curfewActive = government.section144Active || government.nightCurfewActive;
  if (curfewActive) {
    const lostHours = shiftHoursToCover(workingHours, government.curfewHours || 2);
    scenarios.push({
      type: "Curfew",
      triggerCondition: "Simulated curfew / Section 144 restriction",
      severityFactor: 1.3,
      lostHours
    });
  }

  return scenarios;
}
