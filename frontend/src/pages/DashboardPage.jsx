import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getWsLiveUrl, request } from "../api";
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

function ClaimsPage() {
  const claims = useGigStore((s) => s.claims);
  return (
    <div className="space-y-4">
      <p className="text-slate-500 -mt-2">
        Track payouts (Zustand store + server history). Manual triggers appear instantly.
      </p>
      <div className="card overflow-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-2">Date</th>
            <th>Type</th>
            <th>Hours Lost</th>
            <th>Severity</th>
            <th>Compensation</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id} className="border-t">
              <td className="py-2">{new Date(claim.date).toLocaleString()}</td>
              <td>{claim.disruptionType}</td>
              <td>{claim.lostHours}</td>
              <td>{claim.severityFactor != null ? `${Number(claim.severityFactor).toFixed(2)}×` : "—"}</td>
              <td>Rs.{claim.payout ?? claim.amount ?? 0}</td>
              <td><span className={`text-xs px-2 py-1 rounded-full ${claim.status === "Approved" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>{claim.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!claims.length && <p className="text-sm text-slate-500 mt-2">No claims yet.</p>}
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

export default function DashboardPage({ session, onLogout }) {
  const token = session?.token;
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
  const location = useLocation();

  const profileRef = useRef(profile);
  const triggerSigRef = useRef("");
  const lastClaimIdRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

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
      useGigStore.getState().setTierFromPlanId(profileData.policy?.planId);
      await syncWorkerRow(profileData.user, profileData.policy);
    } catch (e) {
      if (import.meta.env.DEV) console.warn("refreshCoreData", e);
    }
  }, [token]);

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

  const pushToast = useCallback((msg) => {
    if (!msg) return;
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const titleMap = {
    "/": "Dashboard",
    "/plans": "Insurance Plans",
    "/disruption": "Disruption Monitor",
    "/payout": "Dynamic Payout Calculator",
    "/claims": "Claim History",
    "/notifications": "Notifications",
    "/profile": "Profile Settings",
    "/settings": "Settings"
  };

  return (
    <Layout title={titleMap[location.pathname] || "GigShield"} onLogout={onLogout} toast={toast}>
      <GigLiveDriver intervalMs={3000} />
      <Routes>
        <Route
          path="/"
          element={
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
          }
        />
        <Route
          path="/plans"
          element={<PlansPage plans={plans} selectedPlan={policy?.planId} subscribe={subscribe} />}
        />
        <Route
          path="/disruption"
          element={
            <DisruptionPage
              disruption={disruption}
              apiSignals={apiSignals}
              activeScenarios={activeScenarios}
              forecast={forecast}
            />
          }
        />
        <Route
          path="/payout"
          element={<PayoutPage profile={profile} policy={policy} onToast={pushToast} />}
        />
        <Route path="/claims" element={<ClaimsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage profile={profile} policy={policy} baseline={baseline} />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
