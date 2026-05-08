import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SitePolicyForm } from '../site-policy-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const initial = {
  defaultCurrency: 'GBP' as const,
  defaultCarrier: 'ROYAL_MAIL' as const,
  freeShipThresholdCents: 20000,
  contactEmail: 'hello@ynot.london',
  whatsappNumber: '',
  authSignInImage: null as string | null,
  authRegisterImage: null as string | null,
  brandStatementPrimary: '',
  brandStatementSecondary: '',
  brandStatementTertiary: '',
};

describe('<SitePolicyForm>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('PATCHes /api/admin/content/settings on save', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<SitePolicyForm initial={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/content/settings',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('shows save success message', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<SitePolicyForm initial={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
  });
});
