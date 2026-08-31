import {
  parseServiceAreaZips,
  type SimpleFormStoredRecord,
} from "@shared/simpleFormConfig";

/** The ZIP textarea is free text, so the saved shape is what dirty compares. */
export function campaignPendingRecord(
  record: SimpleFormStoredRecord,
  zipText: string,
): SimpleFormStoredRecord {
  return {
    ...record,
    config: {
      ...record.config,
      serviceAreaZipCodes: parseServiceAreaZips(zipText),
    },
  };
}

/**
 * Consent wording and the version stored beside every lead have to move
 * together. Operators used to maintain the version by hand next to the text,
 * which is a compliance detail nobody should have to remember, so a reworded
 * consent restamps itself with the day it changed.
 */
export function stampConsentVersion(
  next: SimpleFormStoredRecord,
  baseline: SimpleFormStoredRecord,
  today: Date = new Date(),
): SimpleFormStoredRecord {
  const text = next.config.contact.consent.text.trim();
  if (text === baseline.config.contact.consent.text.trim()) return next;
  return {
    ...next,
    config: {
      ...next.config,
      contact: {
        ...next.config.contact,
        consent: {
          ...next.config.contact.consent,
          version: today.toISOString().slice(0, 10),
        },
      },
    },
  };
}
