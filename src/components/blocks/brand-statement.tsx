import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";

export interface BrandStatementProps {
  primary: string;
  secondary: string;
  /** Optional third line rendered with the same styling as `secondary` —
   *  used when the brand copy splits into two short eyebrow lines. */
  tertiary?: string;
}

export function BrandStatement({ primary, secondary, tertiary }: BrandStatementProps) {
  return (
    <Section background="cream" padding="lg">
      <div className="mx-auto w-full max-w-[800px] text-center px-6">
        <Display level="md" as="p" className="text-foreground-on-cream">
          {primary}
        </Display>
        <p className="mt-6 text-[12px] uppercase tracking-[0.3em] text-foreground-on-cream">
          {secondary}
        </p>
        {tertiary && (
          <p className="mt-2 text-[12px] uppercase tracking-[0.3em] text-foreground-on-cream">
            {tertiary}
          </p>
        )}
      </div>
    </Section>
  );
}
