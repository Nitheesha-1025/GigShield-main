# GigShield Fraud + Payout Architecture

## Request Flow

1. `POST /submit-claim`
2. `POST /process-claim`
3. ML + fraud pipeline execution
4. Decision (`APPROVED` / `HOLD` / `REJECTED`)
5. Approved claims trigger `simulateInstantPayout()`
6. Dashboard APIs read aggregated state

## Services

- `services/claimPipelineService.js`: claim orchestration and decisioning.
- `services/fraudService.js`: GPS spoof detection + fraud score rule engine.
- `services/trustScoreService.js`: M6, M7, M8 simulations and trust decision logic.
- `services/paymentService.js`: Razorpay/Stripe sandbox payout simulation.
- `services/MLintegrate.js`: M2, M3, M4, M5 simulation adapters.
- `services/riskEngine.js`: M1 risk score.

## Data Entities

- `users`
- `claims`
- `payouts` / `payout_logs`
- `fraud_logs`

In local runtime these are held in-memory via `store.js`. Supabase SQL schema includes durable table definitions.
