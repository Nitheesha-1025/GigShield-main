import crypto from "node:crypto";
import {
  detectClaimAnomaly,
  getBehavioralM4,
  predictM3SeverityMultiplier,
  predictWeatherDisruption
} from "./MLintegrate.js";
import { calculateRiskAndPremium } from "./riskEngine.js";
import { computeFraudScore, detectGpsSpoofing } from "./fraudService.js";
import {
  getDecisionFromTrust,
  m6FraudRingProbability,
  m7SocialSeverityClassifier,
  m8TrustScoreAggregator
} from "./trustScoreService.js";
import {
  getGovernmentAlertSignal,
  getSocialEventSignal,
  getTrafficSignal,
  getWeatherSignal
} from "./externalApis.js";
import { calculatePayout } from "./claimEngine.js";
import { db, getTierCoveragePercent } from "../store.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPercentMatch(claimedWeather, actualWeather) {
  const claimed = String(claimedWeather || "").toLowerCase();
  if (!claimed) return true;
  if (claimed.includes("rain")) return (actualWeather.rainfallMmPerHr || 0) > 5;
  if (claimed.includes("storm")) return (actualWeather.rainfallMmPerHr || 0) > 25;
  return true;
}

function getUserPolicy(userId) {
  return db.policies.find((policy) => policy.userId === userId) || null;
}

function persistClaim(claim) {
  db.claims.push(claim);
  return claim;
}

function persistFraudLog(log) {
  db.fraud_logs.push(log);
  return log;
}

function persistPayout(payout) {
  db.payouts.push(payout);
  return payout;
}

export function submitClaimRecord(input) {
  const claim = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "SUBMITTED",
    ...input
  };
  persistClaim(claim);
  return claim;
}

export function runMLPipeline(claim, user, policy) {
  const weather = getWeatherSignal(user.zone, user.location?.lat, user.location?.lng);
  const traffic = getTrafficSignal(user.zone);
  const social = getSocialEventSignal(user.pincode);
  const government = getGovernmentAlertSignal(user.zone);
  const gpsAnalysis = detectGpsSpoofing(claim.gpsPoints || []);
  const weatherMatched = toPercentMatch(claim.claimedWeather, weather);

  const behavioral = getBehavioralM4(user);
  const baseM4 = Number(behavioral.deviationScore || 0);
  const m4Deviation = clamp(baseM4 + randomBetween(-0.12, 0.12), 0, 1);
  const m5Anomaly = clamp(m4Deviation * randomBetween(0.75, 1.35), 0, 1);
  const m6FraudProbability = clamp(
    m4Deviation * 0.42 + m5Anomaly * 0.58 + randomBetween(-0.08, 0.08),
    0,
    1
  );
  const m7Severity =
    m6FraudProbability > 0.7
      ? "HIGH"
      : m6FraudProbability > 0.4
        ? "MEDIUM"
        : m6FraudProbability > 0.2
          ? "LOW"
          : "NONE";
  const m8TrustScore = Math.round(clamp(100 - m6FraudProbability * 100, 0, 100));

  const weatherDisruption = predictWeatherDisruption(weather);
  const severityMultiplier = predictM3SeverityMultiplier({
    rainfallMmPerHr: weather.rainfallMmPerHr,
    deliveryDropPercent: traffic.deliveryDropPercent,
    affectedZones: [user.zone],
    curfew: government.section144Active || government.nightCurfewActive
  });
  const anomaly = detectClaimAnomaly(claim);
  const m1Risk = calculateRiskAndPremium({
    zone: user.zone,
    basePremium: policy?.basePremium || 29,
    weather,
    traffic,
    government,
    user
  }).riskScore;
  const socialSeverity = m7SocialSeverityClassifier(claim.socialText || "");
  const fraud = computeFraudScore({
    gpsSpoofing: gpsAnalysis.spoofDetected,
    weatherMismatch: !weatherMatched,
    anomalyScore: m5Anomaly,
    fraudRingProbability: m6FraudProbability
  });

  const trustScore = m8TrustScoreAggregator({
    riskScore: m1Risk,
    weatherDisruptionProbability: weatherDisruption.disruptionProbability,
    severityMultiplier,
    behavioralDeviation: m4Deviation,
    anomalyScore: m5Anomaly,
    fraudRingProbability: m6FraudProbability,
    socialSeverityClass: m7Severity,
    fraudScore: fraud.fraudScore
  });

  const decision = m6FraudProbability > 0.75 ? "REJECTED" : m6FraudProbability > 0.4 ? "HOLD" : "APPROVED";
  const hourlyIncome = user.dailyIncome / Math.max(1, user.workingHours);
  const payoutAmount = calculatePayout(
    hourlyIncome,
    Number(claim.lostHours || 0),
    severityMultiplier,
    getTierCoveragePercent(policy?.planId)
  );

  return {
    decision,
    payoutAmount,
    trustScore,
    fraud,
    pipeline: {
      m1RiskScore: m1Risk,
      m2DisruptionProbability: weatherDisruption.disruptionProbability,
      m3SeverityMultiplier: severityMultiplier,
      m4BehaviorDeviation: Number(m4Deviation.toFixed(3)),
      m5AnomalyScore: Number(m5Anomaly.toFixed(3)),
      m6FraudRingProbability: Number(m6FraudProbability.toFixed(3)),
      m7SocialSeverity: {
        severityClass: m7Severity,
        confidence: m7Severity === "HIGH" ? 0.88 : m7Severity === "MEDIUM" ? 0.74 : 0.62
      },
      m8TrustScore: trustScore,
      fraudScore: fraud.fraudScore,
      gps: gpsAnalysis,
      weatherMatched,
      modelMeta: socialSeverity
    }
  };
}

