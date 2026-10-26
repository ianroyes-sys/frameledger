/** Intentionally excludes amounts, names, emails, descriptions and external IDs. */
export const activationEvents = [
  "signup_started",
  "signup_completed",
  "kyc_started",
  "kyc_completed",
  "first_project_created",
  "first_invoice_created",
  "first_invoice_sent",
  "first_invoice_paid",
  "first_500_received",
  "allocation_rule_created",
  "first_expense_categorized",
  "first_project_closed",
  "card_activated",
  "collaborator_added",
  "collaborator_paid",
  "subscription_started",
  "safe_to_spend_viewed",
] as const;
export type ProductEvent = (typeof activationEvents)[number];
export type AnalyticsEvent = {
  event: ProductEvent;
  mode: "demo" | "live";
  occurredAt: string;
};
export interface AnalyticsSink {
  record(event: AnalyticsEvent): void | Promise<void>;
}
/** Consent is required before enabling any external sink. Default stays on device. */
export class PrivateAnalytics {
  constructor(
    private readonly sink: AnalyticsSink,
    private readonly consent = false,
  ) {}
  async track(event: ProductEvent, mode: "demo" | "live"): Promise<void> {
    if (!this.consent || !activationEvents.includes(event)) return;
    await this.sink.record({
      event,
      mode,
      occurredAt: new Date().toISOString(),
    });
  }
}
export class MemoryAnalyticsSink implements AnalyticsSink {
  readonly counts = new Map<string, number>();
  record({ event, mode }: AnalyticsEvent) {
    const key = `${mode}:${event}`;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }
}
