import Link from "next/link";
import { cn } from "@/lib/cn";
import { InstagramIcon } from "./icons";
import {
  getFooterContent,
  FOOTER_FALLBACK,
  type FooterContent,
} from "@/lib/cms/footer-content";

interface PresentationalProps {
  className?: string;
  content: FooterContent;
}

/**
 * Sync presentational footer. Used directly only by client components
 * (which can't render async server components). Server pages should
 * import the default `SiteFooter` instead, which fetches live content
 * from the DB.
 */
export function SiteFooterStatic({ className, content }: PresentationalProps) {
  const year = new Date().getFullYear();
  // Operator can use the literal '{year}' token in the copyright string —
  // we substitute the current year here so they don't have to edit it
  // every January.
  const copyright = content.copyright.replace(/\{year\}/g, String(year));

  return (
    <footer
      className={cn(
        "border-t border-border-light bg-surface-primary text-foreground-primary",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1440px] px-5 py-16 md:px-10 md:py-24">
        <div className="grid gap-12 md:grid-cols-4 md:gap-8">
          {content.columns.map((col, idx) => (
            <div key={idx} className="flex flex-col gap-4">
              {col.title && (
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary">
                  {col.title}
                </h4>
              )}
              <ul className="flex flex-col gap-3">
                {col.links.map((link, lidx) => (
                  <li key={lidx}>
                    <Link
                      href={link.href || "#"}
                      className="text-[13px] text-foreground-primary transition-colors hover:text-foreground-secondary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {content.instagramUrl && (
            <div className="flex flex-col gap-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary">
                Follow
              </h4>
              <a
                href={content.instagramUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="inline-flex h-10 w-10 items-center justify-center text-foreground-primary transition-colors hover:text-foreground-secondary"
              >
                <InstagramIcon />
              </a>
            </div>
          )}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border-light pt-8 md:flex-row md:items-center">
          {copyright && (
            <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary">
              {copyright}
            </p>
          )}
          {content.tagline && (
            <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary">
              {content.tagline}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}

/**
 * Async footer used by all server-component pages. Reads live footer
 * content from the DB so admin edits at /admin/content/settings →
 * Footer propagate to every page on the next request.
 */
export async function SiteFooter({ className }: { className?: string }) {
  const content = await getFooterContent();
  return <SiteFooterStatic className={className} content={content} />;
}

/**
 * Re-export the bundled fallback so client-component pages
 * (initiate-return, ui-kit) can render `<SiteFooterStatic content={...} />`
 * without their own constant table.
 */
export { FOOTER_FALLBACK as STATIC_FOOTER_FALLBACK };
