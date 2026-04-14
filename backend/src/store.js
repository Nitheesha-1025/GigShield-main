export const db = {
  users: [],
  policies: [],
  claims: [],
  payouts: [],
  fraud_logs: []
};

export const plans = [
  {
    id: "basic",
    name: "Basic",
    basePremium: 29,
    coveragePercent: 0.5,
    coverageLabel: "50% coverage (Rain only)",
    coverage: "Rain-only basic protection"
  },
  {
    id: "standard",
    name: "Standard",
    basePremium: 49,
    coveragePercent: 0.7,
    coverageLabel: "70% coverage (Rain + Social)",
    coverage: "Rain + traffic protection"
  },
  {
    id: "pro",
    name: "Pro",
    basePremium: 79,
    coveragePercent: 0.9,
    coverageLabel: "90% coverage (All events)",
    coverage: "All disruption full protection"
  }
];

export function getTierCoveragePercent(planId) {
  const plan = plans.find((p) => p.id === planId);
  return plan?.coveragePercent ?? 0.5;
}

export const zoneRiskMap = {
  adyar: { floodProne: true, safeZone: false, baseRisk: 70 },
  anna_nagar: { floodProne: false, safeZone: true, baseRisk: 30 },
  velachery: { floodProne: true, safeZone: false, baseRisk: 75 },
  t_nagar: { floodProne: false, safeZone: false, baseRisk: 45 },
  porur: { floodProne: false, safeZone: true, baseRisk: 25 }
};
