import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkdownEditor } from '../markdown-editor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

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

  it('renders preview that reflects body markdown', () => {
    render(<MarkdownEditor id="p1" initial={initial} />);
    const preview = screen.getByTestId('markdown-preview');
    expect(preview.querySelector('h1')?.textContent).toBe('Hello');
  });

  it('updates preview as the textarea changes', () => {
    render(<MarkdownEditor id="p1" initial={initial} />);
    const textarea = screen.getByTestId('markdown-textarea');
    fireEvent.change(textarea, { target: { value: '## New heading' } });
    const preview = screen.getByTestId('markdown-preview');
    expect(preview.querySelector('h2')?.textContent).toBe('New heading');
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
