import type { BusinessDay, ProductCategory, ThemeValue } from "@shared/client";

export const DAY_LABELS: Record<BusinessDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: "hotTubs", label: "Hot Tubs" },
  { value: "swimSpas", label: "Swim Spas" },
  { value: "saunas", label: "Saunas" },
  { value: "coldPlunge", label: "Cold Plunge" },
  { value: "massageChairs", label: "Massage Chairs" },
];

export const THEME_OPTIONS: {
  value: ThemeValue;
  label: string;
  description: string;
  swatches: string[];
}[] = [
  {
    value: "aqua",
    label: "Aqua",
    description: "Fresh, bright, and water focused",
    swatches: ["#0e7490", "#22d3ee", "#ecfeff"],
  },
  {
    value: "luxury",
    label: "Luxury",
    description: "Dark, polished, and premium",
    swatches: ["#171717", "#d4af37", "#faf7ef"],
  },
  {
    value: "natural",
    label: "Natural",
    description: "Warm, calm, and grounded",
    swatches: ["#365314", "#a3b18a", "#f5f2e8"],
  },
  {
    value: "mono",
    label: "Mono",
    description: "Neutral, crisp, and editorial",
    swatches: ["#0a0a0a", "#737373", "#fafafa"],
  },
];
