import { marked } from 'marked';

/**
 * Detect markdown formatting markers inside what should be HTML body
 * content. Triggered by leading `#` / `##` / `###`, bold `**…**`, or
 * bullet markers (`- `, `* `). Conservative on purpose — false negatives
 * (rendering markdown as text) are ugly but not destructive; false
 * positives (mistaking a real `#` in prose for a heading) would mangle
 * legitimate copy.
 */
function looksLikeMarkdownText(s: string): boolean {
  // Heading at start-of-string or start-of-line
  if (/(^|\n|\s)#{1,3}\s\S/.test(s)) return true;
  // Bold/italic markers
  if (/\*\*[^*\n]+\*\*/.test(s)) return true;
  // Bullet list (only if not inside a sentence — preceded by start, newline, or space-then-newline-style)
  if (/(^|\n|\s)[-*]\s+\S/.test(s) && !/[a-z],\s+[-*]/.test(s)) return true;
  return false;
}

/**
 * Render TipTap body content to HTML. If the operator pasted markdown
 * (e.g. typed `# Header` rather than clicking the H2 button), TipTap
 * stores it as literal text in a `<p>` — this helper detects that and
 * runs the content through `marked` so the storefront sees proper
 * structured HTML. Real TipTap output (multiple block-level elements
 * like `<h2>`, `<ul>`, `<blockquote>`) passes through untouched.
 *
 * Why this lives storefront-side and not in the editor: editor-side
 * coercion would mutate the operator's input mid-edit and feel weird;
 * doing it at render keeps the stored value verbatim and lets us
 * iterate the heuristic without a data migration.
 */
export function renderRichBodyHtml(content: string): string {
  if (!content) return content;
  // Multiple structured block elements → real HTML, render verbatim.
  // We look for any non-`<p>` block element as the proxy for "this
  // content has structure" (the editor wraps plain text in a single
  // `<p>` even when there's no formatting at all).
  if (/<\/(?:h[1-6]|ul|ol|blockquote|pre|table|figure|hr)>/i.test(content)) {
    return content;
  }

  const stripped = content
    .replace(/^<p>/, '')
    .replace(/<\/p>$/, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/p>\s*<p>/g, '\n\n')
    .trim();

  if (!looksLikeMarkdownText(stripped)) return content;

  // Operators tend to paste a markdown chunk that the editor crams
  // onto one line. Re-introduce newlines before block-level markers
  // so marked actually parses them as blocks.
  const normalised = stripped
    .replace(/\s*(#{1,3}\s)/g, '\n\n$1')
    .replace(/\s+(-\s)/g, '\n$1')
    .trim();

  return marked.parse(normalised, { async: false }) as string;
}
