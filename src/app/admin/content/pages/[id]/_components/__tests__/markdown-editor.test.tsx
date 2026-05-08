import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkdownEditor } from '../markdown-editor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// TipTap requires a real document — happy-dom is enough but we still need
// to silence the immediatelyRender warning by passing immediatelyRender:false.
const initial = {
  slug: 'about',
  title: 'About',
  bodyMarkdown: '# Hello',
  metaTitle: '',
  metaDescription: '',
  heroImage: null as string | null,
};

describe('<MarkdownEditor>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('renders the title input pre-filled', () => {
    render(<MarkdownEditor id="p1" initial={initial} />);
    expect(screen.getByDisplayValue('About')).toBeTruthy();
  });

  it('saves via PATCH', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<MarkdownEditor id="p1" initial={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/content/pages/p1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });
});
