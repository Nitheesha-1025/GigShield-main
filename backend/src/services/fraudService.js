function toRad(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(a, b) {
  const earthRadius = 6371;
  const latDiff = toRad((b.lat || 0) - (a.lat || 0));
  const lngDiff = toRad((b.lng || 0) - (a.lng || 0));
  const lat1 = toRad(a.lat || 0);
  const lat2 = toRad(b.lat || 0);
  const term =
    Math.sin(latDiff / 2) ** 2 +
    Math.sin(lngDiff / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const angular = 2 * Math.atan2(Math.sqrt(term), Math.sqrt(1 - term));
  return earthRadius * angular;
}

export function detectGpsSpoofing(gpsPoints = []) {
  if (!Array.isArray(gpsPoints) || gpsPoints.length < 2) {
    return {
      spoofDetected: false,
      maxSpeedKph: 0,
      jumpKm: 0
    };
  }

  let maxSpeedKph = 0;
  let jumpKm = 0;
  for (let index = 1; index < gpsPoints.length; index++) {
    const previous = gpsPoints[index - 1];
    const current = gpsPoints[index];
    const distanceKm = haversineKm(previous, current);
    jumpKm = Math.max(jumpKm, distanceKm);
    const elapsedHours = Math.max(
      1 / 3600,
      Math.abs(new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) /
        (1000 * 60 * 60)
    );
    const speedKph = distanceKm / elapsedHours;
    maxSpeedKph = Math.max(maxSpeedKph, speedKph);
  }

  const spoofDetected = maxSpeedKph > 140 || jumpKm > 15;
  return {
    spoofDetected,
    maxSpeedKph: Number(maxSpeedKph.toFixed(2)),
    jumpKm: Number(jumpKm.toFixed(2))
  };
}

export function computeFraudScore({
  gpsSpoofing = false,
  weatherMismatch = false,
  anomalyScore = 0,
  fraudRingProbability = 0,
  fraudThreshold = 70,
  ringThreshold = 0.65
}) {
  let fraudScore = 0;
  const reasons = [];

  if (gpsSpoofing) {
    fraudScore += 50;
    reasons.push("GPS spoofing suspected");
  }

  if (weatherMismatch) {
    fraudScore += 30;
    reasons.push("Claimed weather mismatch");
  }

  if (anomalyScore > 0.7) {
    fraudScore += 20;
    reasons.push("High claim anomaly score");
  }

  if (fraudRingProbability > ringThreshold) {
    fraudScore += 40;
    reasons.push("Fraud ring probability above threshold");
  }

  return {
    fraudScore,
    isFraud: fraudScore > fraudThreshold,
    reasons
  };
}
