import { createServer } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import {
  predictWeatherDisruption,
  getBehavioralM4,
  detectClaimAnomaly
} from "./services/MLintegrate.js";
import cors from "cors";
import express from "express";
import crypto from "node:crypto";
import { authMiddleware, signToken, verifyToken } from "./auth.js";
import { db, plans, getTierCoveragePercent } from "./store.js";
import { calculatePayout } from "./services/claimEngine.js";
import {
  getGovernmentAlertSignal,
  getTrafficSignal,
  getWeatherSignal
} from "./services/externalApis.js";
import { calculateRiskAndPremium } from "./services/riskEngine.js";
import { buildLiveDashboardState } from "./services/liveState.js";
import { startWorldStream } from "./services/worldStream.js";
import {
  adminManualDecision,
  getAdminDashboard,
  getAdminMlPipelineMetrics,
  getClaimById,
  markClaimAsPaid,
  getWorkerDashboard,
  processClaimById,
  runMLPipeline,
  submitClaimRecord
} from "./services/claimPipelineService.js";
import { simulateInstantPayout } from "./services/paymentService.js";

const app = express();
app.use(cors());
app.use(express.json());
const claimCooldownMs = 60 * 60 * 1000;
const userScenarioCooldowns = new Map();

function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function getUserPolicy(userId) {
  return db.policies.find((policy) => policy.userId === userId) || null;
}

app.post("/api/auth/signup", (req, res) => {
  const { name, email, password, zone, pincode, location, dailyIncome, workingHours, role } = req.body;
  if (!name || !email || !password || !zone || !pincode || !dailyIncome || !workingHours) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const existing = db.users.find((user) => user.email === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: "Email already registered." });
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email: email.toLowerCase(),
    password,
    zone,
    pincode,
    location: {
      lat: Number(location?.lat || 0),
      lng: Number(location?.lng || 0)
    },
    dailyIncome: Number(dailyIncome),
    workingHours: Number(workingHours),
    role: role === "admin" ? "admin" : "worker",
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  return res.status(201).json({ token, user: sanitizeUser(user) });
});



app.post("/api/auth/login", (req, res) => {
  const { email, password, role } = req.body;
  const user = db.users.find(
    (entry) => entry.email === email?.toLowerCase() && entry.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }
  const effectiveRole = role === "admin" ? "admin" : "worker";

  const token = signToken({ userId: user.id, email: user.email, role: effectiveRole });
  return res.json({ token, user: { ...sanitizeUser(user), role: effectiveRole } });
});

app.get("/api/plans", (_req, res) => {
  return res.json(plans);
});

app.post("/api/policy/subscribe", authMiddleware, (req, res) => {
  const { planId } = req.body;
  const plan = plans.find((entry) => entry.id === planId);
  if (!plan) {
    return res.status(404).json({ message: "Plan not found." });
  }

  const existingIndex = db.policies.findIndex((policy) => policy.userId === req.user.userId);
  const policy = {
    userId: req.user.userId,
    planId: plan.id,
    planName: plan.name,
    basePremium: plan.basePremium,
    active: true,
    subscribedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    db.policies[existingIndex] = policy;
  } else {
    db.policies.push(policy);
  }

  return res.json(policy);
});

