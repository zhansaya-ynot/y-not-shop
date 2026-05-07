import Image from "next/image";
import { BLUR_DARK } from "@/lib/image-placeholders";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface ProductCardProps {
  href: string;
  name: string;
  price: string;
  image: string;
  hoverImage?: string;
  badge?: "new" | "pre-order";
  className?: string;
  priority?: boolean;
}

const badgeLabel: Record<NonNullable<ProductCardProps["badge"]>, string> = {
  new: "New",
  "pre-order": "Pre-order",
};

export function ProductCard({
  href,
  name,
  price,
  image,
  hoverImage,
  badge,
  className,
  priority,
}: ProductCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block text-foreground-primary",
        className,
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-secondary">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          priority={priority}
          placeholder="blur"
          blurDataURL={BLUR_DARK}
          quality={75}
          className={cn(
            "object-cover transition-opacity duration-500",
            hoverImage && "group-hover:opacity-0",
          )}
        />
        {hoverImage && (
          <Image
            src={hoverImage}
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            placeholder="blur"
            blurDataURL={BLUR_DARK}
            quality={75}
            loading="lazy"
            className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
        {badge && (
          <span className="absolute left-3 top-3 bg-surface-primary/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground-primary">
            {badgeLabel[badge]}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <h3 className="text-[13px] font-medium tracking-wide">{name}</h3>
        <p className="text-[13px] text-foreground-secondary">{price}</p>
      </div>
    </Link>
  );
}
