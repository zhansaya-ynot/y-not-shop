export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

/**
 * Admin sidebar navigation. Grouped so the operator can scan by domain
 * (orders vs catalog vs content vs marketing) instead of a flat link list.
 *
 * The PAGES section gives every storefront page its own direct link —
 * `/admin/content/pages/by-slug/<slug>` resolves to the per-page editor
 * without the operator having to drill into a list. Add a new entry
 * here when migrating another page's content into StaticPage.extras.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'DASHBOARD',
    items: [{ href: '/admin', label: 'Overview' }],
  },
  {
    heading: 'ORDERS',
    items: [
      { href: '/admin/orders', label: 'All orders' },
      { href: '/admin/returns', label: 'Returns' },
    ],
  },
  {
    heading: 'CUSTOMERS',
    items: [{ href: '/admin/customers', label: 'All customers' }],
  },
  {
    heading: 'MESSAGES',
    items: [{ href: '/admin/messages', label: 'Inbox' }],
  },
  {
    heading: 'CATALOG',
    items: [
      { href: '/admin/catalog/products', label: 'Products' },
      { href: '/admin/catalog/categories', label: 'Categories' },
      { href: '/admin/inventory', label: 'Inventory' },
    ],
  },
  {
    heading: 'PAGES',
    items: [
      { href: '/admin/content/hero', label: 'Home — Hero' },
      { href: '/admin/content/editorial', label: 'Home — Timeless block' },
      { href: '/admin/content/pages/by-slug/our-story', label: 'Our Story' },
      { href: '/admin/content/pages/by-slug/contact', label: 'Contact' },
      { href: '/admin/content/pages/by-slug/shipping-returns', label: 'Shipping & Returns' },
      { href: '/admin/content/pages/by-slug/sustainability', label: 'Sustainability' },
      { href: '/admin/content/pages/by-slug/product-care', label: 'Product Care' },
      { href: '/admin/content/pages', label: 'All pages…' },
    ],
  },
  {
    heading: 'GLOBAL',
    items: [
      { href: '/admin/content/announcements', label: 'Announcement bar' },
      { href: '/admin/content/lookbook', label: 'Lookbook' },
      { href: '/admin/content/settings', label: 'Site settings' },
    ],
  },
  {
    heading: 'MARKETING',
    items: [
      { href: '/admin/marketing/promos', label: 'Promo codes' },
      { href: '/admin/marketing/newsletter', label: 'Newsletter' },
    ],
  },
  {
    heading: 'SHIPPING',
    items: [
      { href: '/admin/shipping/zones', label: 'Zones' },
      { href: '/admin/preorders', label: 'Preorder batches' },
    ],
  },
];