export async function processClaimById(claimId) {
  const claim = db.claims.find((entry) => entry.id === claimId);
  if (!claim) return null;
  if (claim.status !== "SUBMITTED" && claim.status !== "PROCESSING") return claim;

  const user = db.users.find((entry) => entry.id === claim.userId);
  if (!user) {
    claim.status = "REJECTED";
    claim.reason = "User not found";
    return claim;
  }

  const policy = getUserPolicy(user.id);
  claim.status = "PROCESSING";
  claim.processingStartedAt = new Date().toISOString();
  await sleep(Math.round(randomBetween(500, 2000)));

  const output = runMLPipeline(claim, user, policy);

  claim.processedAt = new Date().toISOString();
  claim.pipeline = output.pipeline;
  claim.trustScore = output.trustScore;
  claim.recommendedDecision = output.decision;
  claim.status = "PENDING_REVIEW";
  claim.payoutAmount = output.payoutAmount;

  if (output.fraud.isFraud) {
    persistFraudLog({
      id: crypto.randomUUID(),
      claimId: claim.id,
      userId: user.id,
      createdAt: new Date().toISOString(),
      fraudScore: output.fraud.fraudScore,
      reasons: output.fraud.reasons,
      trustScore: output.trustScore
    });
  }

  return claim;
}

export function getClaimById(claimId) {
  return db.claims.find((entry) => entry.id === claimId) || null;
}

export function markClaimAsPaid(claimId, payout) {
  const claim = getClaimById(claimId);
  if (!claim) return null;
  persistPayout(payout);
  claim.payout = payout;
  claim.payoutAt = payout.timestamp;
  claim.status = "PAID";
  return claim;
}

export function adminManualDecision(claimId, decision) {
  const claim = getClaimById(claimId);
  if (!claim) return null;
  if (claim.status !== "PENDING_REVIEW" && claim.status !== "SUBMITTED") return claim;
  const normalized = decision === "APPROVED" ? "APPROVED" : "REJECTED";
  claim.status = normalized;
  claim.adminDecisionAt = new Date().toISOString();
  claim.decision = normalized;
  if (normalized !== "APPROVED") {
    claim.payoutAmount = 0;
  }
  return claim;
}

export function getWorkerDashboard(userId) {
  const claims = db.claims.filter((entry) => entry.userId === userId);
  const payouts = db.payouts.filter((entry) => entry.user_id === userId);
  const totalEarningsProtected = claims.reduce((sum, claim) => {
    const fromClaim = Number(claim.payoutAmount || claim.payout?.amount || claim.payout || claim.amount || 0);
    return sum + (Number.isFinite(fromClaim) ? fromClaim : 0);
  }, 0);
  return {
    totalEarningsProtected,
    weeklyCoverage: claims.filter((entry) => new Date(entry.createdAt) > new Date(Date.now() - 7 * 86400000))
      .length,
    claimHistory: claims.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    statusBreakdown: {
      approved: claims.filter((entry) => entry.status === "APPROVED" || entry.status === "PAID")
        .length,
      pendingSubmitted: claims.filter(
        (entry) =>
          entry.status === "PENDING_REVIEW" || entry.status === "SUBMITTED" || entry.status === "PROCESSING"
      ).length,
      rejected: claims.filter((entry) => entry.status === "REJECTED").length
    }
  };
}

