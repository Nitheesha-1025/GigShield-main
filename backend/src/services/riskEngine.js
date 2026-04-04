import { zoneRiskMap, db } from "../store.js";

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function rainRiskLabel(mm) {
  if ((mm || 0) <= 18) return "Low";
  if ((mm || 0) <= 35) return "Medium";
  return "High";
}

function trafficRiskLabel(deliveryDropPercent) {
  const d = deliveryDropPercent ?? 0;
  if (d <= 40) return "Low";
  if (d <= 70) return "Medium";
  return "High";
}

/**
 * M1 — Risk Scoring Engine (simulated XGBoost-style ensemble).
 * Uses rainfall, traffic stress, zone base profile, government risk, and lightweight user history.
 */
function m1SimulateRiskScore({
  rainfallMmPerHr,
  deliveryDropPercent,
  zoneProfile,
  government,
  user
}) {
  const priorClaimCount = user
    ? db.claims.filter((c) => c.userId === user.id).length
    : 0;
  const historyBoost = clamp(priorClaimCount * 2.5, 0, 14);

  const rainNorm = clamp((rainfallMmPerHr || 0) / 85, 0, 1);
  const trafficNorm = clamp((deliveryDropPercent || 0) / 100, 0, 1);

  let score = zoneProfile.baseRisk * 0.45;
  score += rainNorm * 34;
  score += trafficNorm * 28;

  // High rainfall + high traffic interaction
  if ((rainfallMmPerHr || 0) > 28 && (deliveryDropPercent || 0) > 55) {
    score += rainNorm * trafficNorm * 18;
  }

  if (government.section144Active || government.nightCurfewActive) {
    score += 9;
  }

  score += historyBoost;

  return clamp(Math.round(score), 0, 100);
}

export function calculateRiskAndPremium({ zone, basePremium, weather, traffic, government, user }) {
  const zoneKey = zone.toLowerCase().replace(/\s+/g, "_");
  const zoneProfile = zoneRiskMap[zoneKey] || { floodProne: false, safeZone: false, baseRisk: 40 };

  const rainfall = weather.rainfallMmPerHr || 0;
  const deliveryDrop = traffic.deliveryDropPercent ?? 0;

  let riskScore = m1SimulateRiskScore({
    rainfallMmPerHr: rainfall,
    deliveryDropPercent: deliveryDrop,
    zoneProfile,
    government,
    user
  });

  let premiumAdjustment = 0;
  const explanationParts = [];

  if (zoneProfile.floodProne) {
    premiumAdjustment += 10;
    riskScore = clamp(riskScore + 12, 0, 100);
    explanationParts.push("Your zone is flood-prone (+Rs.10).");
  }

  if (rainfall > 35) {
    premiumAdjustment += 5;
    explanationParts.push("High rainfall forecast detected (+Rs.5).");
  }

  if (deliveryDrop > 70) {
    premiumAdjustment += 8;
    explanationParts.push("Severe delivery density drop detected (+Rs.8).");
  }

  if (government.section144Active || government.nightCurfewActive) {
    premiumAdjustment += 6;
    explanationParts.push("Government movement restriction risk (+Rs.6).");
  }

  if (zoneProfile.safeZone) {
    riskScore = clamp(riskScore - 10, 0, 100);
    premiumAdjustment -= 5;
    explanationParts.push("Safe-zone discount applied (-Rs.5).");
  }

  let premiumMultiplier = 0.8 + (riskScore / 100) * 0.7;
  if (zoneProfile.safeZone) {
    premiumMultiplier *= 0.94;
  }
  premiumMultiplier = clamp(Number(premiumMultiplier.toFixed(3)), 0.8, 1.5);

  const finalWeeklyPremium = Math.max(19, Math.round(basePremium * premiumMultiplier + premiumAdjustment));

  const rainRisk = rainRiskLabel(rainfall);
  const trafficRisk = trafficRiskLabel(deliveryDrop);

  return {
    riskScore,
    rainRisk,
    trafficRisk,
    premiumMultiplier,
    finalWeeklyPremium,
    explanation: explanationParts.join(" ") || "Normal operating conditions. Premium unchanged."
  };
}

function mockCitySocialRisk(zone) {
  const key = String(zone || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const map = {
    adyar: 6,
    velachery: 8,
    t_nagar: 4,
    anna_nagar: 2,
    porur: 1
  };
  return map[key] ?? 5;
}

/**
 * AI-style weekly premium adjustment using M1 risk, M2 outlook, tenure, and city social risk (mock).
 */
export function weeklyPremiumWithAi({ basePremium, riskScore, disruptionProbability, tenureWeeks, zone }) {
  const tenureDiscount = Math.min(14, Math.max(0, tenureWeeks) * 0.55);
  const forecastLift = clamp((disruptionProbability || 0) * 22, 0, 16);
  const riskLift = clamp(((riskScore || 0) / 100) * 18, 0, 18);
  const socialRisk = mockCitySocialRisk(zone);

  const adjusted = Math.round(
    Math.max(19, basePremium + riskLift * 0.35 + forecastLift * 0.25 + socialRisk * 0.4 - tenureDiscount)
  );

  return {
    adjustedWeeklyPremium: adjusted,
    explanation: `Tenure discount ~₹${tenureDiscount.toFixed(0)}, forecast & risk uplift, city social load +₹${(
      socialRisk * 0.4
    ).toFixed(0)}.`
  };
}
