import type { AstroHomepageSection, AstroSectionType } from "@shared/astroConfig";
import type { LineColumn } from "./lineRecords";

export type ListSpec =
  | { kind: "lines"; addLabel: string; placeholder?: string }
  | { kind: "records"; addLabel: string; layout: "table" | "cards"; columns: LineColumn[] }
  | { kind: "joined"; keys: string[]; labels: string[] };

export type SectionField = {
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  control?: "text" | "textarea" | "url" | "number" | "gallery";
  span?: 2 | 3;
  list?: ListSpec;
};

export type SectionFieldGroup = {
  id: string;
  label: string;
  description?: string;
  fields: SectionField[];
};

const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

const CARD_COLUMNS: LineColumn[] = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description", wide: true },
  { key: "href", label: "Link", placeholder: "/page" },
  { key: "image", label: "Image URL", placeholder: "https://" },
];

const TITLE_BODY: LineColumn[] = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description", wide: true },
];

export const SECTION_FIELD_GROUPS: Record<AstroSectionType, SectionFieldGroup[]> = {
  announcement: [
    {
      id: "details",
      label: "Announcement",
      fields: [
        { key: "badge", label: "Badge" },
        { key: "text", label: "Text", required: true, span: 2 },
        { key: "href", label: "Link", control: "url", placeholder: "/page" },
      ],
    },
  ],
  hero: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "headline", label: "Headline", required: true, span: 2 },
        {
          key: "highlight",
          label: "Highlight words",
          hint: "Comma-separated words from the headline to color.",
        },
        { key: "subheadline", label: "Subheadline", required: true, control: "textarea", span: 3 },
        { key: "promo", label: "Promo line", span: 3 },
        {
          key: "bullets",
          label: "Claims",
          span: 3,
          list: { kind: "lines", addLabel: "Add claim", placeholder: "Free delivery and setup" },
        },
      ],
    },
    {
      id: "actions",
      label: "Buttons",
      fields: [
        { key: "ctaLabel", label: "Primary button", required: true },
        { key: "ctaHref", label: "Primary link", required: true, control: "url" },
        { key: "ctaLabel2", label: "Second button" },
        { key: "ctaHref2", label: "Second link", control: "url" },
      ],
    },
    {
      id: "lead",
      label: "Lead card",
      fields: [
        { key: "leadHeading", label: "Heading" },
        { key: "leadSubtext", label: "Subtext", control: "textarea", span: 2 },
        { key: "leadFootnote", label: "Footnote", control: "textarea", span: 3 },
      ],
    },
    {
      id: "media",
      label: "Background",
      fields: [{ key: "backgroundImage", label: "Background image URL", control: "url", span: 3 }],
    },
  ],
  stats: [
    {
      id: "items",
      label: "Stats",
      fields: [
        {
          key: "items",
          label: "Stats",
          required: true,
          span: 3,
          list: {
            kind: "records",
            addLabel: "Add stat",
            layout: "table",
            columns: [
              { key: "value", label: "Value", placeholder: "25+" },
              { key: "label", label: "Label", placeholder: "Years in business" },
            ],
          },
        },
      ],
    },
  ],
  offercard: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", required: true, span: 2 },
        { key: "body", label: "Body", control: "textarea", span: 3 },
        {
          key: "bullets",
          label: "Claims",
          span: 3,
          list: { kind: "lines", addLabel: "Add claim" },
        },
      ],
    },
    {
      id: "actions",
      label: "Buttons",
      fields: [
        { key: "ctaLabel", label: "Primary button" },
        { key: "ctaHref", label: "Primary link", control: "url" },
        { key: "ctaLabel2", label: "Second button" },
        { key: "ctaHref2", label: "Second link", control: "url" },
      ],
    },
  ],
  products: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", required: true, span: 2 },
        { key: "body", label: "Body", control: "textarea", span: 3 },
      ],
    },
    {
      id: "listing",
      label: "Listing",
      fields: [
        { key: "limit", label: "How many to show", control: "number" },
        {
          key: "category",
          label: "Category filter",
          hint: "Leave blank for every enabled category.",
        },
        { key: "moreLabel", label: "More link label" },
        { key: "moreHref", label: "More link", control: "url" },
        { key: "disclaimer", label: "Disclaimer", control: "textarea", span: 3 },
      ],
    },
  ],
  categoryrow: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", required: true, span: 2 },
        { key: "body", label: "Body", control: "textarea", span: 3 },
      ],
    },
  ],
  cards: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "heading", label: "Heading", required: true },
        { key: "intro", label: "Intro", control: "textarea", span: 2 },
      ],
    },
    {
      id: "items",
      label: "Cards",
      fields: [
        {
          key: "items",
          label: "Cards",
          required: true,
          span: 3,
          list: { kind: "records", addLabel: "Add card", layout: "cards", columns: CARD_COLUMNS },
        },
      ],
    },
  ],
  imagecards: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", required: true, span: 2 },
      ],
    },
    {
      id: "items",
      label: "Cards",
      fields: [
        {
          key: "items",
          label: "Cards",
          required: true,
          span: 3,
          list: { kind: "records", addLabel: "Add card", layout: "cards", columns: CARD_COLUMNS },
        },
      ],
    },
  ],
  benefits: [
    {
      id: "copy",
      label: "Copy",
      fields: [{ key: "heading", label: "Heading", span: 3 }],
    },
    {
      id: "items",
      label: "Benefits",
      fields: [
        {
          key: "items",
          label: "Benefits",
          required: true,
          span: 3,
          list: { kind: "records", addLabel: "Add benefit", layout: "cards", columns: TITLE_BODY },
        },
      ],
    },
  ],
  visit: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "heading", label: "Heading", required: true },
        { key: "body", label: "Showroom copy", required: true, control: "textarea", span: 2 },
      ],
    },
    {
      id: "actions",
      label: "Button",
      fields: [
        { key: "ctaLabel", label: "Button label", required: true },
        { key: "ctaHref", label: "Button link", required: true, control: "url" },
      ],
    },
  ],
  splitcards: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", span: 2 },
      ],
    },
    {
      id: "items",
      label: "Cards",
      fields: [
        {
          key: "items",
          label: "Cards",
          required: true,
          span: 3,
          list: {
            kind: "records",
            addLabel: "Add card",
            layout: "cards",
            columns: [
              { key: "title", label: "Title" },
              { key: "body", label: "Body", wide: true },
              { key: "href", label: "Link", placeholder: "/page" },
              { key: "address", label: "Show address", choices: YES_NO },
              { key: "hours", label: "Show hours", choices: YES_NO },
            ],
          },
        },
      ],
    },
  ],
  steps: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", required: true, span: 2 },
      ],
    },
    {
      id: "steps",
      label: "Steps",
      fields: [
        {
          key: "steps",
          label: "Steps",
          required: true,
          span: 3,
          list: { kind: "records", addLabel: "Add step", layout: "cards", columns: TITLE_BODY },
        },
      ],
    },
  ],
  gallery: [
    {
      id: "copy",
      label: "Gallery",
      fields: [
        { key: "heading", label: "Heading", required: true },
        { key: "images", label: "Photos", required: true, control: "gallery", span: 2 },
      ],
    },
  ],
  reviews: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", required: true, span: 2 },
      ],
    },
    {
      id: "quotes",
      label: "Quotes",
      fields: [
        {
          key: "items",
          label: "Reviews",
          required: true,
          span: 3,
          list: {
            kind: "records",
            addLabel: "Add review",
            layout: "cards",
            columns: [
              { key: "name", label: "Name" },
              { key: "rating", label: "Rating", type: "number", placeholder: "5" },
              { key: "quote", label: "Quote", wide: true },
              { key: "source", label: "Source", placeholder: "Google" },
              { key: "date", label: "Date", placeholder: "2026-03-12" },
            ],
          },
        },
      ],
    },
    {
      id: "aggregate",
      label: "Summary rating",
      fields: [
        {
          key: "aggregate",
          label: "Aggregate",
          span: 3,
          list: {
            kind: "joined",
            keys: ["rating", "count", "source"],
            labels: ["Rating", "Review count", "Source"],
          },
        },
      ],
    },
  ],
  comparison: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", required: true },
        { key: "themLabel", label: "Other column label", placeholder: "Everyone else" },
        { key: "body", label: "Body", control: "textarea", span: 3 },
      ],
    },
    {
      id: "rows",
      label: "Rows",
      fields: [
        {
          key: "rows",
          label: "Rows",
          required: true,
          span: 3,
          list: {
            kind: "records",
            addLabel: "Add row",
            layout: "table",
            columns: [
              { key: "label", label: "Label" },
              { key: "us", label: "Us" },
              { key: "them", label: "Them" },
            ],
          },
        },
      ],
    },
  ],
  promise: [
    {
      id: "badge",
      label: "Badge",
      fields: [
        { key: "badgeValue", label: "Badge value" },
        { key: "badgeLabel", label: "Badge label", span: 2 },
      ],
    },
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "heading", label: "Heading", required: true, span: 3 },
        { key: "body", label: "Body", control: "textarea", span: 3 },
        {
          key: "bullets",
          label: "Promises",
          required: true,
          span: 3,
          list: { kind: "lines", addLabel: "Add promise" },
        },
      ],
    },
  ],
  bignumber: [
    {
      id: "number",
      label: "Number",
      fields: [
        { key: "value", label: "Big number", required: true },
        { key: "label", label: "Number label", required: true },
        { key: "body", label: "Supporting copy", control: "textarea", span: 3 },
      ],
    },
  ],
  faq: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", required: true, span: 2 },
      ],
    },
    {
      id: "items",
      label: "Questions",
      fields: [
        {
          key: "items",
          label: "Questions and answers",
          required: true,
          span: 3,
          list: {
            kind: "records",
            addLabel: "Add question",
            layout: "cards",
            columns: [
              { key: "question", label: "Question", wide: true },
              { key: "answer", label: "Answer", wide: true },
            ],
          },
        },
      ],
    },
  ],
  ctaband: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "headline", label: "Headline", required: true, span: 2 },
        { key: "subheadline", label: "Subheadline", control: "textarea", span: 3 },
        { key: "footnote", label: "Footnote", control: "textarea", span: 3 },
      ],
    },
    {
      id: "actions",
      label: "Buttons",
      fields: [
        { key: "ctaLabel", label: "Primary button", required: true },
        { key: "ctaHref", label: "Primary link", required: true, control: "url" },
        { key: "ctaLabel2", label: "Second button" },
        { key: "ctaHref2", label: "Second link", control: "url" },
      ],
    },
  ],
  cta: [
    {
      id: "copy",
      label: "Lead form",
      fields: [
        { key: "headline", label: "Heading", required: true },
        { key: "ctaLabel", label: "Form button label", required: true },
        { key: "subtext", label: "Subtext", control: "textarea", span: 3 },
      ],
    },
  ],
  trust: [
    {
      id: "items",
      label: "Trust items",
      fields: [
        {
          key: "items",
          label: "Items",
          required: true,
          span: 3,
          list: { kind: "lines", addLabel: "Add item", placeholder: "Family owned since 1998" },
        },
      ],
    },
  ],
  countdown: [
    {
      id: "copy",
      label: "Copy",
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading", required: true, span: 2 },
        { key: "body", label: "Body", control: "textarea", span: 3 },
        {
          key: "endsAt",
          label: "Ends at",
          hint: "ISO date and time, such as 2026-09-15T17:00:00",
          span: 3,
        },
      ],
    },
  ],
};

export function sectionPreviewTitle(section: AstroHomepageSection): string {
  const fields = section.fields;
  return (
    fields.headline?.trim() ||
    fields.heading?.trim() ||
    fields.text?.trim() ||
    fields.value?.trim() ||
    ""
  );
}