app.get("/api/profile", authMiddleware, (req, res) => {
  const user = db.users.find((entry) => entry.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  const baseline = getBehavioralM4(user);

  return res.json({
    user: sanitizeUser(user),
    policy: getUserPolicy(user.id),
    baseline
  });
});

function runAutoClaimsForUser(user, state) {
  const policy = getUserPolicy(user.id);
  const tierCoverage = getTierCoveragePercent(policy?.planId);
  const hourlyIncome = user.dailyIncome / Math.max(1, user.workingHours);
  const scenarios = state.activeScenarios || [];
  const cooldownState = userScenarioCooldowns.get(user.id) || {};
  const newClaims = [];

  for (const scenario of scenarios) {
    const lastTs = cooldownState[scenario.type] || 0;
    const isEligible = Date.now() - lastTs > claimCooldownMs;
    if (!isEligible) continue;

    const payout = calculatePayout(hourlyIncome, scenario.lostHours, scenario.severityFactor, tierCoverage);
    const autoClaim = {
      id: crypto.randomUUID(),
      userId: user.id,
      date: new Date().toISOString(),
      disruptionType: scenario.type,
      triggerCondition: scenario.triggerCondition,
      lostHours: scenario.lostHours,
      severityFactor: scenario.severityFactor,
      payout,
      tierCoverage,
      status: "SUBMITTED"
    };
    detectClaimAnomaly(autoClaim);
    db.claims.push(autoClaim);
    newClaims.push(autoClaim);
    cooldownState[scenario.type] = Date.now();
  }
  userScenarioCooldowns.set(user.id, cooldownState);
  return newClaims;
}

app.get("/api/disruption", authMiddleware, (req, res) => {
  const user = db.users.find((entry) => entry.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const state = buildLiveDashboardState(user);
  const newClaims = runAutoClaimsForUser(user, state);
  const autoClaim = newClaims[0] || null;

  return res.json({
    ...state,
    activeScenarios: state.activeScenarios,
    baseline: state.baseline,
    autoClaims: newClaims,
    autoClaim,
    message: autoClaim
      ? `${autoClaim.disruptionType} detected in ${user.zone}. Rs.${autoClaim.payout} credited.`
      : "No active disruption right now."
  });
});

app.get("/api/live-dashboard", authMiddleware, (req, res) => {
  const user = db.users.find((entry) => entry.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  return res.json(buildLiveDashboardState(user));
});

app.get("/api/ml/models", authMiddleware, (req, res) => {
  const user = db.users.find((entry) => entry.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  const state = buildLiveDashboardState(user);
  return res.json(state.ml);
});

app.get("/api/weather", authMiddleware, (req, res) => {
  const user = db.users.find((entry) => entry.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  const weather = getWeatherSignal(user.zone, user.location?.lat, user.location?.lng);
  const forecast = predictWeatherDisruption(weather);
  return res.json({ weather, forecast });
});

app.get("/api/risk", authMiddleware, (req, res) => {
  const user = db.users.find((entry) => entry.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  const policy = getUserPolicy(user.id);
  const weather = getWeatherSignal(user.zone, user.location?.lat, user.location?.lng);
  const traffic = getTrafficSignal(user.zone);
  const government = getGovernmentAlertSignal(user.zone);
  const risk = calculateRiskAndPremium({
    zone: user.zone,
    basePremium: policy?.basePremium || 29,
    weather,
    traffic,
    government,
    user
  });
  return res.json({
    risk,
    signals: { weather, traffic, government }
  });
});

app.get("/api/claims", authMiddleware, (req, res) => {
  if (req.user.role === "admin") {
    for (const claim of db.claims) {
      const needsPipeline =
        !claim.pipeline &&
        (claim.status === "SUBMITTED" ||
          claim.status === "PROCESSING" ||
          claim.status === "PENDING_REVIEW");
      if (needsPipeline) {
        const user = db.users.find((entry) => entry.id === claim.userId);
        if (!user) continue;
        const policy = getUserPolicy(user.id);
        const output = runMLPipeline(claim, user, policy);
        claim.pipeline = output.pipeline;
        claim.trustScore = output.trustScore;
        claim.recommendedDecision = output.decision;
        claim.payoutAmount = output.payoutAmount;
      }
    }
  }
  const claims = db.claims
    .filter((entry) => (req.user.role === "admin" ? true : entry.userId === req.user.userId))
    .sort(
      (a, b) =>
        new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime()
    );
  return res.json(claims);
});

function submitClaimHandler(req, res) {
  const { zone, claimedWeather, lostHours, gpsPoints, socialText, provider } = req.body;
  if (!zone || !lostHours) {
    return res.status(400).json({
      ok: false,
      message: "zone and lostHours are required"
    });
  }

  const claim = submitClaimRecord({
    userId: req.user.userId,
    zone,
    claimedWeather,
    lostHours: Number(lostHours),
    gpsPoints: Array.isArray(gpsPoints) ? gpsPoints : [],
    socialText: socialText || "",
    provider: provider || "razorpay_sandbox"
  });
  const user = db.users.find((entry) => entry.id === req.user.userId);
  if (user) {
    const policy = getUserPolicy(user.id);
    const output = runMLPipeline(claim, user, policy);
    claim.pipeline = output.pipeline;
    claim.trustScore = output.trustScore;
    claim.recommendedDecision = output.decision;
    claim.payoutAmount = output.payoutAmount;
  }

  return res.status(201).json({
    ok: true,
    message: "Claim submitted",
    claim
  });
}
app.post("/submit-claim", authMiddleware, submitClaimHandler);
app.post("/api/submit-claim", authMiddleware, submitClaimHandler);

function claimStatusHandler(req, res) {
  const claim = getClaimById(req.params.id);
  if (!claim || (req.user.role !== "admin" && claim.userId !== req.user.userId)) {
    return res.status(404).json({ ok: false, message: "Claim not found" });
  }
  return res.json({ ok: true, claim });
}
app.get("/claim-status/:id", authMiddleware, claimStatusHandler);
app.get("/api/claim-status/:id", authMiddleware, claimStatusHandler);

async function processClaimHandler(req, res) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, message: "Only admin can process claims" });
  }
  const claimId = req.body?.claimId;
  if (!claimId) {
    return res.status(400).json({ ok: false, message: "claimId is required" });
  }
  const claim = getClaimById(claimId);
  if (!claim) {
    return res.status(404).json({ ok: false, message: "Claim not found" });
  }

  const start = Date.now();
  const processed = await processClaimById(claimId);
  const elapsedMs = Date.now() - start;
  return res.json({
    ok: true,
    processing_ms: elapsedMs,
    claim: processed
  });
}
app.post("/process-claim", authMiddleware, processClaimHandler);
app.post("/api/process-claim", authMiddleware, processClaimHandler);

function simulatePayoutHandler(req, res) {
  const { claimId, amount, provider } = req.body || {};
  if (!claimId || !amount) {
    return res.status(400).json({ ok: false, message: "claimId and amount are required" });
  }
  const claim = getClaimById(claimId);
  if (!claim || (req.user.role !== "admin" && claim.userId !== req.user.userId)) {
    return res.status(404).json({ ok: false, message: "Claim not found" });
  }
  if (claim.status !== "APPROVED" && claim.status !== "PAID") {
    return res.status(400).json({ ok: false, message: "Claim is not eligible for payout" });
  }

  const payout = simulateInstantPayout({
    claimId,
    userId: claim.userId,
    amount: Number(amount),
    provider
  });
  const updatedClaim = markClaimAsPaid(claimId, payout);
  return res.json({ ok: true, payout, claim: updatedClaim });
}
app.post("/simulate-payout", authMiddleware, simulatePayoutHandler);
app.post("/api/simulate-payout", authMiddleware, simulatePayoutHandler);

function adminDecisionHandler(req, res) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, message: "Only admin can approve/reject claims" });
  }
  const { claimId, decision } = req.body || {};
  if (!claimId || !decision) {
    return res.status(400).json({ ok: false, message: "claimId and decision are required" });
  }
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return res.status(400).json({ ok: false, message: "decision must be APPROVED or REJECTED" });
  }
  const claim = adminManualDecision(claimId, decision);
  if (!claim) {
    return res.status(404).json({ ok: false, message: "Claim not found" });
  }
  return res.json({ ok: true, claim });
}
app.post("/admin/claim-decision", authMiddleware, adminDecisionHandler);
app.post("/api/admin/claim-decision", authMiddleware, adminDecisionHandler);

