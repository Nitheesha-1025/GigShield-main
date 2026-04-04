import { supabase, isSupabaseConfigured } from "./supabaseClient";

function tenureWeeksFromCreatedAt(createdAt) {
  if (!createdAt) return 0;
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
}

/**
 * Upsert worker row (id = app user id).
 */
export async function syncWorkerRow(user, policy) {
  if (!isSupabaseConfigured || !supabase || !user?.id) return;

  const avgHourly = Number(user.dailyIncome) / Math.max(1, Number(user.workingHours) || 1);

  const { error } = await supabase.from("workers").upsert(
    {
      id: user.id,
      name: user.name,
      avg_hourly_earnings: Math.round(avgHourly * 100) / 100,
      tier: policy?.planId || "basic",
      tenure_weeks: tenureWeeksFromCreatedAt(user.createdAt),
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (error) console.warn("GigShield Supabase workers upsert:", error.message);
}

export async function syncRiskScore(workerId, riskScore) {
  if (!isSupabaseConfigured || !supabase || !workerId) return;

  const { error } = await supabase.from("risk_scores").upsert(
    {
      worker_id: workerId,
      risk_score: Math.round(riskScore),
      updated_at: new Date().toISOString()
    },
    { onConflict: "worker_id" }
  );

  if (error) console.warn("GigShield Supabase risk_scores upsert:", error.message);
}

export async function insertPayoutRow({ workerId, amount, disruptedHours, severityMultiplier }) {
  if (!isSupabaseConfigured || !supabase || !workerId) return;

  const { error } = await supabase.from("payouts").insert({
    worker_id: workerId,
    amount: Math.round(amount),
    disrupted_hours: disruptedHours,
    severity_multiplier: severityMultiplier,
    created_at: new Date().toISOString()
  });

  if (error) console.warn("GigShield Supabase payouts insert:", error.message);
}

export function subscribeRiskScores(workerId, onUpdate) {
  if (!isSupabaseConfigured || !supabase || !workerId) return () => {};

  const channel = supabase
    .channel(`risk_scores:${workerId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "risk_scores",
        filter: `worker_id=eq.${workerId}`
      },
      (payload) => onUpdate?.(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
