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
    heading: 'CATALOG',
    items: [
      { href: '/admin/catalog/products', label: 'Products' },
      { href: '/admin/catalog/categories', label: 'Categories' },
    ],
  },
  {
    heading: 'CONTENT',
    items: [
      { href: '/admin/content/hero', label: 'Hero' },
      { href: '/admin/content/announcements', label: 'Announcements' },
      { href: '/admin/content/lookbook', label: 'Lookbook' },
      { href: '/admin/content/pages', label: 'Pages' },
      { href: '/admin/content/settings', label: 'Settings' },
    ],
  },
  {
    heading: 'MARKETING',
    items: [{ href: '/admin/marketing/promos', label: 'Promo codes' }],
  },
  {
    heading: 'SHIPPING',
    items: [
      { href: '/admin/shipping/zones', label: 'Zones' },
      { href: '/admin/preorders', label: 'Preorder batches' },
    ],
  },
];
