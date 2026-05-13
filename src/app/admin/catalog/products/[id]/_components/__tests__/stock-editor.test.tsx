import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StockEditor } from '../stock-editor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('<StockEditor>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('sized product — renders 5 rows for XS S M L XL', () => {
    render(<StockEditor productId="p1" initial={[]} isOneSize={false} />);
    expect(screen.getByTestId('stock-XS')).toBeInTheDocument();
    expect(screen.getByTestId('stock-S')).toBeInTheDocument();
    expect(screen.getByTestId('stock-M')).toBeInTheDocument();
    expect(screen.getByTestId('stock-L')).toBeInTheDocument();
    expect(screen.getByTestId('stock-XL')).toBeInTheDocument();
    expect(screen.queryByTestId('stock-one-size')).not.toBeInTheDocument();
  });

  it('one-size product — renders a single stock input + hides the grid', () => {
    render(<StockEditor productId="p1" initial={[{ size: 'M', stock: 4 }]} isOneSize />);
    expect(screen.getByTestId('stock-one-size')).toBeInTheDocument();
    expect((screen.getByTestId('stock-one-size') as HTMLInputElement).value).toBe('4');
    expect(screen.queryByTestId('stock-XS')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-S')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-L')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-XL')).not.toBeInTheDocument();
  });

  it('preloads initial stock', () => {
    render(<StockEditor productId="p1" initial={[{ size: 'M', stock: 7 }]} isOneSize={false} />);
    expect((screen.getByTestId('stock-M') as HTMLInputElement).value).toBe('7');
    expect((screen.getByTestId('stock-S') as HTMLInputElement).value).toBe('0');
  });

  it('sized — on save PATCHes /sizes with full set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(<StockEditor productId="p1" initial={[]} isOneSize={false} />);
    fireEvent.change(screen.getByTestId('stock-M'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save stock/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/products/p1/sizes',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sizes).toHaveLength(5);
    const m = body.sizes.find((s: { size: string }) => s.size === 'M');
    expect(m.stock).toBe(5);
  });

  it('one-size — saves with stock on M and zeros on the others', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(
      <StockEditor
        productId="p1"
        initial={[
          { size: 'XS', stock: 99 },
          { size: 'M', stock: 1 },
        ]}
        isOneSize
      />,
    );
    fireEvent.change(screen.getByTestId('stock-one-size'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /save stock/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sizes).toHaveLength(5);
    const stockBy = Object.fromEntries(
      (body.sizes as Array<{ size: string; stock: number }>).map((s) => [s.size, s.stock]),
    );
    expect(stockBy.M).toBe(12);
    expect(stockBy.XS).toBe(0);
    expect(stockBy.S).toBe(0);
    expect(stockBy.L).toBe(0);
    expect(stockBy.XL).toBe(0);
  });
});
