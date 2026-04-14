import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  adminClaimDecision,
  getAdminDashboard,
  getAdminMlDashboard,
  getWorkerDashboard,
  getWsLiveUrl,
  processClaim,
  request,
  simulatePayout,
  submitClaim
} from "../api";
import Layout from "../components/Layout";
import LiveOpsPanel from "../components/LiveOpsPanel.jsx";
import {
  insertPayoutRow,
  subscribeRiskScores,
  syncRiskScore,
  syncWorkerRow
} from "../syncSupabase.js";
import { useGigStore } from "../store/useGigStore.js";
import GigLiveDriver from "../components/GigLiveDriver.jsx";

function riskLevelBarClass(level) {
  if (level === "High") return { text: "text-red-500", bar: "bg-red-500", w: 88 };
  if (level === "Medium") return { text: "text-orange-500", bar: "bg-orange-500", w: 58 };
  return { text: "text-green-500", bar: "bg-green-500", w: 28 };
}

function DashboardHome({
  profile,
  policy,
  risk,
  disruption,
  activeScenarios,
  loading,
  forecast,
  baseline,
  ml,
  payout,
  hourlyOverride,
  onHourlyChange,
  shiftOverride,
  onShiftChange,
  wsConnected,
  onToast
}) {
  const rainfall = useGigStore((s) => s.rainfall);
  const storeRiskScore = useGigStore((s) => s.riskScore);
  const disruptionPct = useGigStore((s) => s.disruptionProbability);
  const next7FromStore = useGigStore((s) => s.next7DayForecast);
  const storeSeverity = useGigStore((s) => s.severity);

  const rainSimLabel =
    rainfall > 35 ? "High" : rainfall > 18 ? "Medium" : "Low";
  const rain = riskLevelBarClass(rainSimLabel);
  const traffic = riskLevelBarClass(risk?.trafficRisk || "Low");
  const curfewLevel = disruption?.curfew ? "High" : "Low";
  const curfew = riskLevelBarClass(curfewLevel);
  return (
    <div className="space-y-4">
      <LiveOpsPanel
        profile={profile}
        policy={policy}
        disruption={disruption}
        risk={risk}
        forecast={forecast}
        ml={ml}
        payout={payout}
        activeScenarios={activeScenarios}
        hourlyOverride={hourlyOverride}
        onHourlyChange={onHourlyChange}
        shiftOverride={shiftOverride}
        onShiftChange={onShiftChange}
        loading={loading}
        wsConnected={wsConnected}
        onToast={onToast}
      />
      <p className="text-slate-500 -mt-2">Welcome back, {profile?.name || "Partner"}. Here's your shift overview.</p>
      {(!!activeScenarios?.length || rainfall > 35) && (
        <div className="card border-red-200 bg-red-50">
          <p className="font-semibold text-red-600">Heavy Rain Detected</p>
          <p className="text-red-500 text-sm">
            Store rainfall is {rainfall.toFixed(1)} mm/hr. Delivery operations may be affected.
          </p>
        </div>
      )}
      <div className="grid lg:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-r from-brand-500 to-brand-700 text-white">
          <p className="text-sm text-brand-100">Weekly Earnings</p>
          <h3 className="font-bold text-4xl">Rs.{Math.round((profile?.dailyIncome || 0) * 7)}</h3>
          <p className="text-xs text-brand-100">+12% from last week</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-sm">Active Insurance</p>
          <h3 className="font-semibold text-3xl">{policy?.planName || "Basic"}</h3>
          <p className="text-sm text-slate-500">Upto Rs.{(policy?.basePremium || 49) * 60} coverage</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-sm">Risk Score (0–100)</p>
          <h3 className="font-semibold text-3xl">{storeRiskScore}</h3>
          <div className="mt-3 h-2 bg-slate-100 rounded-full">
            <div
              className="h-2 bg-gradient-to-r from-brand-500 to-red-500 rounded-full transition-all duration-500"
              style={{ width: `${storeRiskScore}%` }}
            />
          </div>
        </div>
        <div className="card">
          <p className="text-slate-500 text-sm">Delivery Zone</p>
          <h3 className="font-semibold text-3xl">{profile?.zone || "-"}</h3>
          <p className="text-sm text-slate-500">{profile?.workingHours || 0}h avg shift</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-3xl font-black">Disruption Monitor Widget</h3>
          <p className="text-sm text-slate-500 mb-3">Real-time environmental & social signals</p>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 border flex justify-between">
              <div>
                <p className="font-semibold">Rainfall Level</p>
                <p className="text-sm text-slate-500">
                  {rainfall.toFixed(1)} mm/hr (store) · severity {storeSeverity.toFixed(2)}× · server:{" "}
                  {disruption?.rainfall ?? disruption?.rainfallMmPerHr ?? "—"}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600 h-fit">Alert</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border flex justify-between">
              <div>
                <p className="font-semibold">Traffic Congestion</p>
                <p className="text-sm text-slate-500">{disruption?.traffic || "-"} density in {profile?.zone}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-600 h-fit">High</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border flex justify-between">
              <div>
                <p className="font-semibold">Claim Automation</p>
                <p className="text-sm text-slate-500">{loading ? "Checking..." : "Synced"}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600 h-fit">Live</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-3xl font-black">AI Risk Analysis</h3>
          <p className="text-sm text-slate-500 mb-3">Predictive impact on daily earnings (M1)</p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Rain Risk</span>
                <span className={`${rain.text} font-semibold`}>{rainSimLabel}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full">
                <div className={`h-2 rounded-full ${rain.bar}`} style={{ width: `${rain.w}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Traffic Risk</span>
                <span className={`${traffic.text} font-semibold`}>{risk?.trafficRisk ?? "—"}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full">
                <div className={`h-2 rounded-full ${traffic.bar}`} style={{ width: `${traffic.w}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Curfew Risk</span>
                <span className={`${curfew.text} font-semibold`}>{curfewLevel}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full">
                <div className={`h-2 rounded-full ${curfew.bar}`} style={{ width: `${curfew.w}%` }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Premium multiplier: {risk?.premiumMultiplier != null ? `${risk.premiumMultiplier}×` : "—"}
            {" · "}
            AI weekly:{" "}
            {risk?.aiAdjustedWeeklyPremium != null
              ? `₹${risk.aiAdjustedWeeklyPremium}`
              : "—"}
          </p>
          <p className="text-sm text-slate-500 mt-3">{risk?.explanation || "Model is collecting signal telemetry."}</p>
          {risk?.aiPremiumExplanation && (
            <p className="text-xs text-slate-400 mt-1">{risk.aiPremiumExplanation}</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-xl font-black">Disruption Forecast</h3>
          <p className="text-sm text-slate-500 mb-3">ML weather outlook (M2)</p>
          <p className="text-sm mb-1">
            <span className="text-slate-500">Disruption probability (live sim):</span>{" "}
            <span className="font-semibold text-brand-600">{Math.round(disruptionPct)}%</span>
          </p>
          <p className="text-xs text-slate-500 mb-2">Next 7 days (model probabilities)</p>
          <ul className="flex gap-1.5 items-end h-14 min-h-[3.5rem]">
            {(next7FromStore?.length ? next7FromStore : forecast?.next7DayForecast || []).map((p, i) => (
              <li key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <div
                  className="w-full rounded-t bg-brand-400 min-h-[3px]"
                  style={{ height: `${Math.round(4 + p * 48)}px` }}
                  title={`Day ${i + 1}: ${(p * 100).toFixed(1)}%`}
                />
                <span className="text-[10px] text-slate-400">D{i + 1}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3 className="text-xl font-black">Behavioral baseline</h3>
          <p className="text-sm text-slate-500 mb-3">Typical work pattern + deviation (M4)</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-slate-50 border">
              <p className="text-slate-500">Avg hours</p>
              <p className="font-semibold text-lg">{baseline?.avgHours ?? "—"}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border">
              <p className="text-slate-500">Avg income</p>
              <p className="font-semibold text-lg">Rs.{baseline?.avgIncome ?? "—"}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border">
              <p className="text-slate-500">Typical zone</p>
              <p className="font-semibold text-lg">{baseline?.typicalZone ?? "—"}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border">
              <p className="text-slate-500">Deviation score</p>
              <p className="font-semibold text-lg">{baseline?.deviationScore ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlansPage({ plans, selectedPlan, subscribe }) {
  const staticPlans = useGigStore((s) => s.staticPlans);
  const effectivePlans =
    plans?.length > 0
      ? plans
      : staticPlans.map((p) => ({
          id: p.id,
          name: p.name,
          basePremium: p.price
        }));

  const planMeta = {
    basic: {
      coverage: 1500,
      pct: "50%",
      features: ["₹29/week · 50% payout coverage (rain only)", "Auto payout trigger", "Basic dashboard access"]
    },
    standard: {
      coverage: 3000,
      pct: "70%",
      features: ["₹49/week · 70% payout coverage (rain + social)", "Traffic & bandh signals", "AI risk prediction", "Faster claim processing"]
    },
    pro: {
      coverage: 5000,
      pct: "90%",
      features: ["₹79/week · 90% payout coverage (all events)", "Fraud / trust signals (M4)", "Priority claim payouts", "Advanced risk analytics"]
    }
  };
  return (
    <div className="space-y-6">
      <p className="text-slate-500 text-center">Choose the coverage that fits your needs.</p>
      <div className="grid lg:grid-cols-3 gap-4">
      {effectivePlans.map((plan) => (
        <div key={plan.id} className={`card p-6 ${selectedPlan === plan.id ? "border-brand-300 shadow-lg" : ""}`}>
          {plan.id === "standard" && <p className="text-xs bg-brand-500 text-white w-fit px-3 py-1 rounded-full mx-auto -mt-10 mb-3">Recommended</p>}
          <h3 className="font-black text-4xl text-center">{plan.name} Plan</h3>
          <p className="my-2 text-center text-5xl font-black">Rs.{plan.basePremium}<span className="text-lg text-slate-500 font-medium"> / week</span></p>
          <p className="text-sm text-brand-600 text-center mb-4">
            {planMeta[plan.id]?.pct} parametric payout · illustrative cap Rs.{planMeta[plan.id]?.coverage}
          </p>
          <div className="space-y-2 mb-4">
            {(planMeta[plan.id]?.features || []).map((item) => (
              <p key={item} className="text-sm text-slate-600">- {item}</p>
            ))}
          </div>
          <button className={`mt-3 w-full rounded-xl py-2 ${selectedPlan === plan.id ? "bg-slate-100 text-slate-500" : "btn-primary"}`} onClick={() => subscribe(plan.id)}>
            {selectedPlan === plan.id ? "Current Plan" : "Subscribe"}
          </button>
        </div>
      ))}
      </div>
      <div className="card">
        <p className="font-semibold">How does parametric insurance work?</p>
        <p className="text-sm text-slate-500">
          Unlike traditional insurance, you don't need to prove damage. If a predefined disruption event occurs, payout is triggered automatically to your wallet.
        </p>
      </div>
    </div>
  );
}

function DisruptionPage({ disruption, apiSignals, activeScenarios, forecast }) {
  const storeRain = useGigStore((s) => s.rainfall);
  const storeRisk = useGigStore((s) => s.riskScore);
  const storeDisruptionPct = useGigStore((s) => s.disruptionProbability);
  const storeSeverity = useGigStore((s) => s.severity);
  const topScenario = activeScenarios?.[0];
  return (
    <div className="space-y-4">
      <p className="text-slate-500 -mt-2">Live telemetry for your delivery zone</p>
      <div className="card bg-slate-900 text-white">
        <p className="text-xs text-slate-400">Global store (synced across pages)</p>
        <p className="text-sm mt-1">
          Rain {storeRain.toFixed(1)} mm/hr · Risk {storeRisk} · Disruption {Math.round(storeDisruptionPct)}%
          · Severity {storeSeverity.toFixed(2)}×
        </p>
      </div>
      {!!activeScenarios?.length && (
        <div className="card border-amber-200 bg-amber-50">
          <p className="font-semibold text-amber-800">Active disruption scenarios</p>
          <ul className="mt-2 text-sm text-amber-900 space-y-1">
            {activeScenarios.map((s) => (
              <li key={s.type}>
                <span className="font-medium">{s.type}</span>
                {" — "}
                <span className="text-amber-700">
                  Severity: {s.severityFactor != null ? `${Number(s.severityFactor).toFixed(2)}×` : "—"} (M3)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-slate-600">
        Store disruption index:{" "}
        <span className="font-semibold">{Math.round(storeDisruptionPct)}%</span>
        {forecast?.disruptionProbability != null && (
          <span className="text-slate-400">
            {" "}
            · Server M2: {Math.round(forecast.disruptionProbability * 100)}%
          </span>
        )}
      </p>
      <div className="card border-red-200 bg-red-50">
        <p className="font-semibold text-red-600">Insurance Trigger Activated</p>
        <p className="text-sm text-red-500">
          Heavy rain threshold: &gt; 35 mm/hr. Store: {storeRain.toFixed(1)} mm/hr · Server:{" "}
          {disruption?.rainfall ?? disruption?.rainfallMmPerHr ?? 0} mm/hr.
        </p>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="flex justify-between">
            <div>
              <p className="font-semibold text-2xl">Weather Monitoring</p>
              <p className="text-sm text-slate-500">Real-time precipitation metrics</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600 h-fit">Status: Alert</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <div className="p-4 bg-slate-50 rounded-xl border">
              <p className="text-sm text-slate-500">Current Rainfall</p>
              <p className="text-5xl font-black text-red-500">
                {storeRain.toFixed(1)}
                <span className="text-xl text-slate-600"> mm/hr</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Server: {disruption?.rainfall ?? disruption?.rainfallMmPerHr ?? "—"} mm/hr
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border">
              <p className="text-sm text-slate-500">Trigger Threshold</p>
              <p className="text-5xl font-black">35<span className="text-xl text-slate-600"> mm/hr</span></p>
            </div>
          </div>
            <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-red-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (storeRain / 80) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-right text-red-500 mt-1">Threshold: 35 mm/hr</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card">
            <p className="font-semibold text-2xl">Traffic Monitoring</p>
            <p className="text-sm text-slate-500">Density level</p>
            <p className="text-4xl font-black text-orange-500 mt-2">{disruption?.traffic || "-"}</p>
          </div>
          <div className="card">
            <p className="font-semibold text-2xl">Curfew Monitoring</p>
            <p className="text-sm text-slate-500">Status</p>
              <p className="text-4xl font-black text-green-500 mt-2">{disruption?.curfew ? "Active" : "None"}</p>
            <p className="text-xs text-slate-500 mt-2">Rain streak: {apiSignals?.weather?.consecutiveRainHours || 0} hrs</p>
            <p className="text-xs font-semibold text-slate-700 mt-2">
              Severity (store M3): {storeSeverity.toFixed(2)}×
              {topScenario?.severityFactor != null && (
                <span className="text-slate-500">
                  {" "}
                  · Scenario: {Number(topScenario.severityFactor).toFixed(2)}×
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClaimsPage({ role, claims, onSubmitClaim, onProcessClaim, onSimulatePayout }) {
  const [form, setForm] = useState({
    zone: "velachery",
    claimedWeather: "heavy rain",
    lostHours: 2,
    provider: "razorpay_sandbox",
    socialText: "",
    gpsPoints: ""
  });

  async function submitNewClaim(event) {
    event.preventDefault();
    const gpsPoints = form.gpsPoints
      ? form.gpsPoints
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [lat, lng, timestamp] = line.split(",").map((x) => x.trim());
            return { lat: Number(lat), lng: Number(lng), timestamp };
          })
      : [];

    await onSubmitClaim({
      zone: form.zone,
      claimedWeather: form.claimedWeather,
      lostHours: Number(form.lostHours),
      provider: form.provider,
      socialText: form.socialText,
      gpsPoints
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-500 -mt-2">
        {role === "admin"
          ? "Admin claim review console: process claims and monitor payout eligibility."
          : "Worker claim history: submit claims and receive payout when admin approves."}
      </p>
      {role !== "admin" && (
      <form onSubmit={submitNewClaim} className="card grid md:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Zone"
          value={form.zone}
          onChange={(event) => setForm({ ...form, zone: event.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Claimed Weather"
          value={form.claimedWeather}
          onChange={(event) => setForm({ ...form, claimedWeather: event.target.value })}
        />
        <input
          className="input"
          type="number"
          min="1"
          placeholder="Lost Hours"
          value={form.lostHours}
          onChange={(event) => setForm({ ...form, lostHours: event.target.value })}
          required
        />
        <select
          className="input"
          value={form.provider}
          onChange={(event) => setForm({ ...form, provider: event.target.value })}
        >
          <option value="razorpay_sandbox">Razorpay Sandbox</option>
          <option value="stripe_sandbox">Stripe Sandbox</option>
          <option value="mock_gateway">Mock Gateway</option>
        </select>
        <textarea
          className="input md:col-span-2 min-h-[64px]"
          placeholder="Social context (optional)"
          value={form.socialText}
          onChange={(event) => setForm({ ...form, socialText: event.target.value })}
        />
        <textarea
          className="input md:col-span-2 min-h-[96px]"
          placeholder="GPS points: one per line => lat,lng,ISO timestamp"
          value={form.gpsPoints}
          onChange={(event) => setForm({ ...form, gpsPoints: event.target.value })}
        />
        <button className="btn-primary md:col-span-2" type="submit">
          Submit Claim
        </button>
      </form>
      )}
      <div className="card overflow-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-2">Date</th>
            <th>Type</th>
            <th>Trust</th>
            <th>Hours Lost</th>
            <th>Severity</th>
            <th>Compensation</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id} className="border-t">
              <td className="py-2">{new Date(claim.createdAt || claim.date).toLocaleString()}</td>
              <td>{claim.disruptionType || claim.zone || "-"}</td>
              <td>{claim.trustScore ?? claim.pipeline?.m8TrustScore ?? "—"}</td>
              <td>{claim.lostHours}</td>
              <td>{claim.pipeline?.m3SeverityMultiplier != null ? `${Number(claim.pipeline.m3SeverityMultiplier).toFixed(2)}×` : claim.severityFactor != null ? `${Number(claim.severityFactor).toFixed(2)}×` : "—"}</td>
              <td>Rs.{claim.payoutAmount ?? claim.payout ?? claim.amount ?? 0}</td>
              <td><span className={`text-xs px-2 py-1 rounded-full ${claim.status === "APPROVED" || claim.status === "Approved" ? "bg-green-100 text-green-700" : claim.status === "PENDING_REVIEW" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{claim.status}</span></td>
              <td className="space-x-2">
                {role === "admin" && (
                  <button
                    className="px-2 py-1 text-xs rounded border"
                    onClick={() => onProcessClaim(claim.id)}
                  >
                    Process
                  </button>
                )}
                {role !== "admin" && claim.status === "APPROVED_PENDING_PAYOUT" && (
                  <button
                    className="px-2 py-1 text-xs rounded border"
                    onClick={() =>
                      onSimulatePayout(claim.id, claim.payoutAmount || claim.payout || claim.amount || 0)
                    }
                  >
                    Receive payout
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!claims.length && <p className="text-sm text-slate-500 mt-2">No claims yet.</p>}
      </div>
    </div>
  );
}

function WorkerDashboardPage({ workerStats }) {
  return (
    <div className="space-y-4">
      <p className="text-slate-500 -mt-2">Worker insurance protection metrics from backend.</p>
      <div className="grid md:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-sm text-slate-500">Total earnings protected</p>
          <p className="text-3xl font-black">Rs.{Math.round(workerStats?.totalEarningsProtected || 0)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Weekly coverage claims</p>
          <p className="text-3xl font-black">{workerStats?.weeklyCoverage || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Approved count</p>
          <p className="text-3xl font-black">{workerStats?.statusBreakdown?.approved || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Pending / Submitted</p>
          <p className="text-3xl font-black">{workerStats?.statusBreakdown?.pendingSubmitted || 0}</p>
        </div>
      </div>
    </div>
  );
}

function AdminDashboardPage({
  adminStats,
  adminMlStats,
  claims,
  onProcessClaim,
  onManualDecision,
  processingClaimIds
}) {
  const heatmapRows = Object.entries(adminStats?.highRiskZoneHeatmap || {});
  return (
    <div className="space-y-4">
      <p className="text-slate-500 -mt-2">Admin fraud, payout, and forecasting intelligence.</p>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="card">
          <p className="text-sm text-slate-500">Total claims</p>
          <p className="text-3xl font-black">{adminStats?.totalClaims || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Total payouts</p>
          <p className="text-3xl font-black">{adminStats?.totalPayouts || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Total paid</p>
          <p className="text-3xl font-black">Rs.{Math.round(adminStats?.totalPaid || 0)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Approved count</p>
          <p className="text-3xl font-black">{adminStats?.approvedCount || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Pending / Submitted</p>
          <p className="text-3xl font-black">{adminStats?.pendingSubmittedCount || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Loss ratio</p>
          <p className="text-3xl font-black">{((adminStats?.lossRatio || 0) * 100).toFixed(1)}%</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Fraud detection rate</p>
          <p className="text-3xl font-black">{((adminStats?.fraudDetectionRate || 0) * 100).toFixed(1)}%</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Next-week claim prediction</p>
          <p className="text-3xl font-black">{adminStats?.nextWeekClaimsPrediction || 0}</p>
        </div>
      </div>
      <div className="card">
        <p className="font-semibold mb-2">High-risk zone heatmap</p>
        {!heatmapRows.length && <p className="text-sm text-slate-500">No zone data yet.</p>}
        {!!heatmapRows.length && (
          <div className="space-y-2">
            {heatmapRows.map(([zone, count]) => (
              <div key={zone}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="uppercase">{zone}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div
                    className="h-2 bg-red-500 rounded-full"
                    style={{ width: `${Math.min(100, Number(count) * 10)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <p className="font-semibold mb-2">M5-M8 Pipeline Dashboard</p>
        <div className="grid md:grid-cols-4 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-slate-500">M5 Avg anomaly</p>
            <p className="text-2xl font-black">{adminMlStats?.m5?.avgAnomalyScore ?? 0}</p>
            <p className="text-xs text-slate-500">High anomaly: {adminMlStats?.m5?.highAnomalyClaims ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-slate-500">M6 Avg ring probability</p>
            <p className="text-2xl font-black">{adminMlStats?.m6?.avgFraudRingProbability ?? 0}</p>
            <p className="text-xs text-slate-500">High ring risk: {adminMlStats?.m6?.ringRiskClaims ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-slate-500">M7 Severity mix</p>
            <p className="text-xs mt-1">HIGH: {adminMlStats?.m7?.severityDistribution?.HIGH ?? 0}</p>
            <p className="text-xs">MEDIUM: {adminMlStats?.m7?.severityDistribution?.MEDIUM ?? 0}</p>
            <p className="text-xs">LOW/NONE: {(adminMlStats?.m7?.severityDistribution?.LOW ?? 0) + (adminMlStats?.m7?.severityDistribution?.NONE ?? 0)}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-slate-500">M8 Avg trust score</p>
            <p className="text-2xl font-black">{adminMlStats?.m8?.avgTrustScore ?? 0}</p>
            <p className="text-xs text-slate-500">
              A/H/R: {adminMlStats?.m8?.approvedBand ?? 0}/{adminMlStats?.m8?.holdBand ?? 0}/
              {adminMlStats?.m8?.rejectBand ?? 0}
            </p>
          </div>
        </div>
      </div>
      <div className="card overflow-auto">
        <p className="font-semibold mb-3">Admin claim processing queue</p>
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2">Claim ID</th>
              <th>Worker</th>
              <th>Status</th>
              <th>M4</th>
              <th>M5</th>
              <th>M6</th>
              <th>M7</th>
              <th>M8</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id} className="border-t">
                <td className="py-2">{claim.id.slice(0, 8)}</td>
                <td>{claim.userId?.slice(0, 8)}</td>
                <td>{claim.status}</td>
                <td>{claim.pipeline?.m4BehaviorDeviation ?? 0}</td>
                <td>{claim.pipeline?.m5AnomalyScore ?? 0}</td>
                <td>{claim.pipeline?.m6FraudRingProbability ?? 0}</td>
                <td>{claim.pipeline?.m7SocialSeverity?.severityClass ?? "NONE"}</td>
                <td>{claim.trustScore ?? claim.pipeline?.m8TrustScore ?? 0}</td>
                <td>
                  {claim.status === "SUBMITTED" && (
                    <button
                      className="px-2 py-1 text-xs rounded border disabled:opacity-60"
                      onClick={() => onProcessClaim(claim.id)}
                      disabled={processingClaimIds.has(claim.id)}
                    >
                      {processingClaimIds.has(claim.id) ? "Processing..." : "Process"}
                    </button>
                  )}
                  {claim.status === "PENDING_REVIEW" && (
                    <>
                      <button
                        className="px-2 py-1 text-xs rounded border border-green-400 text-green-700"
                        onClick={() => onManualDecision(claim.id, "APPROVED")}
                      >
                        Approve
                      </button>
                      <button
                        className="ml-2 px-2 py-1 text-xs rounded border border-red-400 text-red-700"
                        onClick={() => onManualDecision(claim.id, "REJECTED")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MlPipelinePage({ baseline, claims, role }) {
  const rows = Array.isArray(claims) ? claims : [];
  const withPipeline = rows.filter((claim) => claim.pipeline);
  const count = withPipeline.length || 1;
  const m5Avg =
    withPipeline.reduce((sum, claim) => sum + Number(claim.pipeline?.m5AnomalyScore || 0), 0) / count;
  const m6Avg =
    withPipeline.reduce((sum, claim) => sum + Number(claim.pipeline?.m6FraudRingProbability || 0), 0) / count;
  const m8Avg =
    withPipeline.reduce(
      (sum, claim) => sum + Number(claim.trustScore ?? claim.pipeline?.m8TrustScore ?? 0),
      0
    ) / count;
  const m5High = withPipeline.filter((claim) => Number(claim.pipeline?.m5AnomalyScore || 0) > 0.7).length;
  const m6High = withPipeline.filter((claim) => Number(claim.pipeline?.m6FraudRingProbability || 0) > 0.65).length;
  const m7Dist = withPipeline.reduce(
    (acc, claim) => {
      const cls = String(claim.pipeline?.m7SocialSeverity?.severityClass || "NONE").toUpperCase();
      if (acc[cls] == null) acc.NONE += 1;
      else acc[cls] += 1;
      return acc;
    },
    { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 }
  );

  return (
    <div className="space-y-4">
      <p className="text-slate-500 -mt-2">
        {role === "admin"
          ? "Admin ML pipeline monitor for claim fraud and trust scoring."
          : "Worker ML insights from your processed claim pipeline."}
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card">
          <p className="text-sm text-slate-500">M4 Behavioral baseline</p>
          <p className="text-xs mt-2">Avg hours: {baseline?.avgHours ?? "—"}</p>
          <p className="text-xs">Avg income: Rs.{baseline?.avgIncome ?? "—"}</p>
          <p className="text-xs">Deviation: {baseline?.deviationScore ?? "—"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">M5 Anomaly Detector</p>
          <p className="text-3xl font-black">{Number(m5Avg || 0).toFixed(3)}</p>
          <p className="text-xs text-slate-500">High anomaly claims: {m5High}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">M6 Fraud Graph</p>
          <p className="text-3xl font-black">{Number(m6Avg || 0).toFixed(3)}</p>
          <p className="text-xs text-slate-500">Ring-risk claims: {m6High}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">M7 Social Severity</p>
          <p className="text-xs mt-2">HIGH: {m7Dist.HIGH}</p>
          <p className="text-xs">MEDIUM: {m7Dist.MEDIUM}</p>
          <p className="text-xs">LOW: {m7Dist.LOW}</p>
          <p className="text-xs">NONE: {m7Dist.NONE}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">M8 Trust Score</p>
          <p className="text-3xl font-black">{Number(m8Avg || 0).toFixed(1)}</p>
          <p className="text-xs text-slate-500">Based on processed claims</p>
        </div>
      </div>
      <div className="card overflow-auto">
        <p className="font-semibold mb-3">Latest claim pipeline outputs (M4-M8)</p>
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2">Claim</th>
              <th>M4 Deviation</th>
              <th>M5 Anomaly</th>
              <th>M6 Ring Prob.</th>
              <th>M7 Severity</th>
              <th>M8 Trust</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {withPipeline.map((claim) => (
              <tr key={claim.id} className="border-t">
                <td className="py-2">{claim.id.slice(0, 8)}</td>
                <td>{claim.pipeline?.m4BehaviorDeviation ?? "—"}</td>
                <td>{claim.pipeline?.m5AnomalyScore ?? "—"}</td>
                <td>{claim.pipeline?.m6FraudRingProbability ?? "—"}</td>
                <td>{claim.pipeline?.m7SocialSeverity?.severityClass ?? "NONE"}</td>
                <td>{claim.trustScore ?? claim.pipeline?.m8TrustScore ?? "—"}</td>
                <td>{claim.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!withPipeline.length && <p className="text-sm text-slate-500 mt-3">No processed pipeline rows yet.</p>}
      </div>
    </div>
  );
}

function ProfilePage({ profile, policy, baseline }) {
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="card p-0 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-brand-500 to-brand-300" />
        <div className="p-5 -mt-10 text-center">
          <div className="h-20 w-20 rounded-full bg-brand-500 border-4 border-white text-white grid place-items-center mx-auto text-3xl font-bold">
            {profile?.name?.[0] || "R"}
          </div>
          <p className="text-3xl font-black mt-2">{profile?.name}</p>
          <p className="text-slate-500">{policy?.planName || "Basic"} Partner</p>
        </div>
      </div>
      <div className="lg:col-span-2 space-y-4">
        <div className="card">
          <div className="grid md:grid-cols-2 gap-3">
            <input className="input" value={profile?.name || ""} readOnly />
            <input className="input" value={profile?.email || ""} readOnly />
            <input className="input" value={profile?.zone || ""} readOnly />
            <input className="input" value={profile?.pincode || ""} readOnly />
            <input className="input" value={`Rs.${profile?.dailyIncome || 0}`} readOnly />
            <input className="input" value={`${profile?.workingHours || 0} hrs`} readOnly />
          </div>
        </div>
        <div className="card">
          <p className="font-semibold">Security</p>
          <button className="mt-3 px-4 py-2 rounded-lg border text-sm">Change Password</button>
        </div>
        <div className="card">
          <p className="font-semibold">Behavioral baseline (M4)</p>
          <p className="text-sm text-slate-500 mt-1">
            Avg hours: <span className="text-slate-800 font-medium">{baseline?.avgHours ?? "—"}</span>
            {" · "}Avg income: <span className="text-slate-800 font-medium">Rs.{baseline?.avgIncome ?? "—"}</span>
            {" · "}Typical zone: <span className="text-slate-800 font-medium">{baseline?.typicalZone ?? "—"}</span>
            {" · "}Deviation:{" "}
            <span className="text-slate-800 font-medium">{baseline?.deviationScore ?? "—"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function NotificationsPage() {
  const items = [
    { title: "Heavy Rain Alert", body: "Heavy rain detected in your zone. Parametric triggers are active.", when: "10 mins ago" },
    { title: "Insurance claim approved", body: "Your claim has been approved. Rs.448 is processing.", when: "2 hours ago" },
    { title: "Subscription renewal reminder", body: "Your premium plan will auto-renew in 2 days.", when: "1 day ago" }
  ];
  return (
    <div className="space-y-4">
      <p className="text-slate-500 -mt-2">Stay updated on alerts and claims.</p>
      <div className="card divide-y">
        {items.map((item) => (
          <div key={item.title} className="py-3 flex justify-between gap-4">
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-slate-500">{item.body}</p>
            </div>
            <p className="text-xs text-slate-400 whitespace-nowrap">{item.when}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-4">
      <p className="text-slate-500 -mt-2">Manage your app preferences.</p>
      <div className="card space-y-3">
        <p className="font-semibold">Notifications</p>
        <label className="flex justify-between"><span>Push notifications</span><input type="checkbox" checked readOnly /></label>
        <label className="flex justify-between"><span>SMS alerts</span><input type="checkbox" checked readOnly /></label>
        <label className="flex justify-between"><span>Email updates</span><input type="checkbox" readOnly /></label>
      </div>
      <div className="card space-y-3">
        <p className="font-semibold">Auto-triggers</p>
        <label className="flex justify-between"><span>Auto-claim on heavy rain</span><input type="checkbox" checked readOnly /></label>
        <label className="flex justify-between"><span>Auto-renew subscription</span><input type="checkbox" checked readOnly /></label>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary">Save Preferences</button>
      </div>
    </div>
  );
}

function tierCoveragePercent(planId) {
  if (planId === "standard") return 0.7;
  if (planId === "pro") return 0.9;
  return 0.5;
}

function PayoutPage({ profile, policy, onToast }) {
  const hourly = Math.round((profile?.dailyIncome || 0) / Math.max(1, profile?.workingHours || 1));
  const shiftH = profile?.workingHours || 8;
  const disruptedHours = useGigStore((s) => s.disruptedHours);
  const severity = useGigStore((s) => s.severity);
  const tierFromStore = useGigStore((s) => s.tier);
  const rainfall = useGigStore((s) => s.rainfall);
  const triggerManualClaim = useGigStore((s) => s.triggerManualClaim);

  const hours =
    disruptedHours > 0 ? Math.min(disruptedHours, shiftH) : rainfall > 35 ? Math.min(2, shiftH) : 0;
  const tierPct = tierFromStore || tierCoveragePercent(policy?.planId);
  const total = Math.round(hourly * hours * severity * tierPct);

  function handleClaim() {
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
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card space-y-3">
        <p className="font-semibold">Parameters (global store)</p>
        <input className="input" value={hourly} readOnly />
        <input className="input" value={hours} readOnly title="Disrupted hours from store" />
        <input className="input" value={`Rainfall ${rainfall.toFixed(1)} mm/hr`} readOnly />
        <input className="input" value={`${Number(severity).toFixed(2)}× severity`} readOnly />
        <input className="input" value={`Tier ${Math.round(tierPct * 100)}%`} readOnly />
      </div>
      <div className="card bg-gradient-to-br from-slate-900 to-brand-900 text-white">
        <p className="text-slate-300">Estimated Compensation</p>
        <h3 className="text-6xl font-black mt-2">Rs {total}</h3>
        <div className="bg-white/10 rounded-xl p-3 mt-4 text-sm space-y-1">
          <p>
            Payout = Hourly ({hourly}) × Hours ({hours}) × Severity ({Number(severity).toFixed(2)}) × Tier (
            {Math.round(tierPct * 100)}%)
          </p>
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl py-3 bg-brand-500 hover:bg-brand-700"
          onClick={handleClaim}
        >
          Trigger Claim
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage({ session, onLogout, preferredDashboard = "/worker-dashboard" }) {
  const token = session?.token;
  const role = session?.selectedRole || session?.user?.role || "worker";
  const isAdmin = role === "admin";
  const claims = useGigStore((s) => s.claims);
  const [profile, setProfile] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [plans, setPlans] = useState([]);
  const [disruption, setDisruption] = useState(null);
  const [apiSignals, setApiSignals] = useState(null);
  const [activeScenarios, setActiveScenarios] = useState([]);
  const [risk, setRisk] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [ml, setMl] = useState(null);
  const [payout, setPayout] = useState(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [hourlyOverride, setHourlyOverride] = useState(null);
  const [shiftOverride, setShiftOverride] = useState(null);
  const [workerStats, setWorkerStats] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [adminMlStats, setAdminMlStats] = useState(null);
  const [processingClaimIds, setProcessingClaimIds] = useState(() => new Set());
  const location = useLocation();

  const profileRef = useRef(profile);
  const triggerSigRef = useRef("");
  const lastClaimIdRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const pushToast = useCallback((msg) => {
    if (!msg) return;
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const applyLiveSnapshot = useCallback((data, { announceTriggers = false } = {}) => {
    setDisruption(data.disruption);
    setApiSignals(data.apiSignals);
    setActiveScenarios(data.activeScenarios || []);
    setRisk(data.risk);
    if (data.forecast) setForecast(data.forecast);
    if (data.baseline) setBaseline(data.baseline);
    if (data.ml) setMl(data.ml);
    if (data.payout) setPayout(data.payout);

    const scenarios = data.activeScenarios || [];
    const sig = scenarios
      .map((s) => s.type)
      .sort()
      .join("|");
    if (announceTriggers && sig && sig !== triggerSigRef.current) {
      setToast(`Trigger active: ${scenarios.map((s) => s.type).join(", ")}`);
      setTimeout(() => setToast(""), 5200);
    }
    triggerSigRef.current = sig;

    const user = profileRef.current;
    if (user?.id && data.risk?.riskScore != null) {
      syncRiskScore(user.id, data.risk.riskScore);
    }
  }, []);

  const refreshCoreData = useCallback(async () => {
    if (!token) return;
    try {
      const [profileData, planData, claimsData] = await Promise.all([
        request("/profile", {}, token),
        request("/plans", {}, token),
        request("/claims", {}, token)
      ]);
      setProfile(profileData.user);
      setPolicy(profileData.policy);
      if (profileData.baseline) {
        setBaseline(profileData.baseline);
      }
      setPlans(planData);
      useGigStore.getState().hydrateClaimsFromServer(claimsData);
      if (isAdmin) {
        setAdminStats(await getAdminDashboard(token));
        setAdminMlStats(await getAdminMlDashboard(token));
      } else {
        setWorkerStats(await getWorkerDashboard(token));
      }
      useGigStore.getState().setTierFromPlanId(profileData.policy?.planId);
      await syncWorkerRow(profileData.user, profileData.policy);
    } catch (e) {
      if (import.meta.env.DEV) console.warn("refreshCoreData", e);
    }
  }, [isAdmin, token]);

  const submitClaimFlow = useCallback(
    async (payload) => {
      try {
        const response = await submitClaim(payload, token);
        pushToast(`Claim submitted: ${response.claim?.id?.slice(0, 8) || ""}`);
        const claimList = await request("/claims", {}, token);
        useGigStore.getState().hydrateClaimsFromServer(claimList);
        await refreshCoreData();
      } catch (error) {
        pushToast(error.message);
      }
    },
    [pushToast, refreshCoreData, token]
  );

  const processClaimFlow = useCallback(
    async (claimId) => {
      try {
        setProcessingClaimIds((prev) => new Set(prev).add(claimId));
        useGigStore.setState((state) => ({
          claims: state.claims.map((claim) =>
            claim.id === claimId ? { ...claim, status: "PROCESSING" } : claim
          )
        }));
        const response = await processClaim({ claimId }, token);
        const status = response?.claim?.status || "UPDATED";
        pushToast(`Claim ${status} · trust ${response?.claim?.trustScore ?? "-"}`);
        const claimList = await request("/claims", {}, token);
        useGigStore.getState().hydrateClaimsFromServer(claimList);
        await refreshCoreData();
      } catch (error) {
        pushToast(error.message);
        const claimList = await request("/claims", {}, token).catch(() => []);
        if (claimList?.length) useGigStore.getState().hydrateClaimsFromServer(claimList);
      } finally {
        setProcessingClaimIds((prev) => {
          const next = new Set(prev);
          next.delete(claimId);
          return next;
        });
      }
    },
    [pushToast, refreshCoreData, token]
  );

  const manualDecisionFlow = useCallback(
    async (claimId, decision) => {
      try {
        await adminClaimDecision({ claimId, decision }, token);
        pushToast(`Claim ${decision}`);
        const claimList = await request("/claims", {}, token);
        useGigStore.getState().hydrateClaimsFromServer(claimList);
        await refreshCoreData();
      } catch (error) {
        pushToast(error.message);
      }
    },
    [pushToast, refreshCoreData, token]
  );

  const simulatePayoutFlow = useCallback(
    async (claimId, amount) => {
      try {
        const response = await simulatePayout({ claimId, amount }, token);
        pushToast(`Payout ${response?.payout?.status}: ${response?.payout?.transaction_id || ""}`);
        await refreshCoreData();
      } catch (error) {
        pushToast(error.message);
      }
    },
    [pushToast, refreshCoreData, token]
  );

  const pollDisruption = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await request("/disruption", {}, token);
      applyLiveSnapshot(data, { announceTriggers: true });

      if (data.autoClaims?.length) {
        setToast(data.message);
        const claimList = await request("/claims", {}, token);
        useGigStore.getState().hydrateClaimsFromServer(claimList);
        setTimeout(() => setToast(""), 4500);

        const c = data.autoClaims[0];
        const user = profileRef.current;
        if (user?.id && c?.id && c.id !== lastClaimIdRef.current) {
          lastClaimIdRef.current = c.id;
          insertPayoutRow({
            workerId: user.id,
            amount: c.payout,
            disruptedHours: c.lostHours,
            severityMultiplier: c.severityFactor
          });
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn("pollDisruption", e);
    } finally {
      setLoading(false);
    }
  }, [token, applyLiveSnapshot]);

  useEffect(() => {
    refreshCoreData();
  }, [refreshCoreData]);

  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => {
      refreshCoreData();
    }, 5000);
    return () => clearInterval(id);
  }, [refreshCoreData, token]);

  useEffect(() => {
    if (!token) return undefined;
    pollDisruption();
    const id = setInterval(pollDisruption, 10000);
    return () => clearInterval(id);
  }, [token, pollDisruption]);

  useEffect(() => {
    if (!token) return undefined;

    let stopped = false;
    let reconnectTimer;

    function connect() {
      if (stopped) return;
      try {
        const url = getWsLiveUrl(token);
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 2200);
        };
        ws.onerror = () => setWsConnected(false);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (import.meta.env.DEV && msg.type === "live") {
              console.log(
                "WS live rain:",
                msg.payload?.disruption?.rainfallMmPerHr ?? msg.payload?.disruption?.rainfall
              );
            }
            if (msg.type === "live" && msg.payload) {
              applyLiveSnapshot(msg.payload, { announceTriggers: false });
            }
          } catch {
            /* ignore */
          }
        };
      } catch {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 3200);
      }
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token, applyLiveSnapshot]);

  useEffect(() => {
    const userId = profile?.id;
    if (!userId) return undefined;
    return subscribeRiskScores(userId, () => {
      /* Realtime hook: could refetch profile; live WS already pushes risk */
    });
  }, [profile?.id]);

  async function subscribe(planId) {
    await request("/policy/subscribe", { method: "POST", body: JSON.stringify({ planId }) }, token);
    useGigStore.getState().setTierFromPlanId(planId);
    await refreshCoreData();
    setToast("Policy subscribed successfully.");
    setTimeout(() => setToast(""), 3000);
  }

  const titleMap = {
    "/": "Dashboard",
    "/ml-pipeline": "ML Pipeline (M4-M8)",
    "/worker-dashboard": "Worker Dashboard",
    "/admin-dashboard": "Admin Dashboard",
    "/plans": "Insurance Plans",
    "/disruption": "Disruption Monitor",
    "/payout": "Dynamic Payout Calculator",
    "/claims": "Claim History",
    "/notifications": "Notifications",
    "/profile": "Profile Settings",
    "/settings": "Settings"
  };

  return (
    <Layout title={titleMap[location.pathname] || "GigShield"} onLogout={onLogout} toast={toast} role={role}>
      <GigLiveDriver intervalMs={3000} />
      <Routes>
        <Route
          path="/"
          element={<Navigate to={preferredDashboard} replace />}
        />
        <Route
          path="/overview"
          element={!isAdmin ? (
            <DashboardHome
              profile={profile}
              policy={policy}
              risk={risk}
              disruption={disruption}
              activeScenarios={activeScenarios}
              loading={loading}
              forecast={forecast}
              baseline={baseline}
              ml={ml}
              payout={payout}
              hourlyOverride={hourlyOverride}
              onHourlyChange={setHourlyOverride}
              shiftOverride={shiftOverride}
              onShiftChange={setShiftOverride}
              wsConnected={wsConnected}
              onToast={pushToast}
            />
          ) : <Navigate to="/admin-dashboard" replace />}
        />
        <Route
          path="/ml-pipeline"
          element={isAdmin ? <MlPipelinePage baseline={baseline} claims={claims} role={role} /> : <Navigate to="/claims" replace />}
        />
        <Route
          path="/plans"
          element={!isAdmin ? <PlansPage plans={plans} selectedPlan={policy?.planId} subscribe={subscribe} /> : <Navigate to="/admin-dashboard" replace />}
        />
        <Route
          path="/worker-dashboard"
          element={!isAdmin ? <WorkerDashboardPage workerStats={workerStats} /> : <Navigate to="/admin-dashboard" replace />}
        />
        <Route
          path="/admin-dashboard"
          element={
            isAdmin ? (
              <AdminDashboardPage
                adminStats={adminStats}
                adminMlStats={adminMlStats}
                claims={claims}
                onProcessClaim={processClaimFlow}
                onManualDecision={manualDecisionFlow}
                processingClaimIds={processingClaimIds}
              />
            ) : (
              <Navigate to="/claims" replace />
            )
          }
        />
        <Route
          path="/disruption"
          element={!isAdmin ? (
            <DisruptionPage
              disruption={disruption}
              apiSignals={apiSignals}
              activeScenarios={activeScenarios}
              forecast={forecast}
            />
          ) : <Navigate to="/admin-dashboard" replace />}
        />
        <Route
          path="/payout"
          element={!isAdmin ? <PayoutPage profile={profile} policy={policy} onToast={pushToast} /> : <Navigate to="/admin-dashboard" replace />}
        />
        <Route
          path="/claims"
          element={
            !isAdmin ? (
              <ClaimsPage
                role={role}
                claims={claims}
                onSubmitClaim={submitClaimFlow}
                onProcessClaim={processClaimFlow}
                onSimulatePayout={simulatePayoutFlow}
              />
            ) : (
              <Navigate to="/admin-dashboard" replace />
            )
          }
        />
        <Route path="/notifications" element={!isAdmin ? <NotificationsPage /> : <Navigate to="/admin-dashboard" replace />} />
        <Route path="/profile" element={!isAdmin ? <ProfilePage profile={profile} policy={policy} baseline={baseline} /> : <Navigate to="/admin-dashboard" replace />} />
        <Route path="/settings" element={!isAdmin ? <SettingsPage /> : <Navigate to="/admin-dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
