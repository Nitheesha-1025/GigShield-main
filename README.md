# GigShield (Hackathon MVP)

GigShield is an AI-inspired parametric insurance web app for Zepto/Blinkit delivery partners.  
It auto-detects disruptions (rain, traffic, curfew), auto-creates claims, and computes dynamic payouts without manual claim filing.

## 1) Project Folder Structure

```text
gigshield/
  backend/
    package.json
    src/
      auth.js
      server.js
      store.js
      services/
        riskEngine.js
        claimEngine.js
        externalApis.js
  frontend/
    package.json
    index.html
    postcss.config.js
    tailwind.config.js
    vite.config.js
    src/
      api.js
      App.jsx
      main.jsx
      index.css
      components/
        Layout.jsx
      pages/
        AuthPage.jsx
        DashboardPage.jsx
  mock-api-sample.json
  .gitignore
```

## 2) Backend (Express) Features

- Auth: signup/login using email + password
- User profile stores name, zone, pincode, location (lat/lng), daily income, working hours
- Policy subscriptions: Basic, Standard, Pro
- Scenario trigger engine aligned to disruption table:
  - Heavy Rain: rainfall > 35mm/hr for 2+ hours during shift
  - Waterlogging: flooded zone + delivery drop > 70%
  - Local Strike/Bandh: verified social alert in pincode cluster
  - Curfew/Section 144: govt movement restriction in zone
- Location-aware mock API adapters:
  - weather API
  - traffic API
  - social event API
  - govt alert API
- Zero-touch claims:
  - Auto-creates claim when trigger conditions are met
- Dynamic payout:
  - `payout = hourlyIncome * lostHours * severityFactor`

### Main Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/profile`
- `GET /api/plans`
- `POST /api/policy/subscribe`
- `GET /api/disruption`
- `GET /api/claims`
- `GET /api/mock-data` (fixed sample)

## 3) Frontend (React + Tailwind) Features

- Mobile-first fintech UI (purple + white)
- Pages:
  - Login / Signup
  - Dashboard
  - Insurance Plans
  - Disruption Monitor
  - Claims History
  - Profile
- Sidebar navigation (mobile-friendly)
- Polling every 8 seconds for disruption simulation
- Toast-style notifications when auto-claim is triggered
- Loading states in monitor widgets

## 4) Sample Mock API Data

Static sample is available in `mock-api-sample.json`.

You can also fetch backend sample endpoint:

```bash
GET http://localhost:4000/api/mock-data
```

Example:

See `mock-api-sample.json` for full payload including:
- `apiSignals.weather`
- `apiSignals.traffic`
- `apiSignals.social`
- `apiSignals.government`
- `activeScenarios`

## 5) Step-by-Step Setup Instructions

### Prerequisites

- Node.js 18+

### Start Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:4000`.

### Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` (default Vite port).

## Demo Flow (Suggested)

1. Sign up with zone, pincode, location coordinates, income and hours.
2. Subscribe to a plan in Insurance Plans.
3. Open Dashboard/Disruption Monitor and wait for polling updates.
4. When trigger appears, claim is auto-created with scenario-specific severity multiplier.
5. Check Claims History for payout + status.