app.get("/api/dashboard/worker", authMiddleware, (req, res) => {
  return res.json(getWorkerDashboard(req.user.userId));
});

app.get("/api/dashboard/admin", authMiddleware, (_req, res) => {
  if (_req.user?.role && _req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  return res.json(getAdminDashboard());
});

app.get("/api/dashboard/admin-ml", authMiddleware, (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  return res.json(getAdminMlPipelineMetrics());
});

app.get("/api/mock-data", (_req, res) => {
  return res.json({
    weather: { rainfallMmPerHr: 65, consecutiveRainHours: 2 },
    traffic: { traffic: "high", deliveryDropPercent: 78, flooded: true },
    social: { bandhVerified: false, socialSeverityIndex: 1 },
    government: { section144Active: false, nightCurfewActive: false, curfewHours: 0 }
  });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT) || 4000;
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const wsClients = new Set();

server.on("upgrade", (request, socket, head) => {
  const host = request.headers.host || "localhost";
  const path = new URL(request.url || "/", `http://${host}`).pathname;
  if (path !== "/live-ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

function broadcastLiveSockets() {
  for (const ws of wsClients) {
    const userId = ws.userId;
    const user = db.users.find((u) => u.id === userId);
    if (!user || ws.readyState !== WebSocket.OPEN) continue;
    try {
      const live = buildLiveDashboardState(user);
      ws.send(JSON.stringify({ type: "live", payload: live }));
    } catch {
      /* ignore */
    }
  }
}

wss.on("connection", (ws, req) => {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);
  const token = url.searchParams.get("token");
  const payload = verifyToken(token);
  if (!payload?.userId) {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    ws.close();
    return;
  }
  ws.userId = payload.userId;
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));

  const user = db.users.find((u) => u.id === ws.userId);
  if (user && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({ type: "live", payload: buildLiveDashboardState(user) }));
    } catch {
      /* ignore */
    }
  }
});

app.get("/api", (req, res) => {
  res.send("API is working 🚀");
});
server.listen(PORT, () => {
  startWorldStream(4000, broadcastLiveSockets);
  console.log(`GigShield backend http://localhost:${PORT}`);
  console.log(`WebSocket live stream ws://localhost:${PORT}/live-ws?token=JWT`);
});
