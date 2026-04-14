import crypto from "node:crypto";

const PROVIDERS = ["razorpay_sandbox", "stripe_sandbox", "mock_gateway"];

export function simulateInstantPayout({
  claimId,
  userId,
  amount,
  provider = "razorpay_sandbox"
}) {
  const normalizedProvider = PROVIDERS.includes(provider) ? provider : "mock_gateway";
  const transactionId = `${normalizedProvider}_${crypto.randomUUID().slice(0, 18)}`;
  const timestamp = new Date().toISOString();

  return {
    transaction_id: transactionId,
    claim_id: claimId,
    user_id: userId,
    provider: normalizedProvider,
    amount: Number(amount || 0),
    status: "SUCCESS",
    timestamp
  };
}
