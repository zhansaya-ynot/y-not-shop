/**
 * Strip HTML tags and collapse whitespace — for contexts that need plain
 * text from rich-text fields (meta descriptions, JSON-LD, OG tags). Not a
 * sanitiser; purely cosmetic flattening of trusted admin-authored HTML.
 * Decodes the handful of entities the editor emits (&amp; &lt; &gt;
 * &nbsp; &rsquo; &amp;hellip;) so the meta text reads naturally.
 */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rsquo;/g, "’")
    .replace(/&hellip;/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}