export function getAdminDashboard() {
  return updateDashboardMetrics();
}

export function updateDashboardMetrics() {
  const totalClaims = db.claims.length;
  const totalPaid = db.payouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
  const totalPremium = db.policies.reduce((sum, policy) => sum + Number(policy.basePremium || 0), 0);
  const fraudDetected = db.fraud_logs.length;
  const highRiskZones = {};
  for (const claim of db.claims) {
    const zone = String(claim.zone || "unknown").toLowerCase();
    if (!highRiskZones[zone]) highRiskZones[zone] = 0;
    if ((claim.pipeline?.m6FraudRingProbability || 0) > 0.7) highRiskZones[zone] += 1;
  }

  const recentWeekClaims = db.claims.filter(
    (entry) => new Date(entry.createdAt).getTime() > Date.now() - 7 * 86400000
  ).length;
  const prevWeekClaims = db.claims.filter((entry) => {
    const t = new Date(entry.createdAt).getTime();
    return t <= Date.now() - 7 * 86400000 && t > Date.now() - 14 * 86400000;
  }).length;
  const weeklyTrend = recentWeekClaims - prevWeekClaims;

  return {
    totalClaims,
    totalPayouts: db.payouts.length,
    totalPaid,
    approvedCount: db.claims.filter((entry) => entry.status === "APPROVED" || entry.status === "PAID")
      .length,
    pendingSubmittedCount: db.claims.filter(
      (entry) =>
        entry.status === "PENDING_REVIEW" || entry.status === "SUBMITTED" || entry.status === "PROCESSING"
    ).length,
    lossRatio: totalPremium > 0 ? Number((totalPaid / totalPremium).toFixed(3)) : 0,
    fraudDetectionRate: totalClaims > 0 ? Number((fraudDetected / totalClaims).toFixed(3)) : 0,
    highRiskZoneHeatmap: highRiskZones,
    nextWeekClaimsPrediction: Math.max(0, recentWeekClaims + Math.round(weeklyTrend * 0.6))
  };
}

export function getAdminMlPipelineMetrics() {
  const claimsWithPipeline = db.claims.filter((claim) => claim.pipeline);
  const count = claimsWithPipeline.length;
  if (!count) {
    return {
      sampleCount: 0,
      m5: { avgAnomalyScore: 0, highAnomalyClaims: 0 },
      m6: { avgFraudRingProbability: 0, ringRiskClaims: 0 },
      m7: { severityDistribution: { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 } },
      m8: { avgTrustScore: 0, approvedBand: 0, holdBand: 0, rejectBand: 0 }
    };
  }

  let m5Sum = 0;
  let m6Sum = 0;
  let m8Sum = 0;
  let m5High = 0;
  let m6High = 0;
  const m7Dist = { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
  let approvedBand = 0;
  let holdBand = 0;
  let rejectBand = 0;

  for (const claim of claimsWithPipeline) {
    const p = claim.pipeline || {};
    const m5 = Number(p.m5AnomalyScore || 0);
    const m6 = Number(p.m6FraudRingProbability || 0);
    const m8 = Number(claim.trustScore ?? p.m8TrustScore ?? 0);
    const m7 = String(p.m7SocialSeverity?.severityClass || "NONE").toUpperCase();

    m5Sum += m5;
    m6Sum += m6;
    m8Sum += m8;
    if (m5 > 0.7) m5High += 1;
    if (m6 > 0.65) m6High += 1;
    if (m7Dist[m7] == null) m7Dist.NONE += 1;
    else m7Dist[m7] += 1;

    if (m8 > 70) approvedBand += 1;
    else if (m8 >= 40) holdBand += 1;
    else rejectBand += 1;
  }

  return {
    sampleCount: count,
    m5: {
      avgAnomalyScore: Number((m5Sum / count).toFixed(3)),
      highAnomalyClaims: m5High
    },
    m6: {
      avgFraudRingProbability: Number((m6Sum / count).toFixed(3)),
      ringRiskClaims: m6High
    },
    m7: { severityDistribution: m7Dist },
    m8: {
      avgTrustScore: Number((m8Sum / count).toFixed(1)),
      approvedBand,
      holdBand,
      rejectBand
    }
  };
}
