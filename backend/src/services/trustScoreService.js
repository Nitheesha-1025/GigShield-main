function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function m6FraudRingProbability({ userId, recentClaims = [] }) {
  const collisions = recentClaims.filter((claim) => claim.userId !== userId).length;
  const score = clamp(0.15 + collisions * 0.07, 0, 0.95);
  return Number(score.toFixed(3));
}

export function m7SocialSeverityClassifier(text = "") {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) {
    return { severityClass: "NONE", confidence: 0 };
  }
  if (normalized.match(/flood|waterlog|emergency|cyclone|landslide/)) {
    return { severityClass: "HIGH", confidence: 0.84 };
  }
  if (normalized.match(/heavy rain|storm|traffic jam|strike|bandh/)) {
    return { severityClass: "MEDIUM", confidence: 0.73 };
  }
  return { severityClass: "LOW", confidence: 0.61 };
}

export function m8TrustScoreAggregator({
  riskScore,
  weatherDisruptionProbability,
  severityMultiplier,
  behavioralDeviation,
  anomalyScore,
  fraudRingProbability,
  socialSeverityClass = "NONE",
  fraudScore = 0
}) {
  let trust = 100;
  trust -= clamp((riskScore || 0) * 0.3, 0, 30);
  trust -= clamp((anomalyScore || 0) * 24, 0, 24);
  trust -= clamp((behavioralDeviation || 0) * 14, 0, 14);
  trust -= clamp((fraudRingProbability || 0) * 22, 0, 22);
  trust -= clamp((fraudScore || 0) * 0.22, 0, 22);

  if ((weatherDisruptionProbability || 0) > 0.65) trust += 5;
  if ((severityMultiplier || 1) > 1.35) trust += 3;
  if (socialSeverityClass === "HIGH") trust += 3;
  if (socialSeverityClass === "MEDIUM") trust += 1;

  return Math.round(clamp(trust, 0, 100));
}

export function getDecisionFromTrust(trustScore) {
  if (trustScore > 70) return "APPROVED";
  if (trustScore >= 40) return "HOLD";
  return "REJECTED";
}
