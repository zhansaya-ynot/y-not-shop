import { describe, expect, it } from 'vitest';
import { NAV_SECTIONS } from '../nav-sections';

describe('admin sidebar NAV_SECTIONS', () => {
  it('groups links into the operator domains', () => {
    const headings = NAV_SECTIONS.map((s) => s.heading);
    expect(headings).toEqual([
      'DASHBOARD',
      'ORDERS',
      'CUSTOMERS',
      'MESSAGES',
      'CATALOG',
      'PAGES',
      'GLOBAL',
      'MARKETING',
      'SHIPPING',
    ]);
  });

  it('PAGES section has a direct link per migrated storefront page', () => {
    const pages = NAV_SECTIONS.find((s) => s.heading === 'PAGES');
    const hrefs = pages?.items.map((i) => i.href) ?? [];
    // Hero is its own admin route (not StaticPage-driven yet); the rest
    // resolve via the by-slug redirect so the operator never has to
    // remember a cuid.
    expect(hrefs).toEqual([
      '/admin/content/hero',
      '/admin/content/pages/by-slug/our-story',
      '/admin/content/pages/by-slug/contact',
      '/admin/content/pages/by-slug/shipping-returns',
      '/admin/content/pages/by-slug/sustainability',
      '/admin/content/pages/by-slug/product-care',
      '/admin/content/pages',
    ]);
  });

  it('GLOBAL section covers announcement bar, lookbook, site settings', () => {
    const global = NAV_SECTIONS.find((s) => s.heading === 'GLOBAL');
    const hrefs = global?.items.map((i) => i.href) ?? [];
    expect(hrefs).toEqual([
      '/admin/content/announcements',
      '/admin/content/lookbook',
      '/admin/content/settings',
    ]);
  });

  it('exposes catalog products + categories', () => {
    const catalog = NAV_SECTIONS.find((s) => s.heading === 'CATALOG');
    const hrefs = catalog?.items.map((i) => i.href) ?? [];
    expect(hrefs).toContain('/admin/catalog/products');
    expect(hrefs).toContain('/admin/catalog/categories');
  });

  it('keeps promo codes link wired up', () => {
    const marketing = NAV_SECTIONS.find((s) => s.heading === 'MARKETING');
    expect(marketing?.items[0].href).toBe('/admin/marketing/promos');
  });

  it('all hrefs are unique', () => {
    const all = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(new Set(all).size).toBe(all.length);
  });
});
