/**
 * How long a pre-ordered piece takes to ship, in weeks.
 *
 * The single source for this promise. It appears on the product page, in the
 * bag, in the receipt email, in the customer's order history and — as a real
 * date — in the Google/Meta product feed, and those had drifted apart (three
 * weeks in some places, four to six in others). Change it here and every
 * surface moves together.
 *
 * Three weeks per Жансая, confirmed 2026-09-17.
 */
export const PREORDER_LEAD_WEEKS = 3;

/** e.g. "Pre-order — ships in 3 weeks" */
export const PREORDER_SHIPS_IN = `ships in ${PREORDER_LEAD_WEEKS} weeks`;

/**
 * The `availability_date` a pre-order item carries in the product feed.
 *
 * Google requires this attribute on every item whose availability is
 * `preorder` and rejects the item without it — ISO 8601 with an explicit
 * time and timezone, no more than a year ahead. The feed is regenerated on
 * every fetch, so the date always sits {@link PREORDER_LEAD_WEEKS} weeks
 * from the moment a shopper sees it, matching the product page.
 *
 * Per-product batch dates live on `PreorderBatch.estimatedShipTo`; they are
 * deliberately not used here, because the storefront quotes one flat lead
 * time and a feed date that contradicted the landing page would fail
 * Google's own consistency check.
 *
 * @see https://support.google.com/merchants/answer/6324470
 */
export function preorderAvailabilityDate(now: Date): string {
  const date = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + PREORDER_LEAD_WEEKS * 7,
    ),
  );
  return `${date.toISOString().slice(0, 10)}T00:00Z`;
}
