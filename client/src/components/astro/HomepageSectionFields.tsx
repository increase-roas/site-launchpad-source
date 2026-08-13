import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AstroHomepageSection } from "@shared/astroConfig";

type FieldDefinition = { key: string; label: string; multiline?: boolean; hint?: string };

const FIELDS: Record<AstroHomepageSection["type"], FieldDefinition[]> = {
  hero: [
    { key: "eyebrow", label: "Eyebrow" },
    { key: "headline", label: "Headline" },
    { key: "subheadline", label: "Subheadline", multiline: true },
    { key: "ctaLabel", label: "Button label" },
    { key: "ctaHref", label: "Button link" },
  ],
  cards: [
    { key: "heading", label: "Heading" },
    { key: "intro", label: "Intro", multiline: true },
    { key: "items", label: "Cards", multiline: true, hint: "One card per line: Title | Description | Link" },
  ],
  visit: [
    { key: "heading", label: "Heading" },
    { key: "body", label: "Showroom copy", multiline: true },
    { key: "ctaLabel", label: "Button label" },
    { key: "ctaHref", label: "Button link" },
  ],
  steps: [
    { key: "heading", label: "Heading" },
    { key: "steps", label: "Steps", multiline: true, hint: "One step per line: Title | Description" },
  ],
  gallery: [
    { key: "heading", label: "Heading" },
    { key: "images", label: "Gallery images", multiline: true, hint: "One image URL per line" },
  ],
  reviews: [
    { key: "heading", label: "Heading" },
    { key: "source", label: "Review source", hint: "Example: Google Business" },
  ],
  bignumber: [
    { key: "value", label: "Big number" },
    { key: "label", label: "Number label" },
    { key: "body", label: "Supporting copy", multiline: true },
  ],
  faq: [
    { key: "heading", label: "Heading" },
    { key: "items", label: "Questions and answers", multiline: true, hint: "One item per line: Question | Answer" },
  ],
  ctaband: [
    { key: "headline", label: "Headline" },
    { key: "subheadline", label: "Subheadline", multiline: true },
    { key: "ctaLabel", label: "Button label" },
    { key: "ctaHref", label: "Button link" },
  ],
  cta: [
    { key: "headline", label: "Headline" },
    { key: "ctaLabel", label: "Button label" },
    { key: "ctaHref", label: "Button link" },
  ],
};

export function HomepageSectionFields({
  section,
  onChange,
}: {
  section: AstroHomepageSection;
  onChange: (next: AstroHomepageSection) => void;
}) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {FIELDS[section.type].map(field => (
        <label key={field.key} className={field.multiline ? "block space-y-2 md:col-span-2" : "block space-y-2"}>
          <span className="text-sm font-extrabold">{field.label}</span>
          {field.multiline ? (
            <Textarea
              value={section.fields[field.key] ?? ""}
              onChange={event => onChange({ ...section, fields: { ...section.fields, [field.key]: event.target.value } })}
              className="min-h-24"
            />
          ) : (
            <Input
              value={section.fields[field.key] ?? ""}
              onChange={event => onChange({ ...section, fields: { ...section.fields, [field.key]: event.target.value } })}
            />
          )}
          {field.hint ? <span className="block text-xs font-semibold text-muted-foreground">{field.hint}</span> : null}
        </label>
      ))}
    </div>
  );
}
