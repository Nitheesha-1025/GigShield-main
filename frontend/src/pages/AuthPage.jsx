import { useState } from "react";
import { request } from "../api";

const initialForm = {
  name: "",
  email: "",
  password: "",
  zone: "Adyar",
  pincode: "600020",
  lat: 13.0067,
  lng: 80.2206,
  dailyIncome: 1000,
  workingHours: 10
};

export default function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const path = isLogin ? "/auth/login" : "/auth/signup";
      const payload = isLogin
        ? { email: form.email, password: form.password }
        : {
            name: form.name,
            email: form.email,
            password: form.password,
            zone: form.zone,
            pincode: form.pincode,
            location: {
              lat: Number(form.lat),
              lng: Number(form.lng)
            },
            dailyIncome: Number(form.dailyIncome),
            workingHours: Number(form.workingHours)
          };
      const data = await request(path, { method: "POST", body: JSON.stringify(payload) });
      onAuth(data);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6">
        <section className="card p-6 md:p-8">
          <p className="text-brand-700 font-semibold mb-4">GigShield</p>
          <h1 className="text-3xl font-bold text-slate-900">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </h1>
          <p className="text-slate-500 mt-2 mb-6">
            AI-powered income protection for gig workers during rain and social disruptions.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <>
                <input
                  className="input"
                  placeholder="Name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input"
                    placeholder="Delivery Zone"
                    value={form.zone}
                    onChange={(event) => setForm({ ...form, zone: event.target.value })}
                    required
                  />
                  <input
                    className="input"
                    placeholder="Pincode"
                    value={form.pincode}
                    onChange={(event) => setForm({ ...form, pincode: event.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    placeholder="Latitude"
                    value={form.lat}
                    onChange={(event) => setForm({ ...form, lat: event.target.value })}
                    required
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    placeholder="Longitude"
                    value={form.lng}
                    onChange={(event) => setForm({ ...form, lng: event.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Daily Income"
                    value={form.dailyIncome}
                    onChange={(event) => setForm({ ...form, dailyIncome: event.target.value })}
                    required
                  />
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Working Hours"
                    value={form.workingHours}
                    onChange={(event) => setForm({ ...form, workingHours: event.target.value })}
                    required
                  />
                </div>
              </>
            )}

            <input
              className="input"
              placeholder="Email address"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
            {isLogin && <p className="text-right text-xs text-brand-700">Forgot password?</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <button
            type="button"
            className="text-sm text-slate-600 mt-4"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
          >
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span className="text-brand-700 font-medium">{isLogin ? "Sign up" : "Sign in"}</span>
          </button>
        </section>

        <section className="rounded-2xl p-8 text-white bg-gradient-to-br from-brand-700 to-brand-500 flex flex-col justify-between">
          <div>
            <p className="text-brand-100 text-sm">GigShield</p>
            <h2 className="text-3xl font-semibold mt-3">Protection that works as hard as you do.</h2>
          </div>
          <ul className="space-y-3 mt-8 text-brand-50">
            <li>- Instant payouts for heavy rain</li>
            <li>- Coverage for unexpected traffic blocks</li>
            <li>- AI-driven predictive analytics</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
