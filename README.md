# 🛡️ GigShield — AI-Powered Parametric Income Protection for Gig Workers

> Instant, automatic income protection for Zepto delivery partners — no claim forms, no delays, zero friction.

---

## Table of Contents

- [Overview](#overview)
- [Persona & Problem Definition](#persona--problem-definition)
- [Persona-Based Scenarios & Workflow](#persona-based-scenarios--workflow)
- [Weekly Premium Model](#weekly-premium-model)
- [AI/ML Integration Plan](#aiml-integration-plan)
- [Tech Stack & Development Plan](#tech-stack--development-plan)
- [Adversarial Defense & Anti-Spoofing Strategy](#adversarial-defense--anti-spoofing-strategy)

---

## Overview

GigShield is an AI-powered parametric income protection platform built for Q-Commerce delivery partners — specifically Zepto riders in Tier-1 Indian cities. When a qualifying disruption (heavy rain, waterlogging, bandh, or curfew) is detected, GigShield automatically triggers a payout to the worker's UPI account **within 30 minutes** — no paperwork, no waiting, no friction.

---

## Persona & Problem Definition

### Chosen Persona

**Platform:** Zepto / Blinkit (Q-Commerce — 10-Minute Grocery Delivery)

**Target Users:** Zepto delivery partners operating in Tier-1 Indian cities — Chennai, Bengaluru, Mumbai, Delhi, Hyderabad, and Pune.

These riders operate on hyper-local dark-store routes, completing **15–30 deliveries per day** on two-wheelers. Their earnings are entirely shift-based and directly tied to the number of hours they can work outdoors.

### Why Zepto?

| Factor | Impact |
|---|---|
| Hyper time pressure | 10-minute delivery windows mean even a 2-hour disruption causes major order cancellations and income loss |
| High frequency | Multiple short trips per hour amplify the financial impact of any disruption |
| Weather sensitivity | Dark stores are distributed across low-lying micro-zones, making riders vulnerable to sudden rain and waterlogging |
| No safety net | Zepto partners are gig-classified workers — they receive no employer-provided income protection |

### Core Problem Statement

A Zepto delivery partner in Chennai typically earns **₹600–₹900 per 8-hour shift**.

During heavy rain, curfews, or strikes, the worker may be unable to complete deliveries — resulting in a full day's lost income. Over a month, disruption-related income loss can reach:

> **₹2,400 – ₹3,600** — roughly 20–30% of monthly earnings.

GigShield addresses this by offering AI-powered parametric income protection that automatically triggers payouts when qualifying disruptions occur.

---

## Persona-Based Scenarios & Workflow

### Key User Scenarios

| Scenario | Disruption | Trigger Condition | Payout |
|---|---|---|---|
| Heavy Rain | Rainfall exceeds threshold | Weather API detects >35mm/hr for 2+ hours | Hourly rate × disrupted hours × rain severity multiplier |
| Waterlogging | Severe urban flooding | Traffic API shows >70% drop and rainfall >20mm | Hourly rate × disrupted hours × zone impact score |
| Local Strike / Bandh | City shutdown | Verified social alert in pincode cluster | Hourly rate × lockdown hours × social severity index |
| Curfew / Section 144 | Government movement restriction | Official government alert active in zone | Hourly rate × curfew hours × 1.3× multiplier |

### Platform Workflow

#### 1. Onboarding Flow

A worker registers through the GigShield web platform (mobile-first Progressive Web App) using their **Zepto Partner ID** and **mobile number**.

The AI Risk Engine collects:
- Historical delivery activity
- Location zone
- Shift patterns
- Disruption history

A **personalized risk profile** is generated and the worker selects a weekly protection plan. Coverage activates instantly — no paperwork, no waiting periods.

#### 2. Active Coverage Flow

The platform continuously monitors:
- Weather APIs (Open-Meteo / IMD)
- Traffic signals
- Social disruption signals
- Government alerts

When a qualifying threshold is crossed:

```
Disruption Detected → Automated Claim Generated → Fraud Detection → UPI Payout (≤30 min)
```

The worker receives a push notification:

> *"Heavy rain detected in your zone. ₹294 credited to your UPI. Stay safe."*

---

## Weekly Premium Model

### Why Weekly?

Zepto delivery partners receive **weekly settlements**. GigShield mirrors this cash-flow cycle with weekly premium payments — removing the burden of long-term commitments.

### Premium Tiers

| Tier | Weekly Premium | Payout Cap | Coverage Events | Target Worker |
|---|---|---|---|---|
| Basic | ₹29 | Up to 50% weekly income | Rain | New or part-time rider |
| Standard | ₹49 | Up to 70% weekly income | Rain + Social disruptions | Full-time rider |
| Pro | ₹79 | Up to 90% weekly income | Rain + Social + Extended hours | High-earning riders |

### Payout Formula

```
Payout = Avg Hourly Earnings × Disrupted Hours × Severity Multiplier × Tier Coverage %
```

**Example:**
- Worker earning ₹100/hour
- Disruption duration: 3 hours
- Severity multiplier: 1.4
- Tier: Standard (70%)

```
₹100 × 3 × 1.4 × 70% = ₹294
```

Payout is automatically credited to the worker's UPI account.

### Dynamic Premium Adjustment (AI)

The AI Risk Engine dynamically adjusts premiums based on:

- **Zone Risk Score** — historical flood frequency
- **Worker Tenure Discount** — longer platform history lowers premium
- **Predictive Weather Signals** — upcoming low-risk weeks reduce premiums
- **City Social Risk Index** — elections or bandh seasons increase risk score

### Parametric Triggers

| Trigger | Data Source | Threshold | Payout Logic |
|---|---|---|---|
| Heavy Rain | Open-Meteo / IMD | >35mm/hr for 2 hrs | Hourly × disrupted hrs × severity |
| Waterlogging | Traffic + weather APIs | Traffic drop >70% | Hourly × disrupted hrs × zone impact |
| Strike / Bandh | News API | Verified alert | Hourly × lockdown hrs |
| Curfew | Government alerts | Section 144 active | Hourly × duration × 1.3× |

### Platform Choice: Mobile-First Progressive Web App (PWA)

GigShield is implemented as a **mobile-first PWA** for the following reasons:

- Delivery partners primarily use smartphones during shifts
- Eliminates App Store installation barriers
- Works efficiently on low-bandwidth networks
- Supports UPI deep-link payouts
- Enables push notifications for disruption alerts

---

## AI/ML Integration Plan

GigShield uses a **multi-model machine learning architecture**:

| Model | Algorithm | Purpose |
|---|---|---|
| M1 | XGBoost Regressor | Risk scoring and premium calculation |
| M2 | LSTM | Weather disruption forecasting |
| M3 | Random Forest | Severity multiplier calculation |
| M4 | Gaussian Mixture Model | Worker behavioral baseline |
| M5 | Isolation Forest | Claim anomaly detection |
| M6 | Graph Neural Network | Fraud ring detection |
| M7 | Naive Bayes + TF-IDF | Social disruption classification |
| M8 | Logistic Regression | Final claim trust score |

### Risk Scoring Engine (M1)

**Input features:**
- Pincode elevation
- Flood history
- Average weekly deliveries
- Shift patterns
- Worker tenure
- Past claim history

**Output:** Risk Score (0–100) — determines premium pricing adjustments.

### Weather Disruption Forecaster (M2)

The LSTM model analyzes sequential weather data — rainfall, humidity, temperature, and historical disruptions — to predict the **probability of disruptions for the next 7 days**.

---

## Tech Stack & Development Plan

| Layer | Technology |
|---|---|
| Frontend | React.js PWA (Vite) + Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL + Redis |
| AI/ML | Python + FastAPI |
| Weather API | Open-Meteo |
| Social API | NewsAPI |
| Payments | Razorpay Test Mode |
| Notifications | Firebase Cloud Messaging |
| DevOps | GitHub Actions + Docker + Render |

---

## Adversarial Defense & Anti-Spoofing Strategy

GigShield uses a **multi-layer fraud detection system** designed so that the cost of fraud always exceeds the payout — protecting both the platform and genuine workers.

### Layer 1 — Device Signal Integrity

Checks include:
- GPS vs. cell tower consistency
- Accelerometer movement
- Altitude variation
- Network signal verification
- Battery consumption patterns

> Spoofed GPS locations typically fail these combined signals.

### Layer 2 — Behavioral Baseline

Each worker has a **personal activity profile** built from historical data. Red flags include:
- Claims from unknown zones
- Unusual working hours
- Abnormal earnings spikes
- New accounts requesting high payouts

### Layer 3 — Network Graph Analysis

Graph-based models detect fraud rings through:
- Shared device fingerprints
- Shared UPI accounts
- Common registration IP addresses
- Synchronized claim activity

### Layer 4 — Cross-Platform Corroboration

Claims are validated against:
- Worker activity on Zepto platform
- Order cancellation spikes
- Multi-API disruption confirmation

### Layer 5 — Payout Monitoring

Additional monitoring checks:
- Shared payout destinations
- Abnormal transfer patterns
- Suspicious payout clusters

### Honest Worker Protection

GigShield prioritizes legitimate workers. A genuine stranded worker typically shows:
- Matching GPS and cell tower location
- Real device motion data
- Platform activity during disruption
- Consistent behavioral history

Fraudulent accounts fail multiple signals simultaneously.

### Fraud Response Timeline

| Time | Action |
|---|---|
| T+0 min | Zone population check |
| T+10 min | Fraud graph analysis |
| T+15 min | Legitimate payouts processed |
| T+20 min | Suspicious claims escalated |
| T+60 min | UPI monitoring |
| T+24 hrs | Fraud accounts blacklisted |

### Why GigShield Is Hard to Exploit

Fraudsters might spoof GPS, device signals, or account activity in isolation — but **no attack can bypass all detection layers simultaneously**. This architecture ensures the cost of fraud exceeds the payout, protecting both the platform and genuine workers.

---

<div align="center">

**GigShield** — Built for the workers who keep your groceries moving. ⚡

</div>
