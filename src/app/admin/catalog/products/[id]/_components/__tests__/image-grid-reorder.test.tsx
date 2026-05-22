import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageGridReorder } from '../image-grid-reorder';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe('<ImageGridReorder>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('renders empty state when no images', () => {
    render(<ImageGridReorder productId="p1" images={[]} colours={[]} />);
    expect(screen.getByText(/no images yet/i)).toBeInTheDocument();
  });

  it('renders one tile per image', () => {
    const images = [
      { id: 'i1', url: 'http://x/1.jpg', alt: '', sortOrder: 0, colour: null },
      { id: 'i2', url: 'http://x/2.jpg', alt: '', sortOrder: 1, colour: null },
    ];
    render(<ImageGridReorder productId="p1" images={images} colours={[]} />);
    expect(screen.getByTestId('image-i1')).toBeInTheDocument();
    expect(screen.getByTestId('image-i2')).toBeInTheDocument();
  });

  it('removes image via DELETE', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const images = [{ id: 'i1', url: 'http://x/1.jpg', alt: '', sortOrder: 0, colour: null }];
    render(<ImageGridReorder productId="p1" images={images} colours={[]} />);
    fireEvent.click(screen.getByText('×'));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/products/p1/images/i1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('shows a colour dropdown per image when colours exist + PATCHes on change', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const images = [{ id: 'i1', url: 'http://x/1.jpg', alt: '', sortOrder: 0, colour: null }];
    render(<ImageGridReorder productId="p1" images={images} colours={['Black', 'Tan']} />);
    const select = screen.getByTitle(/which colour this image belongs to/i);
    fireEvent.change(select, { target: { value: 'Tan' } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/products/p1/images/colour',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ imageId: 'i1', colour: 'Tan' });
  });
});
