import { create } from "zustand";

export const STATIC_PLANS = [
  { id: "basic", name: "Basic", price: 29, coverage: 0.5 },
  { id: "standard", name: "Standard", price: 49, coverage: 0.7 },
  { id: "pro", name: "Pro", price: 79, coverage: 0.9 }
];

function buildForecast(p01) {
  const out = [];
  let prev = p01;
  for (let i = 0; i < 7; i++) {
    if (i === 0) {
      out.push(Number(Math.max(0.05, Math.min(0.95, p01)).toFixed(3)));
    } else {
      prev = Math.max(0.05, Math.min(0.95, prev * 0.9 + Math.sin(i * 0.9) * 0.04));
      out.push(Number(prev.toFixed(3)));
    }
  }
  return out;
}

function newClaimId() {
  return globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}`;
}

export const useGigStore = create((set, get) => ({
  rainfall: 0,
  riskScore: 0,
  /** 0–100 scale (display as % without multiplying again) */
  disruptionProbability: 0,
  severity: 1,
  disruptedHours: 0,
  next7DayForecast: [],
  tier: 0.5,
  planId: "basic",
  claims: [],
  staticPlans: STATIC_PLANS,

  setRainfall: (value) => set({ rainfall: value }),

  updateFromRainfall: (rainfall) => {
    let risk;
    let disruption;
    let severity;
    let disruptedHours;

    if (rainfall > 35) {
      disruption = Math.min(100, rainfall * 1.2);
      severity = Math.min(1.8, 1 + rainfall / 100);
      risk = Math.min(100, rainfall * 1.5);
      disruptedHours = 2;
    } else {
      disruption = rainfall;
      severity = Math.min(1.8, 1 + rainfall / 200);
      risk = Math.min(100, rainfall);
      disruptedHours = 0;
    }

    const p01 = Math.min(1, Math.max(0, disruption / 100));

    set({
      riskScore: Math.round(risk),
      disruptionProbability: disruption,
      severity: Number(Math.min(1.8, severity).toFixed(2)),
      disruptedHours,
      next7DayForecast: buildForecast(p01)
    });
  },

  setTierFromPlanId: (id) => {
    const planId = id || "basic";
    const tier =
      planId === "standard" ? 0.7 : planId === "pro" ? 0.9 : 0.5;
    set({ tier, planId });
  },

  addClaim: (claim) =>
    set((state) => ({
      claims: [
        {
          ...claim,
          clientGenerated: true,
          status: claim.status ?? "Approved"
        },
        ...state.claims.filter((c) => c.id !== claim.id)
      ]
    })),

  /** Merge server history without dropping client-triggered rows */
  hydrateClaimsFromServer: (serverRows) =>
    set((state) => {
      const serverList = Array.isArray(serverRows) ? serverRows : [];
      const clientOnly = state.claims.filter((c) => c.clientGenerated);
      const serverIds = new Set(serverList.map((r) => r.id));
      const merged = [
        ...serverList,
        ...clientOnly.filter((c) => !serverIds.has(c.id))
      ];
      merged.sort((a, b) => new Date(b.date) - new Date(a.date));
      return { claims: merged };
    }),

  triggerManualClaim: ({ hourly, shiftCap, onReject }) => {
    const { rainfall, severity, disruptedHours, tier } = get();
    if (rainfall <= 35) {
      onReject?.("Rainfall must exceed 35 mm/hr to trigger a claim.");
      return null;
    }
    const dh = Math.min(disruptedHours || 2, shiftCap || 8);
    const amount = Math.round(hourly * dh * severity * tier);
    const claim = {
      id: newClaimId(),
      date: new Date().toISOString(),
      disruptionType: "Heavy Rain (trigger)",
      lostHours: dh,
      severityFactor: severity,
      payout: amount
    };
    get().addClaim(claim);
    return claim;
  }
}));
