import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HeroEditForm } from '../_components/hero-edit-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const initial = {
  kind: 'IMAGE' as const,
  imageUrl: 'https://x/hero-16x9.jpg',
  mobileImageUrl: 'https://x/hero-9x16.jpg',
  videoUrl: null,
  mobileVideoUrl: null,
  eyebrow: 'New Collection',
  ctaLabel: 'EXPLORE',
  ctaHref: '/new-collection',
};

describe('<HeroEditForm> responsive assets', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  it('offers a separate URL field per breakpoint and pre-fills both', () => {
    render(<HeroEditForm id="h1" initial={initial} />);
    expect(screen.getByLabelText(/desktop image url/i)).toHaveValue(
      'https://x/hero-16x9.jpg',
    );
    expect(screen.getByLabelText(/mobile image url/i)).toHaveValue(
      'https://x/hero-9x16.jpg',
    );
  });

  it('sends the edited mobile crop on save', async () => {
    render(<HeroEditForm id="h1" initial={initial} />);
    fireEvent.change(screen.getByLabelText(/mobile image url/i), {
      target: { value: 'https://x/hero-portrait.jpg' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.imageUrl).toBe('https://x/hero-16x9.jpg');
    expect(body.mobileImageUrl).toBe('https://x/hero-portrait.jpg');
  });

  it('sends null rather than an empty string when the mobile crop is cleared', async () => {
    render(<HeroEditForm id="h1" initial={initial} />);
    fireEvent.change(screen.getByLabelText(/mobile image url/i), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.mobileImageUrl).toBeNull();
  });

  it('offers both video fields when the hero is a video', () => {
    render(
      <HeroEditForm
        id="h1"
        initial={{
          ...initial,
          kind: 'VIDEO',
          videoUrl: 'https://x/hero-16x9.mp4',
          mobileVideoUrl: 'https://x/hero-9x16.mp4',
        }}
      />,
    );
    expect(screen.getByLabelText(/desktop video url/i)).toHaveValue(
      'https://x/hero-16x9.mp4',
    );
    expect(screen.getByLabelText(/mobile video url/i)).toHaveValue(
      'https://x/hero-9x16.mp4',
    );
  });
});
