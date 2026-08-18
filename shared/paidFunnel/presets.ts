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

export const PAID_ADS_SECTION_PRESET_LABELS: Record<
  PaidFunnelSectionPreset,
  string
> = {
  blank: "Blank section",
  "full-width": "Full width",
  boxed: "Boxed",
  hero: "Paid ads hero",
  "image-choice-hero": "Image + choices hero",
  "numbered-steps": "Numbered step cards",
  "two-column": "Two column",
  "three-column": "Three column",
  form: "Lead form",
  testimonial: "Testimonial",
  faq: "FAQ",
  cta: "Offer CTA",
  pricing: "Pricing",
  footer: "Footer",
};

function heading(
  nextId: () => string,
  text: string,
  tag: "h1" | "h2" | "h3" = "h2"
) {
  return createElement(
    nextId,
    "heading",
    { text, tag },
    {
      fontSize: {
        desktop: tag === "h1" ? 56 : 32,
        tablet: tag === "h1" ? 42 : 28,
        mobile: tag === "h1" ? 34 : 24,
      },
      fontWeight: 800,
      textAlign: { desktop: tag === "h1" ? "center" : "left" },
    }
  );
}

function body(nextId: () => string, text: string) {
  return createElement(
    nextId,
    "text",
    { text },
    {
      color: "#64748b",
      fontSize: { desktop: 18, mobile: 16 },
    }
  );
}

function button(
  nextId: () => string,
  label: string,
  action: Record<string, unknown> = { type: "nextStep" }
) {
  return createElement(
    nextId,
    "button",
    { label, action },
    {
      fontWeight: 800,
      textAlign: { desktop: "center" },
    }
  );
}

