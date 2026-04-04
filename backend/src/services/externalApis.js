import { getWorldSnapshot } from "./worldStream.js";

export function getWeatherSignal(_zone, _lat, _lng) {
  const w = getWorldSnapshot();
  return {
    source: "Live rainfall stream (simulated)",
    rainfallMmPerHr: w.rainfallMmPerHr,
    consecutiveRainHours: Math.round(w.consecutiveRainHours * 10) / 10,
    updatedAt: w.updatedAt
  };
}

export function getTrafficSignal(_zone) {
  const w = getWorldSnapshot();
  const highTraffic = w.deliveryDropPercent > 55;
  return {
    source: "Correlated traffic stream (simulated)",
    traffic: highTraffic ? "high" : "moderate",
    deliveryDropPercent: w.deliveryDropPercent,
    flooded: w.flooded,
    updatedAt: w.updatedAt
  };
}

export function getSocialEventSignal(_pincode) {
  const w = getWorldSnapshot();
  return {
    source: "Social / bandh stream (simulated)",
    bandhVerified: w.bandhVerified,
    socialSeverityIndex: w.socialSeverityIndex,
    updatedAt: w.updatedAt
  };
}

export function getGovernmentAlertSignal(_zone) {
  const w = getWorldSnapshot();
  return {
    source: "Government alert stream (simulated)",
    section144Active: w.section144Active,
    nightCurfewActive: w.nightCurfewActive,
    curfewHours: w.curfewHours,
    updatedAt: w.updatedAt
  };
}
