import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryEditForm } from '../category-edit-form';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const initial = {
  name: 'Outerwear',
  slug: 'outerwear',
  description: 'd',
  parentId: null as string | null,
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

  it('warns when picked parent is in the illegal set', async () => {
    render(
      <CategoryEditForm
        categoryId="c1"
        initial={initial}
        parentOptions={[
          { id: 'c1', name: 'Self', depth: 0 },
          { id: 'd1', name: 'Descendant', depth: 1 },
          { id: 'ok', name: 'Other', depth: 0 },
        ]}
        illegalParentIds={['c1', 'd1']}
      />,
    );
    fireEvent.change(screen.getByLabelText(/parent/i), { target: { value: 'd1' } });
    expect(screen.getByText(/would create a cycle/i)).toBeInTheDocument();
    // Submit button is disabled while warning is active.
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('PATCHes successfully and refreshes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({ ok: true, status: 200 });
    render(
      <CategoryEditForm
        categoryId="c1"
        initial={initial}
        parentOptions={[]}
        illegalParentIds={['c1']}
      />,
    );
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

  it('surfaces 422 cycle error from server', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'Category move would create a cycle' }),
    });
    render(
      <CategoryEditForm
        categoryId="c1"
        initial={initial}
        parentOptions={[{ id: 'p2', name: 'P2', depth: 0 }]}
        illegalParentIds={['c1']}
      />,
    );
    // Pick a parent that the client thinks is legal but the server rejects.
    fireEvent.change(screen.getByLabelText(/parent/i), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/would create a cycle/i)).toBeInTheDocument();
    });
  });

  it('archive button calls DELETE and redirects to list', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({ ok: true, status: 200 });
    render(
      <CategoryEditForm
        categoryId="c1"
        initial={initial}
        parentOptions={[]}
        illegalParentIds={['c1']}
      />,
    );
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
