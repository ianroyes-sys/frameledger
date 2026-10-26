import { describe, expect, it } from "vitest";
import {
  MemoryAnalyticsSink,
  PrivateAnalytics,
  type AnalyticsEvent,
} from "../src/lib/analytics";
import { commercialPolicy } from "../src/lib/plans";
describe("Privacy and commercial defaults", () => {
  it("does not transmit events without consent", async () => {
    const sink = new MemoryAnalyticsSink();
    await new PrivateAnalytics(sink).track("first_invoice_paid", "live");
    expect(sink.counts.size).toBe(0);
  });
  it("allows only event identity, mode and timestamp; separates demo from activation", async () => {
    const captured: AnalyticsEvent[] = [];
    const analytics = new PrivateAnalytics(
      {
        record: (e) => {
          captured.push(e);
        },
      },
      true,
    );
    await analytics.track("first_invoice_paid", "demo");
    expect(Object.keys(captured[0]).sort()).toEqual([
      "event",
      "mode",
      "occurredAt",
    ]);
    expect(captured[0].mode).toBe("demo");
  });
  it("never bills or marks up payments by default", () => {
    expect(commercialPolicy.billingEnabled).toBe(false);
    expect(commercialPolicy.transactionMarkupEnabled).toBe(false);
    expect(commercialPolicy.transactionMarkupBasisPoints).toBe(0);
  });
});
