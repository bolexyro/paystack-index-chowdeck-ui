import type {
  MenuCategory,
  MenuItem,
  Restaurant,
  UnknownRecord,
  VendorMenu
} from "./types.js";

const record = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const id = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const bool = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

export function normalizeRestaurants(payload: unknown): Restaurant[] {
  const root = record(payload);
  // Index's `results` array is the stable, assistant-facing shape. Keep
  // `raw_results` only as a compatibility fallback.
  const source = list(root.results).length
    ? list(root.results)
    : list(root.raw_results).length
      ? list(root.raw_results)
      : list(root.vendors_matched);

  const seenVendorIds = new Set<string>();
  return source.map((entry) => {
    const item = record(entry);
    const minEta =
      number(item.min_delivery_time_minutes) ??
      number(item.minimum_delivery_time);
    const maxEta =
      number(item.max_delivery_time_minutes) ??
      number(item.maximum_delivery_time);
    return {
      vendorId: id(item.vendor_id),
      name: text(item.vendor_name, "Restaurant"),
      imageUrl: text(item.image_url) || text(item.logo_url) || undefined,
      location: text(item.location) || undefined,
      distanceKm: number(item.distance_km),
      rating: number(item.rating),
      ratingCount: number(item.rating_count),
      etaMinutes:
        number(item.eta_minutes) ??
        (minEta !== undefined && maxEta !== undefined
          ? Math.round((minEta + maxEta) / 2)
          : minEta),
      deliveryFeeNaira:
        number(item.delivery_fee_naira) ?? number(item.delivery_price_naira),
      isOpen:
        bool(item.is_open) && !bool(item.is_temporarily_unavailable, false),
      nextOpening: text(item.next_opening) || undefined
    };
  }).filter((restaurant) => {
    // Index can return repeated vendor rows when a search term matches more
    // than one menu item. A restaurant picker should show each vendor once.
    if (!restaurant.vendorId || seenVendorIds.has(restaurant.vendorId)) return false;
    seenVendorIds.add(restaurant.vendorId);
    return true;
  });
}

function normalizeMenuItem(value: unknown): MenuItem {
  const item = record(value);
  return {
    itemId: id(item.item_id),
    name: text(item.item_name, "Menu item"),
    description: text(item.description) || undefined,
    imageUrl: text(item.image_url) || undefined,
    priceNaira: number(item.price_naira) ?? 0,
    available:
      bool(item.available, true) && bool(item.in_stock, true),
    requiresOptions: bool(item.requires_options),
    optionGroupIds: list(item.option_group_ids)
      .map((value) => id(value))
      .filter(Boolean)
  };
}

export function normalizeMenu(payload: unknown): VendorMenu {
  const root = record(payload);
  const categories: MenuCategory[] = list(root.categories).map((value) => {
    const category = record(value);
    return {
      menuId: id(category.menu_id),
      name: text(category.name, "Menu"),
      items: list(category.items).map(normalizeMenuItem)
    };
  });

  return {
    vendorId: id(root.vendor_id),
    vendorName: text(root.vendor_name, "Restaurant"),
    isOpen: bool(root.is_open, true),
    categories
  };
}

export function unwrapToolPayload(result: unknown): UnknownRecord {
  const root = record(result);
  if (root.structuredContent) return record(root.structuredContent);
  if (root.structured_content) return record(root.structured_content);
  return root;
}
