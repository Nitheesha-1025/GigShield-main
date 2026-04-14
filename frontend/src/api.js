const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:4000/api";

function defaultWsLiveUrl() {
  const origin = API_BASE.replace(/\/api\/?$/i, "").replace(/\/$/, "");
  if (origin.startsWith("https")) {
    return `${origin.replace(/^https/i, "wss")}/live-ws`;
  }
  return `${origin.replace(/^http/i, "ws")}/live-ws`;
}

export function getWsLiveUrl(token) {
  const raw = import.meta.env.VITE_WS_URL || defaultWsLiveUrl();
  const url = new URL(raw);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export async function request(path, options = {}, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

export function submitClaim(payload, token) {
  return request("/submit-claim", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function processClaim(payload, token) {
  return request("/process-claim", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function getClaimStatus(claimId, token) {
  return request(`/claim-status/${claimId}`, {}, token);
}

export function simulatePayout(payload, token) {
  return request("/simulate-payout", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function getWorkerDashboard(token) {
  return request("/dashboard/worker", {}, token);
}

export function getAdminDashboard(token) {
  return request("/dashboard/admin", {}, token);
}

export function getAdminMlDashboard(token) {
  return request("/dashboard/admin-ml", {}, token);
}

export function adminClaimDecision(payload, token) {
  return request("/admin/claim-decision", { method: "POST", body: JSON.stringify(payload) }, token);
}
