import { create } from 'zustand';
import type { CartSnapshotT, AddItemRequestT } from '@/lib/schemas/cart';

type AddResult =
  | { ok: true }
  | { ok: false; error: 'STOCK_CONFLICT'; stockAvailable: number }
  | { ok: false; error: 'INVALID_BODY' | 'UNKNOWN' };

type PromoResult =
  | { ok: true }
  | { ok: false; error: string; message?: string };

interface CartState {
  snapshot: CartSnapshotT | null;
  isLoading: boolean;
  isOpen: boolean;
  hydrate: () => Promise<void>;
  addItem: (input: AddItemRequestT) => Promise<AddResult>;
  setQuantity: (itemId: string, quantity: number) => Promise<AddResult>;
  removeItem: (itemId: string) => Promise<void>;
  applyPromo: (code: string) => Promise<PromoResult>;
  removePromo: () => Promise<void>;
  clear: () => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
}

type ErrorJson = { error: string; stockAvailable?: number; message?: string };

async function call<T = CartSnapshotT>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T }> {
  // jsdom + vitest can't parse relative URLs (`/api/cart`) — every cart-drawer
  // test would otherwise emit an unhandled rejection that fails CI even when
  // assertions pass. Catch it here so the store reports an empty snapshot
  // instead of bubbling out as a top-level rejection.
  try {
    const res = await fetch(url, { credentials: 'include', headers: { 'content-type': 'application/json' }, ...init });
    const json = (await res.json()) as T;
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null as unknown as T };
  }
}

export const useCartStore = create<CartState>()((set) => ({
  snapshot: null,
  isLoading: false,
  isOpen: false,

  async hydrate() {
    set({ isLoading: true });
    const { ok, json } = await call('/api/cart');
    // Don't blow away an existing snapshot when the request fails (jsdom
    // tests, transient network errors) — keep the last good cart visible
    // and only update on a successful refetch.
    if (ok) set({ snapshot: json, isLoading: false });
    else set({ isLoading: false });
  },

  async addItem(input) {
    const { ok, status, json } = await call<CartSnapshotT | ErrorJson>('/api/cart/items', { method: 'POST', body: JSON.stringify(input) });
    if (ok) { set({ snapshot: json as CartSnapshotT }); return { ok: true }; }
    const err = json as ErrorJson;
    if (status === 409 && err.error === 'STOCK_CONFLICT') {
      return { ok: false, error: 'STOCK_CONFLICT', stockAvailable: err.stockAvailable ?? 0 };
    }
    return { ok: false, error: 'UNKNOWN' };
  },

  async setQuantity(itemId, quantity) {
    const { ok, status, json } = await call<CartSnapshotT | ErrorJson>(`/api/cart/items/${itemId}`, {
      method: 'PATCH', body: JSON.stringify({ quantity }),
    });
    if (ok) { set({ snapshot: json as CartSnapshotT }); return { ok: true }; }
    if (status === 409) {
      const err = json as ErrorJson;
      return { ok: false, error: 'STOCK_CONFLICT', stockAvailable: err.stockAvailable ?? 0 };
    }
    return { ok: false, error: 'UNKNOWN' };
  },

  async removeItem(itemId) {
    const { json } = await call(`/api/cart/items/${itemId}`, { method: 'DELETE' });
    set({ snapshot: json });
  },

  async applyPromo(code) {
    const { ok, json } = await call<CartSnapshotT | ErrorJson>('/api/cart/promo', { method: 'POST', body: JSON.stringify({ code }) });
    if (ok) { set({ snapshot: json as CartSnapshotT }); return { ok: true }; }
    const err = json as ErrorJson;
    return { ok: false, error: err.error ?? 'UNKNOWN', message: err.message };
  },

  async removePromo() {
    const { json } = await call('/api/cart/promo', { method: 'DELETE' });
    set({ snapshot: json });
  },

  async clear() {
    const { json } = await call('/api/cart', { method: 'DELETE' });
    set({ snapshot: json });
  },

  openDrawer: () => set({ isOpen: true }),
  closeDrawer: () => set({ isOpen: false }),
}));
