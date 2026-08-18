import {
  BUSINESS_DAY_VALUES,
  type AssetSlot,
  type ClientInput,
  type SecretField,
  type ThemeValue,
} from "@shared/client";

export type FormDetails = Omit<ClientInput, "foundedYear" | "theme"> & {
  foundedYear: string;
  theme: ThemeValue | "";
};

export type FieldErrors = Record<string, string>;

export const PHOTO_GUIDANCE: Record<AssetSlot, string> = {
  logo: "Use a clear logo on a simple background.",
  hero: "Choose the strongest wide showroom or product photo.",
  hotTubs: "Choose a photo that clearly shows hot tubs.",
  swimSpas: "Choose a photo that clearly shows swim spas.",
  showroom: "Choose a wide photo of the showroom.",
  product: "Choose a clean close-up product photo.",
  delivery: "Choose a delivery or installation photo.",
};

const defaultHours = BUSINESS_DAY_VALUES.map((day, index) => ({
  day,
  isOpen: index < 5,
  opensAt: "09:00",
  closesAt: "17:00",
}));

export const EMPTY_DETAILS: FormDetails = {
  businessName: "",
  shortName: "",
  phone: "",
  email: "",
  streetAddress: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  websiteUrl: "",
  foundedYear: "",
  tagline: "",
  theme: "",
  businessHours: defaultHours,
  facebookUrl: "",
  googleMapsUrl: "",
  productCategories: [],
  primaryOffer: "",
  financingPromise: "",
  deliveryPromise: "",
};

export const EMPTY_SETUP: Record<SecretField, string> = {
  metaPixelId: "",
  ga4MeasurementId: "",
  clarityId: "",
  ghlApiKey: "",
  ghlWebhookUrl: "",
  cloudflareProjectName: "",
};
