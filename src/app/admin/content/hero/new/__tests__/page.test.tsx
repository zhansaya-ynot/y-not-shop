import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HeroCreateForm } from '../_components/hero-create-form';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

describe('<HeroCreateForm>', () => {
  beforeEach(() => {
    pushMock.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('on success POSTs to /api/admin/content/hero and redirects to detail page', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'h1' }),
    });
    render(<HeroCreateForm />);
    fireEvent.change(screen.getByLabelText(/desktop image url/i), {
      target: { value: 'https://example.com/a.jpg' },
    });
    fireEvent.change(screen.getByLabelText(/eyebrow/i), { target: { value: 'Spring' } });
    fireEvent.change(screen.getByLabelText(/cta label/i), { target: { value: 'Shop' } });
    fireEvent.change(screen.getByLabelText(/cta href/i), { target: { value: '/shop' } });
    fireEvent.click(screen.getByRole('button', { name: /create hero/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/content/hero',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/content/hero/h1');
    });
  });

  it('POSTs the mobile crop alongside the desktop one', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'h9' }),
    });
    render(<HeroCreateForm />);
    fireEvent.change(screen.getByLabelText(/desktop image url/i), {
      target: { value: 'https://x/h-16x9.jpg' },
    });
    fireEvent.change(screen.getByLabelText(/mobile image url/i), {
      target: { value: 'https://x/h-9x16.jpg' },
    });
    fireEvent.change(screen.getByLabelText(/eyebrow/i), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText(/cta label/i), { target: { value: 'Shop' } });
    fireEvent.change(screen.getByLabelText(/cta href/i), { target: { value: '/shop' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.imageUrl).toBe('https://x/h-16x9.jpg');
    expect(body.mobileImageUrl).toBe('https://x/h-9x16.jpg');
  });
});
