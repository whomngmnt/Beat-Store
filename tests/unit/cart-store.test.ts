import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CART_ITEMS } from "../../src/lib/validators";
import { useCartStore } from "../../src/store/cart";

// zustand's persist looks for `window.localStorage` when the store is
// created, and Node has neither. Vitest runs vi.hoisted before the imports
// above, so the store finds this in-memory stand-in.
const saved = vi.hoisted(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    },
  });
  return data;
});

const KEY = "beat-store-cart";
const beatA = crypto.randomUUID();
const beatB = crypto.randomUUID();
const basic = crypto.randomUUID();
const premium = crypto.randomUUID();

const cart = () => useCartStore.getState();

// What persist writes: { state, version }.
function save(state: unknown) {
  saved.set(KEY, JSON.stringify({ state, version: 0 }));
}

beforeEach(() => {
  useCartStore.setState(useCartStore.getInitialState(), true);
  saved.clear();
});

describe("cart store", () => {
  it("adds a beat with its license tier", () => {
    expect(cart().add({ beatId: beatA, licenseTierId: basic })).toBe(true);
    expect(cart().items).toEqual([{ beatId: beatA, licenseTierId: basic }]);
  });

  it("keeps one tier per beat: adding the same beat swaps its tier", () => {
    cart().add({ beatId: beatA, licenseTierId: basic });
    cart().add({ beatId: beatB, licenseTierId: basic });
    cart().add({ beatId: beatA, licenseTierId: premium });
    expect(cart().items).toEqual([
      { beatId: beatA, licenseTierId: premium },
      { beatId: beatB, licenseTierId: basic },
    ]);
  });

  it("refuses a new beat when the cart is full, but still swaps a tier", () => {
    const beats = Array.from({ length: MAX_CART_ITEMS }, () =>
      crypto.randomUUID(),
    );
    for (const beatId of beats) cart().add({ beatId, licenseTierId: basic });

    expect(cart().add({ beatId: beatA, licenseTierId: basic })).toBe(false);
    expect(cart().items).toHaveLength(MAX_CART_ITEMS);

    expect(cart().add({ beatId: beats[0], licenseTierId: premium })).toBe(true);
    expect(cart().items[0]).toEqual({
      beatId: beats[0],
      licenseTierId: premium,
    });
  });

  it("removes one beat, and clears the cart", () => {
    cart().add({ beatId: beatA, licenseTierId: basic });
    cart().add({ beatId: beatB, licenseTierId: basic });

    cart().remove(beatA);
    expect(cart().items).toEqual([{ beatId: beatB, licenseTierId: basic }]);

    cart().clear();
    expect(cart().items).toEqual([]);
  });

  it("saves only the items, not whether the drawer is open", () => {
    cart().add({ beatId: beatA, licenseTierId: basic });
    cart().setOpen(true);

    expect(cart().isOpen).toBe(true);
    expect(JSON.parse(saved.get(KEY)!)).toEqual({
      state: { items: [{ beatId: beatA, licenseTierId: basic }] },
      version: 0,
    });
  });

  it("loads a saved cart", async () => {
    save({ items: [{ beatId: beatA, licenseTierId: basic }] });
    await useCartStore.persist.rehydrate();
    expect(cart().items).toEqual([{ beatId: beatA, licenseTierId: basic }]);
  });

  it("drops a price someone added to the saved cart", async () => {
    save({ items: [{ beatId: beatA, licenseTierId: basic, priceCents: 1 }] });
    await useCartStore.persist.rehydrate();
    expect(cart().items).toEqual([{ beatId: beatA, licenseTierId: basic }]);
  });

  it.each([
    ["not JSON", "{"],
    ["not a list", JSON.stringify({ state: { items: "all" }, version: 0 })],
    [
      "a bad id",
      JSON.stringify({
        state: { items: [{ beatId: "midnight-drive", licenseTierId: basic }] },
        version: 0,
      }),
    ],
    [
      "the same beat twice",
      JSON.stringify({
        state: {
          items: [
            { beatId: beatA, licenseTierId: basic },
            { beatId: beatA, licenseTierId: premium },
          ],
        },
        version: 0,
      }),
    ],
    ["empty", JSON.stringify({ state: null, version: 0 })],
  ])("starts empty when the saved cart is %s", async (_label, value) => {
    saved.set(KEY, value);
    await useCartStore.persist.rehydrate();
    expect(cart().items).toEqual([]);
  });
});