export function createSectionPreset(
  preset: PaidFunnelSectionPreset,
  nextId = createIdFactory("preset")
): FunnelSection {
  if (preset === "blank") {
    return createSection(nextId, {
      preset,
      rows: [createRow(nextId, [createColumn(nextId)])],
    });
  }
  if (preset === "full-width") {
    return createSection(nextId, {
      preset,
      layout: "full",
      maxWidth: 1440,
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            heading(nextId, "Full-width band"),
            body(nextId, "Use this for banners and wide proof."),
          ]),
        ]),
      ],
    });
  }
  if (preset === "boxed") {
    return createSection(nextId, {
      preset,
      layout: "boxed",
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            heading(nextId, "Boxed content"),
            body(nextId, "Keeps paid-ad copy inside the container width."),
          ]),
        ]),
      ],
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
      padding: {
        desktop: { top: 88, right: 32, bottom: 88, left: 32 },
        mobile: { top: 56, right: 16, bottom: 56, left: 16 },
      },
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            heading(
              nextId,
              "Get a personalized recommendation in minutes",
              "h1"
            ),
            body(
              nextId,
              "Answer a few quick questions and get the right next step for your needs."
            ),
            button(nextId, "Get started"),
          ]),
        ]),
      ],
    });
  }
  if (preset === "image-choice-hero") {
    return createSection(nextId, {
      preset,
      layout: "boxed",
      maxWidth: 720,
      minHeight: 720,
      alignment: "center",
      background: { kind: "color", color: "#1c2228" },
      padding: {
        desktop: { top: 36, right: 28, bottom: 56, left: 28 },
        mobile: { top: 28, right: 16, bottom: 44, left: 16 },
      },
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            createElement(
              nextId,
              "heading",
              { text: "An Easier Way to Get What You Need", tag: "h1" },
              {
                color: "#f8fafc",
                fontSize: { desktop: 48, tablet: 42, mobile: 34 },
                fontWeight: 800,
                lineHeight: 1.08,
                textAlign: { desktop: "center", mobile: "center" },
              }
            ),
            createElement(
              nextId,
              "text",
              { text: "No appointments. No obligation. Free to apply." },
              {
                color: "#e5e7eb",
                fontSize: { desktop: 19, mobile: 17 },
                textAlign: { desktop: "center", mobile: "center" },
              }
            ),
            createElement(
              nextId,
              "image",
              { src: "", alt: "Featured offer", filename: "" },
              {
                width: { desktop: 100, tablet: 100, mobile: 100 },
                maxWidth: { desktop: 640, tablet: 640, mobile: 560 },
                margin: { desktop: { top: 28, right: 0, bottom: 28, left: 0 } },
              }
            ),
            createElement(
              nextId,
              "multipleChoice",
              {
                field: "offerChoice",
                question: "Which option fits you best?",
                options: ["Option one", "Option two"],
                autoAdvance: true,
                columns: 2,
                gap: 18,
                buttonBackground: "#2ba4ee",
                buttonColor: "#ffffff",
                buttonRadius: 4,
              },
              {
                maxWidth: { desktop: 640, tablet: 640, mobile: 560 },
                color: "#f8fafc",
                textAlign: { desktop: "center", mobile: "center" },
              }
            ),
          ]),
        ]),
      ],
    });
  }
  if (preset === "numbered-steps") {
    const cards = [
      ["1 · Get Started", "Explain the first action customers should take."],
      [
        "2 · Shop With Confidence",
        "Explain how your process makes the decision easier.",
      ],
      [
        "3 · Choose Your Best Option",
        "Explain the final step and expected outcome.",
      ],
    ].map(([title, copy]) =>
      createColumn(
        nextId,
        [
          createElement(
            nextId,
            "heading",
            { text: title, tag: "h3" },
            {
              background: { kind: "color", color: "#2ba4ee" },
              color: "#ffffff",
              fontSize: { desktop: 24, tablet: 22, mobile: 22 },
              fontWeight: 800,
              padding: {
                desktop: { top: 30, right: 22, bottom: 30, left: 22 },
              },
              borderRadius: 14,
            }
          ),
          createElement(
            nextId,
            "text",
            { text: copy },
            {
              color: "#e5e7eb",
              fontSize: { desktop: 17, mobile: 16 },
              padding: {
                desktop: { top: 18, right: 20, bottom: 22, left: 20 },
              },
            }
          ),
        ],
        3
      )
    );
    for (const card of cards) {
      card.background = { kind: "color", color: "#252d33" };
      card.borderRadius = 16;
      card.padding = { desktop: { top: 0, right: 0, bottom: 4, left: 0 } };
    }
    return createSection(nextId, {
      preset,
      background: { kind: "color", color: "#1c2228" },
      padding: {
        desktop: { top: 72, right: 24, bottom: 72, left: 24 },
        mobile: { top: 48, right: 14, bottom: 48, left: 14 },
      },
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            createElement(
              nextId,
              "heading",
              { text: "The Smart Way Forward", tag: "h2" },
              {
                color: "#f8fafc",
                fontSize: { desktop: 34, mobile: 28 },
                textAlign: { desktop: "center", mobile: "center" },
              }
            ),
            createElement(
              nextId,
              "text",
              {
                text: "Describe the process, then customize each step card below.",
              },
              {
                color: "#e5e7eb",
                fontSize: { desktop: 18, mobile: 16 },
                textAlign: { desktop: "center", mobile: "center" },
                margin: { desktop: { top: 0, right: 0, bottom: 30, left: 0 } },
              }
            ),
          ]),
        ]),
        createRow(nextId, cards),
      ],
    });
  }
  if (preset === "two-column") {
    return createSection(nextId, {
      preset,
      rows: [
        createRow(nextId, [
          createColumn(
            nextId,
            [
              heading(nextId, "Why customers choose you"),
              body(
                nextId,
                "Explain the offer, the outcome, and what makes the process easy."
              ),
            ],
            2
          ),
          createColumn(
            nextId,
            [
              createElement(nextId, "image", {
                src: "",
                alt: "Customer success",
                filename: "",
              }),
            ],
            2
          ),
        ]),
      ],
    });
  }
  if (preset === "three-column") {
    const cards = ["Clear process", "Fast response", "Flexible options"].map(
      title =>
        createColumn(
          nextId,
          [
            heading(nextId, title, "h3"),
            body(
              nextId,
              "Replace this with a specific benefit for the campaign."
            ),
          ],
          3
        )
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
            heading(nextId, "Get your personalized next step"),
            body(
              nextId,
              "Share your contact details and we will follow up with the right recommendation."
            ),
            createElement(nextId, "form", {
              formId: "lead-form",
              fields: [
                "zip",
                "firstName",
                "lastName",
                "email",
                "phone",
                "consent",
              ],
              submitLabel: "Get my recommendation",
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
              quote:
                "The process was simple, fast, and exactly what we needed.",
              author: "Chris M.",
              role: "Customer",
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
                {
                  question: "What happens after I submit?",
                  answer:
                    "A specialist reviews your request and follows up with the best next step.",
                },
                {
                  question: "Do you keep the click IDs?",
                  answer:
                    "UTM and click IDs are preserved through the form step.",
                },
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
            heading(nextId, "Ready to take the next step?"),
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
          createColumn(
            nextId,
            [
              heading(nextId, "Starter", "h3"),
              body(nextId, "A simple entry option"),
              button(nextId, "Choose Starter"),
            ],
            3
          ),
          createColumn(
            nextId,
            [
              heading(nextId, "Popular", "h3"),
              body(nextId, "The most common customer choice"),
              button(nextId, "Choose Popular"),
            ],
            3
          ),
          createColumn(
            nextId,
            [
              heading(nextId, "Premium", "h3"),
              body(nextId, "The complete service option"),
              button(nextId, "Choose Premium"),
            ],
            3
          ),
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
          body(
            nextId,
            "By submitting you agree to be contacted about this offer."
          ),
          createElement(nextId, "phoneCta", {
            label: "Call now",
            tel: "",
            action: { type: "phone", tel: "" },
          }),
        ]),
      ]),
    ],
  });
}

export function paidAdPalette() {
  return {
    sections: (
      Object.keys(PAID_ADS_SECTION_PRESET_LABELS) as PaidFunnelSectionPreset[]
    ).map(preset => ({
      id: preset,
      label: PAID_ADS_SECTION_PRESET_LABELS[preset],
      source: "section" as const,
      preset,
    })),
    rows: [
      {
        id: "row-1",
        label: "1 column",
        source: "row" as const,
        columns: 1 as const,
      },
      {
        id: "row-2",
        label: "2 columns",
        source: "row" as const,
        columns: 2 as const,
      },
      {
        id: "row-3",
        label: "3 columns",
        source: "row" as const,
        columns: 3 as const,
      },
    ],
    elements: [
      "heading",
      "text",
      "image",
      "button",
      "icon",
      "video",
      "spacer",
      "divider",
      "list",
      "form",
      "multipleChoice",
      "shortAnswer",
      "phoneCta",
      "countdown",
      "testimonial",
      "faq",
      "inventory",
      "map",
      "html",
    ].map(type => ({
      id: type,
      label: type,
      source: "element" as const,
      type: type as never,
    })),
  };
}
