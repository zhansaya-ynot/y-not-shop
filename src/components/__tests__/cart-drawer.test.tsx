import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartDrawer } from '../cart-drawer';
import { useCartStore } from '@/lib/stores/cart-store';

const sampleSnapshot = {
  id: 'cart-1',
  items: [
    {
      id: 'item-1',
      productId: 'prod_001',
      productSlug: 'belted-suede-field-jacket',
      productName: 'Belted Suede Field Jacket',
      productImage: '/sample/jacket-1.svg',
      colour: 'Chocolate Brown',
      size: 'M' as const,
      quantity: 1,
      unitPriceCents: 89500,
      currency: 'GBP' as const,
      isPreorder: false,
      preorderBatchId: null,
      stockAvailable: 5,
    },
  ],
  subtotalCents: 89500,
  discountCents: 0,
  promo: null,
  itemCount: 1,
  expiresAt: new Date().toISOString(),
};

beforeEach(() => {
  useCartStore.setState({ snapshot: null, isOpen: true, isLoading: false });
});

describe('CartDrawer', () => {
  it('renders empty state when no items', () => {
    render(<CartDrawer />);
    expect(screen.getByText(/your bag is empty/i)).toBeInTheDocument();
  });

  it('renders cart items and subtotal', () => {
    useCartStore.setState({ snapshot: sampleSnapshot });
    render(<CartDrawer />);
    expect(screen.getByText('Belted Suede Field Jacket')).toBeInTheDocument();
    expect(screen.getAllByText('£895').length).toBeGreaterThanOrEqual(1);
  });

  it('removes item when Remove clicked', async () => {
    useCartStore.setState({ snapshot: sampleSnapshot });
    // Mock removeItem to avoid actual fetch
    const removeItem = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useCartStore.setState({ removeItem } as any);
    render(<CartDrawer />);
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(removeItem).toHaveBeenCalledWith('item-1');
  });

  it('does not render when closed', () => {
    useCartStore.setState({ isOpen: false });
    render(<CartDrawer />);
    expect(screen.queryByText(/your bag/i)).toBeNull();
  });

  it('renders the pre-order eyebrow with spec wording when isPreorder is true', () => {
    const preorderSnapshot = {
      ...sampleSnapshot,
      items: [
        {
          ...sampleSnapshot.items[0],
          isPreorder: true,
          preorderBatchId: null,
          // backing stock is zero — preorder should still allow this item
          stockAvailable: 0,
        },
      ],
    };
    useCartStore.setState({ snapshot: preorderSnapshot });
    render(<CartDrawer />);
    expect(
      screen.getByText(/Pre-order — ships in 3 weeks/i),
    ).toBeInTheDocument();
    // No out-of-stock warning even though stockAvailable is 0
    expect(screen.queryByText(/out of stock/i)).toBeNull();
    expect(screen.queryByText(/sold out/i)).toBeNull();
  });
});
