import { useMemo } from "react";
import { useGigStore } from "../store/useGigStore.js";

function formatInr(n) {
  const v = Math.round(Number(n) || 0);
  return `₹${v.toLocaleString("en-IN")}`;
}

export default function LiveOpsPanel({
  profile,
  policy,
  disruption,
  risk,
  forecast,
  ml,
  payout,
  activeScenarios,
  hourlyOverride,
  onHourlyChange,
  shiftOverride,
  onShiftChange,
  loading,
  wsConnected,
  onToast
}) {
  const rainfall = useGigStore((s) => s.rainfall);
  const riskScore = useGigStore((s) => s.riskScore);
  const disruptionPct = useGigStore((s) => s.disruptionProbability);
  const severity = useGigStore((s) => s.severity);
  const storeDisruptedHours = useGigStore((s) => s.disruptedHours);
  const next7DayForecast = useGigStore((s) => s.next7DayForecast);
  const tierPct = useGigStore((s) => s.tier);
  const triggerManualClaim = useGigStore((s) => s.triggerManualClaim);

  const rain = rainfall;
  const rainPct = Math.min(100, (rain / 80) * 100);

  const chartForecast =
    next7DayForecast?.length > 0
      ? next7DayForecast
      : forecast?.next7DayForecast || ml?.m2?.next7DayForecast || [];

  const defaultHourly =
    (profile?.dailyIncome || 0) / Math.max(1, profile?.workingHours || 1);
  const hourly = hourlyOverride ?? defaultHourly;
  const shiftH = shiftOverride ?? profile?.workingHours ?? 8;

  const disrupted =
    storeDisruptedHours > 0 ? Math.min(storeDisruptedHours, shiftH) : 0;

  const liveAmount = useMemo(() => {
    if (!disrupted) return 0;
    return Math.round(hourly * disrupted * severity * tierPct);
  }, [hourly, disrupted, severity, tierPct]);

  const clientHeavyRain = rain > 35;
  const displayTriggers = useMemo(() => {
    const list = [...(activeScenarios || [])];
    if (clientHeavyRain && !list.some((s) => s.type === "Heavy Rain")) {
      list.unshift({
        type: "Heavy Rain (live sim)",
        triggerCondition: "Rainfall > 35 mm/hr (global store)"
      });
    }
    return list;
  }, [activeScenarios, clientHeavyRain]);

  const tierLabel =
    policy?.planName ||
    (policy?.planId === "standard"
      ? "Standard"
      : policy?.planId === "pro"
        ? "Pro"
        : "Basic");

  function handleTriggerClaim() {
    const claim = triggerManualClaim({
      hourly,
      shiftCap: shiftH,
      onReject: (msg) => onToast?.(msg)
    });
    if (claim) {
      onToast?.(`Claim stored: ₹${claim.payout.toLocaleString("en-IN")}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black tracking-tight">Live operations</h2>
          <p className="text-sm text-slate-500">
            Global store tick ~3s · server WS{" "}
            <span className={wsConnected ? "text-emerald-600 font-medium" : "text-amber-600"}>
              {wsConnected ? "connected" : "offline"}
            </span>
            {loading ? " · REST syncing…" : ""}
          </p>
          {import.meta.env.DEV && (
            <p className="text-[10px] text-slate-400 mt-1">
              Server rain (REST/WS):{" "}
              {disruption?.rainfallMmPerHr ?? disruption?.rainfall ?? "—"} mm/hr
            </p>
          )}
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">M1 Risk</span>
          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">M2 LSTM</span>
          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">M3 RF</span>
          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">M4 GMM</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="card relative overflow-hidden min-h-[140px]">
          <div
            className="rain-anim pointer-events-none absolute inset-0 opacity-25"
            style={{ "--rain-intensity": `${Math.min(1, rain / 60)}` }}
          />
          <p className="text-sm text-slate-500 relative z-10">Rainfall (mm/hr)</p>
          <p className="text-4xl font-black text-sky-700 relative z-10 tabular-nums transition-all duration-500">
            {Number(rain).toFixed(1)}
          </p>
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden relative z-10">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${rainPct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2 relative z-10">
            Heavy rain trigger: &gt; 35 mm/hr
          </p>
        </div>

        <div className="card min-h-[140px]">
          <p className="text-sm text-slate-500">Disruption probability (M2)</p>
          <p className="text-4xl font-black text-brand-700 tabular-nums transition-all duration-500">
            {Math.round(disruptionPct)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Scaled 0–100 from rainfall (store)</p>
          <ul className="flex gap-1 items-end h-12 mt-3">
            {chartForecast.map((p, i) => (
              <li key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <div
                  className="w-full rounded-t bg-brand-400/90 min-h-[3px] transition-all duration-500"
                  style={{ height: `${Math.round(4 + p * 40)}px` }}
                  title={`D${i + 1}: ${(p * 100).toFixed(1)}%`}
                />
                <span className="text-[9px] text-slate-400">D{i + 1}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card min-h-[140px]">
          <p className="text-sm text-slate-500">Risk score (M1) · 0–100</p>
          <p className="text-4xl font-black text-slate-900 tabular-nums">{riskScore}</p>
          <div className="mt-3 h-2 bg-slate-100 rounded-full">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-500"
              style={{ width: `${Math.min(100, riskScore)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            AI weekly premium:{" "}
            <span className="font-semibold text-slate-800">
              {formatInr(risk?.aiAdjustedWeeklyPremium ?? risk?.finalWeeklyPremium ?? 0)}
            </span>
          </p>
        </div>

        <div className="card min-h-[140px]">
          <p className="text-sm text-slate-500">Severity multiplier (M3)</p>
          <p className="text-4xl font-black text-orange-600 tabular-nums">
            {Number(severity).toFixed(2)}×
          </p>
          <div className="mt-3 h-2 bg-slate-100 rounded-full">
            <div
              className="h-2 rounded-full bg-orange-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, ((Number(severity) - 1) / 0.8) * 100)}%`
              }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Range 1.0 – 1.8 (store)</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="card space-y-3 lg:col-span-1">
          <p className="font-semibold text-slate-800">Worker panel</p>
          <label className="block text-xs text-slate-500">
            Avg hourly earnings (editable)
            <input
              type="number"
              min={0}
              step={1}
              className="input mt-1"
              value={hourlyOverride == null ? Math.round(defaultHourly) : Math.round(hourlyOverride)}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onHourlyChange(null);
                  return;
                }
                const v = Number(raw);
                if (Number.isFinite(v)) onHourlyChange(v);
              }}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Active shift hours
            <input
              type="number"
              min={1}
              max={16}
              step={0.5}
              className="input mt-1"
              value={shiftOverride == null ? shiftH : shiftOverride}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onShiftChange(null);
                  return;
                }
                const v = Number(raw);
                if (Number.isFinite(v)) onShiftChange(v);
              }}
            />
          </label>
          <div className="text-sm border-t pt-3 space-y-1">
            <p>
              <span className="text-slate-500">Selected tier:</span>{" "}
              <span className="font-semibold">{tierLabel}</span>
            </p>
            <p className="text-xs text-slate-500">
              Store coverage: {Math.round(tierPct * 100)}% · Weekly base:{" "}
              {formatInr(policy?.basePremium ?? 29)}
            </p>
          </div>
        </div>

        <div className="card lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 text-white">
          <p className="text-slate-300 text-sm">Live payout (Zustand)</p>
          <h3 className="text-5xl font-black mt-1 tabular-nums tracking-tight">
            {formatInr(liveAmount)}
          </h3>
          <p className="text-xs text-slate-400 mt-2">
            Payout = Avg hourly × Disrupted hours × Severity × Tier %
          </p>
          <div className="mt-4 grid sm:grid-cols-2 gap-2 text-sm bg-white/10 rounded-xl p-3">
            <div>
              <p className="text-slate-400 text-xs">Avg hourly</p>
              <p className="font-mono">{hourly.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Disrupted hours (capped)</p>
              <p className="font-mono">{disrupted}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Severity</p>
              <p className="font-mono">{severity.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Tier %</p>
              <p className="font-mono">{Math.round(tierPct * 100)}%</p>
            </div>
          </div>
          {!disrupted && (
            <p className="text-xs text-amber-200/90 mt-3">
              Rainfall ≤ 35 mm/hr — disrupted hours = 0. Above 35, store sets 2h (capped by shift).
            </p>
          )}
          <button
            type="button"
            className="mt-4 w-full rounded-xl py-3 bg-brand-500 hover:bg-brand-700 text-white font-medium transition"
            onClick={handleTriggerClaim}
          >
            Trigger claim (stores in global history)
          </button>
        </div>
      </div>

      {!!displayTriggers?.length && (
        <div className="card border-amber-200 bg-amber-50/80">
          <p className="font-semibold text-amber-900">Active triggers</p>
          <ul className="mt-2 space-y-2 text-sm text-amber-950">
            {displayTriggers.map((s, i) => (
              <li
                key={`${s.type}-${i}`}
                className="flex flex-wrap justify-between gap-2 border-b border-amber-100 pb-2 last:border-0"
              >
                <span className="font-medium">{s.type}</span>
                <span className="text-amber-800 text-xs max-w-[70%] text-right">
                  {s.triggerCondition}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
