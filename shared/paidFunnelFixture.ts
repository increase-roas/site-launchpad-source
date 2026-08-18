import genericPaidFunnelJson from "../server/templates/generic-paid-funnel/launchpad.template.json";
import {
  GENERIC_PAID_FUNNEL_TEMPLATE_KEY,
  parsePaidFunnelPackage,
  type PaidFunnelPackage,
} from "./paidFunnelContract";
import { SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT } from "./simpleFormContract";

export const GENERIC_PAID_FUNNEL_PACKAGE: PaidFunnelPackage =
  parsePaidFunnelPackage(genericPaidFunnelJson);

export function genericPaidFunnelName(businessName: string): string {
  const trimmed = businessName.trim() || "Paid Ads";
  return `${trimmed} Paid Funnel`;
}

export function genericPaidFunnelSlug(
  shortName: string,
  used: string[]
): string {
  const base = `${
    shortName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "client"
  }-paid-funnel`;
  if (!used.includes(base)) return base;
  let index = 2;
  while (used.includes(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

export function assertGenericFixtureContract(): void {
  if (
    GENERIC_PAID_FUNNEL_PACKAGE.templateKey !== GENERIC_PAID_FUNNEL_TEMPLATE_KEY
  ) {
    throw new Error("Generic paid funnel fixture key drifted.");
  }
  if (
    GENERIC_PAID_FUNNEL_PACKAGE.offlineConversionContract?.joinKey !==
    SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.joinKey
  ) {
    throw new Error("Fixture offline conversion joinKey drifted.");
  }
}
