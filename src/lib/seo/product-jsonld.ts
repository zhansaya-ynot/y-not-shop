import type { Product } from "@/lib/schemas";
import { stripHtml } from "@/lib/strip-html";

export interface ProductJsonLd {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  image: string[];
  sku: string;
  brand: { "@type": "Brand"; name: string };
  offers: {
    "@type": "Offer";
    url: string;
    priceCurrency: string;
    price: string;
    availability: string;
  };
}

function availability(product: Product): string {
  if (product.preOrder) return "https://schema.org/PreOrder";
  const inStock = Object.values(product.stock).some((n) => (n ?? 0) > 0);
  return inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
}

function formatPriceMajor(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export function buildProductJsonLd(
  product: Product,
  baseUrl: string,
): ProductJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: stripHtml(product.description),
    image: product.images.map((src) =>
      src.startsWith("http") ? src : `${baseUrl}${src}`,
    ),
    sku: product.id,
    brand: { "@type": "Brand", name: "YNOT London" },
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/products/${product.slug}`,
      priceCurrency: product.currency,
      price: formatPriceMajor(product.price),
      availability: availability(product),
    },
  };
}
