import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryEditForm } from '../category-edit-form';

// SingleImageUpload posts to /api/admin/media/upload — we don't need it
// in these unit tests, just stub it out so render doesn't try to fetch.
vi.mock('@/app/admin/content/_components/single-image-upload', () => ({
  SingleImageUpload: () => null,
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const initial = {
  name: 'Outerwear',
  slug: 'outerwear',
  description: 'd',
  bannerImage: null as string | null,
};

describe('<CategoryEditForm>', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
    // Suppress JSDom confirm prompt during archive flow.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.confirm = () => true;
  });

  it('PATCHes successfully and refreshes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({ ok: true, status: 200 });
    render(<CategoryEditForm categoryId="c1" initial={initial} />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Outerwear 2' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/categories/c1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it('archive button calls DELETE and redirects to list', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({ ok: true, status: 200 });
    render(<CategoryEditForm categoryId="c1" initial={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /archive/i }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/categories/c1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/catalog/categories');
    });
  });
});
