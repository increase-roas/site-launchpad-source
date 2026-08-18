import {
  type FunnelSection,
  type PaidFunnelGraph,
  type PaidFunnelSectionPreset,
  type PaidFunnelStep,
  CANONICAL_OFFLINE_CONVERSION_CONTRACT,
  createColumn,
  createElement,
  createEmptyPage,
  createIdFactory,
  createRow,
  createSection,
  defaultGlobalStyles,
  PAID_FUNNEL_GRAPH_SCHEMA_VERSION,
  PAID_FUNNEL_KIND,
} from "./graph";

export const PAID_ADS_SECTION_PRESET_LABELS: Record<PaidFunnelSectionPreset, string> = {
  blank: "Blank section",
  "full-width": "Full width",
  boxed: "Boxed",
  hero: "Paid ads hero",
  "two-column": "Two column",
  "three-column": "Three column",
  form: "Lead form",
  testimonial: "Testimonial",
  faq: "FAQ",
  cta: "Offer CTA",
  pricing: "Pricing",
  footer: "Footer",
};

function heading(nextId: () => string, text: string, tag: "h1" | "h2" | "h3" = "h2") {
  return createElement(nextId, "heading", { text, tag }, {
    fontSize: { desktop: tag === "h1" ? 56 : 32, tablet: tag === "h1" ? 42 : 28, mobile: tag === "h1" ? 34 : 24 },
    fontWeight: 800,
    textAlign: { desktop: tag === "h1" ? "center" : "left" },
  });
}

function body(nextId: () => string, text: string) {
  return createElement(nextId, "text", { text }, {
    color: "#64748b",
    fontSize: { desktop: 18, mobile: 16 },
  });
}

function button(nextId: () => string, label: string, action: Record<string, unknown> = { type: "nextStep" }) {
  return createElement(nextId, "button", { label, action }, {
    fontWeight: 800,
    textAlign: { desktop: "center" },
  });
}

