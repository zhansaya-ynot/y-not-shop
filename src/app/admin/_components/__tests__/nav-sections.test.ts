import { describe, expect, it } from 'vitest';
import { NAV_SECTIONS } from '../nav-sections';

describe('admin sidebar NAV_SECTIONS', () => {
  it('groups links into the operator domains', () => {
    const headings = NAV_SECTIONS.map((s) => s.heading);
    expect(headings).toEqual([
      'DASHBOARD',
      'ORDERS',
      'CATALOG',
      'CONTENT',
      'MARKETING',
      'SHIPPING',
    ]);
  });

  it('includes every CONTENT child page', () => {
    const content = NAV_SECTIONS.find((s) => s.heading === 'CONTENT');
    expect(content?.items.map((i) => i.href)).toEqual([
      '/admin/content/hero',
      '/admin/content/announcements',
      '/admin/content/lookbook',
      '/admin/content/pages',
      '/admin/content/settings',
    ]);
  });

  it('exposes catalog products + categories', () => {
    const catalog = NAV_SECTIONS.find((s) => s.heading === 'CATALOG');
    const hrefs = catalog?.items.map((i) => i.href) ?? [];
    expect(hrefs).toContain('/admin/catalog/products');
    expect(hrefs).toContain('/admin/catalog/categories');
  });

  it('includes the (still-pending) promo codes link', () => {
    // /admin/marketing/promos will 404 until Group M lands; the link is
    // wired up in advance so the IA is stable.
    const marketing = NAV_SECTIONS.find((s) => s.heading === 'MARKETING');
    expect(marketing?.items[0].href).toBe('/admin/marketing/promos');
  });

  it('all hrefs are unique', () => {
    const all = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(new Set(all).size).toBe(all.length);
  });
});
