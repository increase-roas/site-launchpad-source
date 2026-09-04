import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { AstroHomepageSection } from "@shared/astroConfig";
import { fieldMessageFor, fieldStateFor, type ConfigReadiness } from "@shared/astroConfigReadiness";
import type { MediaLibraryItemView } from "@shared/mediaLibrary";
import { FieldCell, FieldGrid, JoinedField, JoinedFields } from "./ConfigSection";
import { SimpleLinesEditor } from "./content/SimpleLinesEditor";
import { StructuredLinesEditor } from "./content/StructuredLinesEditor";
import { parseJoinedParts, serializeJoinedParts } from "./content/lineRecords";
import { SECTION_FIELD_GROUPS, type SectionField } from "./content/sectionFieldModel";
import { GalleryImagesField } from "./media/GalleryImagesField";

function HrefInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const isAbsolute = /^https?:\/\//i.test(value);
  if (isAbsolute || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return (
      <Input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder ?? "https:// or /page"}
      />
    );
  }
  const display = value.startsWith("/") ? value.slice(1) : value;
  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>/</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        value={display}
        onChange={event => {
          const next = event.target.value;
          if (/^https?:\/\//i.test(next) || next.startsWith("mailto:") || next.startsWith("tel:")) {
            onChange(next);
            return;
          }
          onChange(next ? `/${next.replace(/^\/+/, "")}` : "");
        }}
        placeholder={placeholder ?? "visit-us"}
      />
    </InputGroup>
  );
}

function FieldControl({
  field,
  value,
  mediaItems,
  onChange,
}: {
  field: SectionField;
  value: string;
  mediaItems?: MediaLibraryItemView[];
  onChange: (next: string) => void;
}) {
  if (field.list?.kind === "lines") {
    return (
      <SimpleLinesEditor
        value={value}
        onChange={onChange}
        addLabel={field.list.addLabel}
        placeholder={field.list.placeholder}
      />
    );
  }
  if (field.list?.kind === "records") {
    return (
      <StructuredLinesEditor
        value={value}
        columns={field.list.columns}
        layout={field.list.layout}
        onChange={onChange}
        addLabel={field.list.addLabel}
      />
    );
  }
  if (field.list?.kind === "joined") {
    const joined = field.list;
    const parts = parseJoinedParts(value, joined.keys);
    return (
      <JoinedFields>
        {joined.keys.map((key, index) => (
          <JoinedField key={key} label={joined.labels[index] ?? key}>
            <Input
              value={parts[key] ?? ""}
              onChange={event =>
                onChange(serializeJoinedParts({ ...parts, [key]: event.target.value }, joined.keys))
              }
            />
          </JoinedField>
        ))}
      </JoinedFields>
    );
  }
  if (field.control === "gallery") {
    return (
      <GalleryImagesField
        value={value}
        libraryItems={mediaItems ?? []}
        onChange={onChange}
      />
    );
  }
  if (field.control === "url") {
    return <HrefInput value={value} onChange={onChange} placeholder={field.placeholder} />;
  }
  if (field.control === "textarea") {
    return (
      <Textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={field.placeholder}
        className="min-h-24"
      />
    );
  }
  return (
    <Input
      type={field.control === "number" ? "number" : "text"}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={field.placeholder}
    />
  );
}

export function HomepageSectionFields({
  section,
  index,
  readiness,
  mediaItems,
  onChange,
}: {
  section: AstroHomepageSection;
  index?: number;
  readiness?: ConfigReadiness;
  mediaItems?: MediaLibraryItemView[];
  onChange: (next: AstroHomepageSection) => void;
}) {
  const groups = SECTION_FIELD_GROUPS[section.type];
  const setField = (key: string, next: string) =>
    onChange({ ...section, fields: { ...section.fields, [key]: next } });

  const renderGroup = (group: (typeof groups)[number]) => (
    <FieldGrid columns={3}>
      {group.fields.map(field => {
        const path =
          index === undefined ? undefined : `homepageSections.${index}.fields.${field.key}`;
        const state = path && readiness
          ? fieldStateFor(readiness, path, { optional: !field.required })
          : field.required
            ? "complete"
            : "optional";
        const message = path && readiness ? fieldMessageFor(readiness, path) : undefined;
        return (
          <FieldCell
            key={field.key}
            label={field.label}
            state={state}
            message={message}
            hint={field.hint}
            span={field.span}
            as={field.list || field.control === "gallery" ? "div" : "label"}
          >
            <FieldControl
              field={field}
              value={section.fields[field.key] ?? ""}
              mediaItems={mediaItems}
              onChange={next => setField(field.key, next)}
            />
          </FieldCell>
        );
      })}
    </FieldGrid>
  );

  if (groups.length === 1) {
    return <div className="mt-1">{renderGroup(groups[0])}</div>;
  }

  return (
    <Tabs defaultValue={groups[0]?.id} className="mt-1 gap-3">
      <TabsList className="flex h-auto w-full flex-wrap justify-start">
        {groups.map(group => (
          <TabsTrigger key={group.id} value={group.id}>
            {group.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {groups.map(group => (
        <TabsContent key={group.id} value={group.id}>
          {group.description ? (
            <p className="mb-3 text-xs text-muted-foreground">{group.description}</p>
          ) : null}
          {renderGroup(group)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
