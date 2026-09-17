import { describe, expect, it } from "vitest";
import { PREORDER_LEAD_WEEKS, preorderAvailabilityDate } from "../preorder";

/**
 * Google requires `availability_date` on every item whose availability is
 * `preorder`, in ISO 8601 with an explicit time and timezone, no more than
 * a year out.
 * @see https://support.google.com/merchants/answer/6324470
 */

describe("preorderAvailabilityDate", () => {
  it("lands exactly one lead time past the given moment", () => {
    // 2026-09-17 + 3 weeks = 2026-10-08
    expect(preorderAvailabilityDate(new Date("2026-09-17T14:32:07Z"))).toBe(
      "2026-10-08T00:00Z",
    );
  });

  it("carries across a month and a year boundary", () => {
    expect(preorderAvailabilityDate(new Date("2026-12-24T09:00:00Z"))).toBe(
      "2027-01-14T00:00Z",
    );
  });

  it("emits the ISO 8601 shape Google accepts, within its 25-char limit", () => {
    const value = preorderAvailabilityDate(new Date("2026-09-17T00:00:00Z"));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
    expect(value.length).toBeLessThanOrEqual(25);
  });

  it("stays well inside Google's one-year ceiling", () => {
    const now = new Date("2026-09-17T00:00:00Z");
    const value = new Date(preorderAvailabilityDate(now));
    const daysOut = (value.getTime() - now.getTime()) / 86_400_000;
    expect(daysOut).toBeGreaterThan(0);
    expect(daysOut).toBeLessThan(365);
    expect(daysOut).toBe(PREORDER_LEAD_WEEKS * 7);
  });
});
