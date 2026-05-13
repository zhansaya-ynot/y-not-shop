import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StatusActions } from '../status-actions';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('<StatusActions>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('DRAFT — Publish + Archive enabled, Unpublish disabled', () => {
    render(<StatusActions productId="p1" status="DRAFT" />);
    expect(screen.getByRole('button', { name: /^publish$/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /archive/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /unpublish/i })).toBeDisabled();
  });

  it('ARCHIVED — only Restore is enabled (ARCHIVED → DRAFT)', () => {
    render(<StatusActions productId="p1" status="ARCHIVED" />);
    expect(screen.getByRole('button', { name: /^publish$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /restore/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /archive/i })).toBeDisabled();
  });

  it('Restore (from ARCHIVED) POSTs to /status with to=DRAFT', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<StatusActions productId="p1" status="ARCHIVED" />);
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/products/p1/status',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe('DRAFT');
  });

  it('Archive click prompts for confirmation before POSTing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<StatusActions productId="p1" status="DRAFT" />);
    fireEvent.click(screen.getByRole('button', { name: /archive/i }));
    expect(confirmSpy).toHaveBeenCalled();
    // confirm returned false → no request was made
    expect(fetchMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('Publish click POSTs to /status with to=PUBLISHED', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<StatusActions productId="p1" status="DRAFT" />);
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/products/p1/status',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe('PUBLISHED');
  });
});
