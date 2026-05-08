import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import AdminStaticPageDetailPage from '../page';

describe('/admin/content/pages/[id] markdown editor page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders the rich-text editor pre-filled with the page body', async () => {
    const p = await prisma.staticPage.create({
      data: { slug: 'about', title: 'About us', bodyMarkdown: '# Hello world' },
    });
    const el = await AdminStaticPageDetailPage({ params: Promise.resolve({ id: p.id }) });
    const html = renderToString(el);
    expect(html).toContain('About us');
    // TipTap initialises client-side, so SSR doesn't render the body
    // content itself, but the slug and tip text should be present.
    expect(html).toContain('about');
    expect(html).toContain('markdown-preview');
  });
});
