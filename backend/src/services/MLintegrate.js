// Simulated ML models (can later replace with Python APIs)

import { db } from "../store.js";

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * M2: Weather Disruption Forecaster (LSTM-style sequence mock).
 * Heavy rain today increases tomorrow's disruption probability (persistence).
 */
export function predictWeatherDisruption(weather) {
  const rain = weather.rainfallMmPerHr || 0;
  const consecutive = weather.consecutiveRainHours || 0;
  const persistence = clamp(0.08 + consecutive * 0.04, 0, 0.22);

  // Stronger rain → higher baseline disruption probability (M2)
  const todayP = clamp(0.1 + rain / 72 + persistence * 0.55, 0, 0.92);

  const next7DayForecast = [];
  let prev = todayP;

  for (let d = 0; d < 7; d++) {
    let p;
    if (d === 0) {
      p = todayP;
    } else {
      const carryYesterday = rain > 40 ? 0.14 : rain > 25 ? 0.08 : 0.03;
      const decay = 0.88;
      const seasonWiggle = Math.sin((d + 1) * 0.75) * 0.035;
      p = clamp(prev * decay + carryYesterday + seasonWiggle, 0, 0.95);
      prev = p;
    }
    next7DayForecast.push(Number(p.toFixed(3)));
  }

  const disruptionProbability = next7DayForecast[1] ?? todayP;

  return {
    disruptionProbability: Number(disruptionProbability.toFixed(3)),
    next7DayForecast
  };
}

/**
 * M3: Severity Multiplier (Random Forest-style multi-factor split mock).
 */
export function predictSeverity(event) {
  let mult = 1.0;
  const rain = event.rainfallMmPerHr || 0;
  const traffic = event.deliveryDropPercent || 0;

  if (rain > 40) {
    mult += 0.5 + clamp((rain - 40) / 55, 0, 0.35);
  } else if (rain > 30) {
    mult += 0.2 + clamp((rain - 30) / 50, 0, 0.25);
  } else if (rain > 15) {
    mult += clamp((rain - 15) / 75, 0, 0.12);
  }

  if (traffic > 70) {
    mult += 0.1 + clamp((traffic - 70) / 62.5, 0, 0.28);
  } else if (traffic > 55) {
    mult += clamp((traffic - 55) / 150, 0, 0.1);
  }

  if (event.curfew) {
    mult += 0.22;
  }

  return clamp(Number(mult.toFixed(2)), 1.0, 1.8);
}

/**
 * M3 with optional affected zones (flood-prone clusters nudge severity).
 */
export function predictM3SeverityMultiplier(event) {
  let mult = predictSeverity(event);
  const zones = (event.affectedZones || []).map((z) => String(z).toLowerCase().replace(/\s+/g, "_"));
  if (zones.some((z) => z === "velachery" || z === "adyar")) {
    mult += 0.04;
  }
  if (zones.some((z) => z === "porur" || z === "anna_nagar")) {
    mult -= 0.03;
  }
  return clamp(Number(mult.toFixed(2)), 1.0, 1.8);
}

/**
 * M4: Behavioral Baseline (GMM-style cluster mock from profile + claim history).
 */
export function getUserBaseline(user) {
  if (!user) {
    return { avgHours: 8, avgIncome: 800, typicalZone: "unknown" };
  }

  const claims = db.claims.filter((c) => c.userId === user.id);
  const n = claims.length;

  let avgHours = user.workingHours;
  if (n > 0) {
    const meanLost = claims.reduce((s, c) => s + (c.lostHours || 0), 0) / n;
    avgHours = Number(clamp(user.workingHours + meanLost * 0.12, 4, 14).toFixed(1));
  }

  let avgIncome = Number(user.dailyIncome);
  if (n > 0) {
    const meanPayout = claims.reduce((s, c) => s + (c.payout || 0), 0) / n;
    const bump = clamp(meanPayout / 600, 0, 18);
    avgIncome = Number((user.dailyIncome + bump).toFixed(0));
  }

  return {
    avgHours,
    avgIncome,
    typicalZone: user.zone
  };
}

/**
 * M4 extended: baseline + deviation score for trust / fraud signals.
 */
export function getBehavioralM4(user) {
  const base = getUserBaseline(user);
  if (!user) {
    return { ...base, deviationScore: 0 };
  }

  const claims = db.claims.filter((c) => c.userId === user.id);
  const n = claims.length;
  const incomeDrift = Math.abs(base.avgIncome - user.dailyIncome) / Math.max(1, user.dailyIncome);
  const hoursDrift = Math.abs(base.avgHours - user.workingHours) / Math.max(1, user.workingHours);
  const claimFrequency = clamp(n / 12, 0, 1);

  const deviationScore = clamp(
    incomeDrift * 0.45 + hoursDrift * 0.35 + claimFrequency * 0.28 + (n > 8 ? 0.08 : 0),
    0,
    1
  );

  return {
    ...base,
    deviationScore: Number(deviationScore.toFixed(3))
  };
}

/**
 * M5: Anomaly Detection (Isolation Forest style)
 */
export function detectClaimAnomaly(claim) {
  const score = Math.random(); // simulate anomaly score

  return {
    anomalyScore: Number(score.toFixed(2)),
    isAnomalous: score > 0.7
  };
}
