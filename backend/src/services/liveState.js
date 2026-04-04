import { getWorldSnapshot } from "./worldStream.js";
import { calculatePayout, evaluateDisruptionScenarios } from "./claimEngine.js";
import {
  getGovernmentAlertSignal,
  getSocialEventSignal,
  getTrafficSignal,
  getWeatherSignal
} from "./externalApis.js";
import {
  getBehavioralM4,
  predictM3SeverityMultiplier,
  predictWeatherDisruption
} from "./MLintegrate.js";
import { calculateRiskAndPremium, weeklyPremiumWithAi } from "./riskEngine.js";
import { db, getTierCoveragePercent } from "../store.js";

function getUserPolicy(userId) {
  return db.policies.find((policy) => policy.userId === userId) || null;
}

export function buildMlModelsOutput({ user, policy, weather, traffic, social, government, risk }) {
  const forecast = predictWeatherDisruption(weather);
  const m3 = predictM3SeverityMultiplier({
    rainfallMmPerHr: weather.rainfallMmPerHr,
    deliveryDropPercent: traffic.deliveryDropPercent,
    affectedZones: user?.zone ? [String(user.zone).toLowerCase()] : [],
    curfew: government.section144Active || government.nightCurfewActive
  });
  const m4 = getBehavioralM4(user);

  return {
    m1: {
      model: "XGBoost Regressor (simulated)",
      riskScore: risk.riskScore
    },
    m2: {
      model: "LSTM forecaster (simulated)",
      disruptionProbability: forecast.disruptionProbability,
      next7DayForecast: forecast.next7DayForecast
    },
    m3: {
      model: "Random Forest (simulated)",
      severityMultiplier: m3
    },
    m4: {
      model: "GMM behavioral baseline (simulated)",
      workerBaseline: {
        avgHours: m4.avgHours,
        avgIncome: m4.avgIncome,
        typicalZone: m4.typicalZone
      },
      deviationScore: m4.deviationScore
    }
  };
}

export function buildLiveDashboardState(user) {
  const policy = getUserPolicy(user.id);
  const weather = getWeatherSignal(user.zone, user.location?.lat, user.location?.lng);
  const traffic = getTrafficSignal(user.zone);
  const social = getSocialEventSignal(user.pincode);
  const government = getGovernmentAlertSignal(user.zone);

  const risk = calculateRiskAndPremium({
    zone: user.zone,
    basePremium: policy?.basePremium || 29,
    weather,
    traffic,
    government,
    user
  });

  const aiPremium = weeklyPremiumWithAi({
    basePremium: policy?.basePremium || 29,
    riskScore: risk.riskScore,
    disruptionProbability: predictWeatherDisruption(weather).disruptionProbability,
    tenureWeeks: tenureWeeksFromUser(user),
    zone: user.zone
  });

  const scenarios = evaluateDisruptionScenarios({
    weather,
    traffic,
    social,
    government,
    workingHours: user.workingHours,
    zone: user.zone
  });

  const tierCoverage = getTierCoveragePercent(policy?.planId);
  const hourlyIncome = user.dailyIncome / Math.max(1, user.workingHours);
  const topScenario = scenarios[0] || null;
  const livePayout = topScenario
    ? calculatePayout(hourlyIncome, topScenario.lostHours, topScenario.severityFactor, tierCoverage)
    : 0;

  const disruptedHours = topScenario?.lostHours ?? 0;
  const severityMultiplier = topScenario?.severityFactor ?? predictM3SeverityMultiplier({
    rainfallMmPerHr: weather.rainfallMmPerHr,
    deliveryDropPercent: traffic.deliveryDropPercent,
    affectedZones: user?.zone ? [String(user.zone).toLowerCase()] : [],
    curfew: government.section144Active || government.nightCurfewActive
  });

  const ml = buildMlModelsOutput({ user, policy, weather, traffic, social, government, risk });

  return {
    disruption: {
      rainfall: weather.rainfallMmPerHr,
      rainfallMmPerHr: weather.rainfallMmPerHr,
      traffic: traffic.traffic,
      curfew: government.section144Active || government.nightCurfewActive,
      consecutiveRainHours: weather.consecutiveRainHours
    },
    risk: { ...risk, aiAdjustedWeeklyPremium: aiPremium.adjustedWeeklyPremium, aiPremiumExplanation: aiPremium.explanation },
    forecast: predictWeatherDisruption(weather),
    baseline: { ...ml.m4.workerBaseline, deviationScore: ml.m4.deviationScore },
    deviationScore: ml.m4.deviationScore,
    apiSignals: { weather, traffic, social, government },
    activeScenarios: scenarios,
    activeTriggers: scenarios.map((s) => ({
      type: s.type,
      triggerCondition: s.triggerCondition,
      severityFactor: s.severityFactor,
      lostHours: s.lostHours
    })),
    ml,
    payout: {
      amount: livePayout,
      formula: {
        avgHourlyEarnings: Math.round(hourlyIncome * 100) / 100,
        disruptedHours,
        severityMultiplier: Number(Number(severityMultiplier).toFixed(2)),
        tierCoveragePercent: tierCoverage,
        tierCoverageLabel: `${Math.round(tierCoverage * 100)}%`
      },
      hasActiveScenario: scenarios.length > 0
    },
    tier: {
      planId: policy?.planId || "basic",
      weeklyPremium: policy?.basePremium || 29,
      coveragePercent: tierCoverage
    },
    worldUpdatedAt: getWorldSnapshot().updatedAt
  };
}

function tenureWeeksFromUser(user) {
  if (!user?.createdAt) return 0;
  const ms = Date.now() - new Date(user.createdAt).getTime();
  return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
}
