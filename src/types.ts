export type UnknownRecord = Record<string, unknown>;

export interface Restaurant {
  vendorId: string;
  name: string;
  imageUrl?: string;
  location?: string;
  distanceKm?: number;
  rating?: number;
  ratingCount?: number;
  etaMinutes?: number;
  deliveryFeeNaira?: number;
  isOpen: boolean;
  nextOpening?: string;
}

export interface MenuItem {
  itemId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  priceNaira: number;
  available: boolean;
  requiresOptions: boolean;
  optionGroupIds: string[];
}

export interface MenuCategory {
  menuId: string;
  name: string;
  items: MenuItem[];
}

export interface VendorMenu {
  vendorId: string;
  vendorName: string;
  isOpen: boolean;
  categories: MenuCategory[];
}

export interface PreviewRecord {
  upstreamArgs: UnknownRecord;
  upstreamResult: UnknownRecord;
  expiresAt: number;
}

