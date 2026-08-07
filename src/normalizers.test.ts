import { describe, expect, it } from "vitest";
import { normalizeMenu, normalizeRestaurants } from "./normalizers.js";

describe("normalizers", () => {
  it("normalizes the richer Chowdeck restaurant payload", () => {
    expect(
      normalizeRestaurants({
        raw_results: [
          {
            vendor_id: "v1",
            vendor_name: "Mama T",
            logo_url: "https://files.chowdeck.com/mama.png",
            min_delivery_time_minutes: 20,
            max_delivery_time_minutes: 30,
            delivery_price_naira: 900,
            is_open: true,
            is_temporarily_unavailable: false
          }
        ]
      })
    ).toEqual([
      expect.objectContaining({
        vendorId: "v1",
        name: "Mama T",
        etaMinutes: 25,
        deliveryFeeNaira: 900,
        isOpen: true
      })
    ]);
  });

  it("combines availability flags for menu items", () => {
    const menu = normalizeMenu({
      vendor_id: "v1",
      vendor_name: "Mama T",
      categories: [
        {
          menu_id: "rice",
          name: "Rice",
          items: [
            {
              item_id: "j1",
              item_name: "Jollof",
              price_naira: 3500,
              available: true,
              in_stock: false
            }
          ]
        }
      ]
    });
    expect(menu.categories[0].items[0].available).toBe(false);
  });

  it("keeps matched closed vendors visible when Index has no open item results", () => {
    expect(
      normalizeRestaurants({
        results: [],
        vendors_matched: [
          {
            vendor_id: 106110,
            vendor_name: "Dodo Pizza - Alausa",
            logo_url: "https://files.chowdeck.com/dodo.png",
            distance_km: 1.29,
            rating: 4.16,
            minimum_delivery_time: 22,
            maximum_delivery_time: 32,
            delivery_price_naira: 650,
            is_open: false,
            is_temporarily_unavailable: true
          }
        ],
        all_closed: true
      })
    ).toEqual([
      expect.objectContaining({
        vendorId: "106110",
        name: "Dodo Pizza - Alausa",
        isOpen: false,
        etaMinutes: 27,
        deliveryFeeNaira: 650
      })
    ]);
  });
});
