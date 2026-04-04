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