export function createSectionPreset(preset: PaidFunnelSectionPreset, nextId = createIdFactory("preset")): FunnelSection {
  if (preset === "blank") {
    return createSection(nextId, { preset, rows: [createRow(nextId, [createColumn(nextId)])] });
  }
  if (preset === "full-width") {
    return createSection(nextId, {
      preset,
      layout: "full",
      maxWidth: 1440,
      rows: [createRow(nextId, [createColumn(nextId, [heading(nextId, "Full-width band"), body(nextId, "Use this for banners and wide proof.")])])],
    });
  }
  if (preset === "boxed") {
    return createSection(nextId, {
      preset,
      layout: "boxed",
      rows: [createRow(nextId, [createColumn(nextId, [heading(nextId, "Boxed content"), body(nextId, "Keeps paid-ad copy inside the container width.")])])],
    });
  }
  if (preset === "hero") {
    return createSection(nextId, {
      preset,
      layout: "full",
      minHeight: 560,
      alignment: "center",
      background: { kind: "color", color: "#eef5ff" },
      overlay: null,
      padding: { desktop: { top: 88, right: 32, bottom: 88, left: 32 }, mobile: { top: 56, right: 16, bottom: 56, left: 16 } },
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            heading(nextId, "This weekend only: in-stock hot tubs", "h1"),
            body(nextId, "See live inventory, lock the advertised price, and book a showroom visit."),
            button(nextId, "Check availability"),
          ]),
        ]),
      ],
    });
  }
  if (preset === "two-column") {
    return createSection(nextId, {
      preset,
      rows: [
        createRow(nextId, [
          createColumn(nextId, [heading(nextId, "Why buyers click"), body(nextId, "Lead with the offer, delivery promise, and financing.")], 2),
          createColumn(nextId, [createElement(nextId, "image", { src: "", alt: "Showroom", filename: "" })], 2),
        ]),
      ],
    });
  }
  if (preset === "three-column") {
    const cards = ["Free delivery", "Same-week set", "Financing"].map(title =>
      createColumn(nextId, [heading(nextId, title, "h3"), body(nextId, "Keep this benefit specific to the ad account.")], 3),
    );
    return createSection(nextId, { preset, rows: [createRow(nextId, cards)] });
  }
  if (preset === "form") {
    return createSection(nextId, {
      preset,
      anchor: "lead-form",
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            heading(nextId, "Get today's price"),
            body(nextId, "ZIP + contact maps to the existing lead and offline-conversion contract."),
            createElement(nextId, "form", {
              formId: "lead-form",
              fields: ["zip", "firstName", "lastName", "email", "phone"],
              submitLabel: "See my price",
            }),
          ]),
        ]),
      ],
    });
  }
  if (preset === "testimonial") {
    return createSection(nextId, {
      preset,
      background: { kind: "color", color: "#0b1c2b" },
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            createElement(nextId, "testimonial", {
              quote: "We went from the ad to a delivered spa in 11 days.",
              author: "Chris M.",
              role: "Homeowner",
            }),
          ]),
        ]),
      ],
    });
  }
  if (preset === "faq") {
    return createSection(nextId, {
      preset,
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            heading(nextId, "Before you book"),
            createElement(nextId, "faq", {
              items: [
                { question: "Is the ad price real?", answer: "Yes. The landing page only shows current inventory." },
                { question: "Do you keep the click IDs?", answer: "UTM and click IDs are preserved through the form step." },
              ],
            }),
          ]),
        ]),
      ],
    });
  }
  if (preset === "cta") {
    return createSection(nextId, {
      preset,
      alignment: "center",
      background: { kind: "color", color: "#164e63" },
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            heading(nextId, "Ready to lock this weekend's price?"),
            button(nextId, "Continue to the form"),
          ]),
        ]),
      ],
    });
  }
  if (preset === "pricing") {
    return createSection(nextId, {
      preset,
      rows: [
        createRow(nextId, [
          createColumn(nextId, [heading(nextId, "Good", "h3"), body(nextId, "In-stock 5-person"), button(nextId, "Choose Good")], 3),
          createColumn(nextId, [heading(nextId, "Better", "h3"), body(nextId, "Lounge + jets"), button(nextId, "Choose Better")], 3),
          createColumn(nextId, [heading(nextId, "Best", "h3"), body(nextId, "Party tub + cover"), button(nextId, "Choose Best")], 3),
        ]),
      ],
    });
  }
  return createSection(nextId, {
    preset: "footer",
    minHeight: 0,
    padding: { desktop: { top: 28, right: 24, bottom: 28, left: 24 } },
    background: { kind: "color", color: "#f8fafc" },
    rows: [
      createRow(nextId, [
        createColumn(nextId, [
          body(nextId, "By submitting you agree to be contacted about this offer."),
          createElement(nextId, "phoneCta", { label: "Call the showroom", tel: "", action: { type: "phone", tel: "" } }),
        ]),
      ]),
    ],
  });
}

export function paidAdPalette() {
  return {
    sections: (Object.keys(PAID_ADS_SECTION_PRESET_LABELS) as PaidFunnelSectionPreset[]).map(preset => ({
      id: preset,
      label: PAID_ADS_SECTION_PRESET_LABELS[preset],
      source: "section" as const,
      preset,
    })),
    rows: [
      { id: "row-1", label: "1 column", source: "row" as const, columns: 1 as const },
      { id: "row-2", label: "2 columns", source: "row" as const, columns: 2 as const },
      { id: "row-3", label: "3 columns", source: "row" as const, columns: 3 as const },
    ],
    elements: [
      "heading", "text", "image", "button", "icon", "video", "spacer", "divider", "list",
      "form", "multipleChoice", "shortAnswer", "phoneCta", "countdown", "testimonial", "faq", "inventory", "map", "html",
    ].map(type => ({ id: type, label: type, source: "element" as const, type: type as never })),
  };
}
