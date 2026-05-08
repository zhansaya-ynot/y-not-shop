import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryCreateForm } from '../_components/category-create-form';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

describe('<CategoryCreateForm>', () => {
  beforeEach(() => {
    pushMock.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('renders the minimum fields (name / slug / description) and create button', () => {
    render(<CategoryCreateForm />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText(/Slug/)).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create category/i })).toBeInTheDocument();
  });

  it('on success POSTs to /api/admin/categories and redirects to detail page', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'cat123' }),
    });
    render(<CategoryCreateForm />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Outerwear' } });
    fireEvent.click(screen.getByRole('button', { name: /create category/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/categories',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/catalog/categories/cat123');
    });
  });

  it('shows error message when POST fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
    });
    render(<CategoryCreateForm />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /create category/i }));

    await waitFor(() => {
      expect(screen.getByText(/Create failed \(400\)/)).toBeInTheDocument();
    });
  });
});
