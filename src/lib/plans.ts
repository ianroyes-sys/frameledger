/** Pricing hypotheses, not an active subscription contract. Minor USD units. */
export const plans = [
  {
    id: "free",
    name: "Free",
    monthlyPriceMinor: 0,
    features: [
      "Project wallets",
      "Invoices",
      "Expense organization",
      "Tax reserve tracking",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceMinor: 1200,
    features: [
      "Everything in Free",
      "Money Autopilot",
      "Profitability reports",
      "Cash-flow scenarios",
      "Intelligence tools",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    monthlyPriceMinor: 2900,
    features: [
      "Everything in Pro",
      "Team permissions (planned)",
      "Agency reporting (planned)",
      "Advanced project controls (planned)",
    ],
  },
] as const;
export const commercialPolicy = {
  currency: "USD",
  pricingStatus: "hypothesis",
  billingEnabled: false,
  transactionMarkupBasisPoints: 0,
  transactionMarkupEnabled: false,
} as const;
