import type { AstroAssetSlot, AstroCategory } from "@shared/astroConfig";

export const CATEGORY_ASSET_SLOT: Record<AstroCategory, AstroAssetSlot> = {
  "hot-tubs": "categoryHotTubs",
  "swim-spas": "categorySwimSpas",
  saunas: "categorySaunas",
  "cold-plunge": "categoryColdPlunge",
  "massage-chairs": "categoryMassageChairs",
};

export const CATEGORY_LABELS: Record<AstroCategory, string> = {
  "hot-tubs": "Hot Tubs",
  "swim-spas": "Swim Spas",
  saunas: "Saunas",
  "cold-plunge": "Cold Plunge",
  "massage-chairs": "Massage Chairs",
};
