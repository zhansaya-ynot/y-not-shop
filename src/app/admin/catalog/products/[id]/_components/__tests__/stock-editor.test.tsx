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

  it('sized product — renders 3 rows for S M L', () => {
    render(<StockEditor productId="p1" initial={[]} isOneSize={false} />);
    expect(screen.getByTestId('stock-S')).toBeInTheDocument();
    expect(screen.getByTestId('stock-M')).toBeInTheDocument();
    expect(screen.getByTestId('stock-L')).toBeInTheDocument();
    expect(screen.queryByTestId('stock-one-size')).not.toBeInTheDocument();
  });

  it('one-size product — renders a single stock input + hides the grid', () => {
    render(<StockEditor productId="p1" initial={[{ size: 'M', stock: 4 }]} isOneSize />);
    expect(screen.getByTestId('stock-one-size')).toBeInTheDocument();
    expect((screen.getByTestId('stock-one-size') as HTMLInputElement).value).toBe('4');
    expect(screen.queryByTestId('stock-S')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-L')).not.toBeInTheDocument();
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
    expect(body.sizes).toHaveLength(3);
    const m = body.sizes.find((s: { size: string }) => s.size === 'M');
    expect(m.stock).toBe(5);
  });

  it('one-size — saves a single M row under colour "" (server replaces the rest)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(
      <StockEditor
        productId="p1"
        initial={[{ size: 'M', colour: '', stock: 1 }]}
        isOneSize
      />,
    );
    fireEvent.change(screen.getByTestId('stock-one-size'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /save stock/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sizes).toHaveLength(1);
    expect(body.sizes[0]).toMatchObject({ size: 'M', colour: '', stock: 12 });
  });

  it('with colours — renders a size × colour matrix and saves every cell', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(
      <StockEditor
        productId="p1"
        initial={[{ size: 'M', colour: 'Black', stock: 2 }]}
        isOneSize={false}
        colours={['Black', 'Red']}
      />,
    );
    expect((screen.getByTestId('stock-M-Black') as HTMLInputElement).value).toBe('2');
    fireEvent.change(screen.getByTestId('stock-L-Red'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /save stock/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // 3 sizes × 2 colours = 6 cells.
    expect(body.sizes).toHaveLength(6);
    const cell = body.sizes.find(
      (s: { size: string; colour: string }) => s.size === 'L' && s.colour === 'Red',
    );
    expect(cell.stock).toBe(4);
  });
});
