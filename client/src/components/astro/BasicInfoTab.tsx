import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ASTRO_SCHEMA_TYPE_VALUES,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import {
  fieldMessageFor,
  fieldStateFor,
  type ConfigReadiness,
} from "@shared/astroConfigReadiness";
import { BUSINESS_DAY_VALUES, type BusinessDay } from "@shared/client";
import { Clock3, Link2, MapPin, Phone, Store } from "lucide-react";
import { useState } from "react";
import {
  ConfigSection,
  FieldCell,
  FieldGrid,
  JoinedField,
  JoinedFields,
} from "./ConfigSection";
import { DAY_LABELS, HoursTable } from "./HoursTable";
import { UrlInput } from "./fieldWidgets";

const SCHEMA_TYPE_LABELS: Record<(typeof ASTRO_SCHEMA_TYPE_VALUES)[number], string> = {
  HomeAndConstructionBusiness: "Home & construction business",
  Store: "Store",
  LocalBusiness: "Local business",
};

const SOCIAL_META: Record<string, { label: string; placeholder: string }> = {
  facebook: { label: "Facebook", placeholder: "facebook.com/yourpage" },
  instagram: { label: "Instagram", placeholder: "instagram.com/yourhandle" },
  youtube: { label: "YouTube", placeholder: "youtube.com/@yourchannel" },
  tiktok: { label: "TikTok", placeholder: "tiktok.com/@yourhandle" },
  x: { label: "X (Twitter)", placeholder: "x.com/yourhandle" },
  linkedin: { label: "LinkedIn", placeholder: "linkedin.com/company/yourcompany" },
  googleBusiness: { label: "Google Business", placeholder: "g.page/yourbusiness" },
};

export function BasicInfoTab({
  value,
  readiness,
  onChange,
}: {
  value: AstroClientConfigInput;
  readiness: ConfigReadiness;
  onChange: (next: AstroClientConfigInput) => void;
}) {
  const [selectedDays, setSelectedDays] = useState<BusinessDay[]>([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]);
  const [groupOpens, setGroupOpens] = useState("09:00");
  const [groupCloses, setGroupCloses] = useState("17:00");
  const [groupClosed, setGroupClosed] = useState(false);

  const update = <K extends keyof AstroClientConfigInput>(
    key: K,
    next: AstroClientConfigInput[K],
  ) => onChange({ ...value, [key]: next });

  const cell = (path: string, optional = false) => ({
    state: fieldStateFor(readiness, path, { optional }),
    message: fieldMessageFor(readiness, path),
  });

  const applyGroupedHours = () =>
    update(
      "hours",
      value.hours.map(hour =>
        selectedDays.includes(hour.day)
          ? {
              ...hour,
              isOpen: !groupClosed,
              opensAt: groupClosed ? "" : groupOpens,
              closesAt: groupClosed ? "" : groupCloses,
            }
          : hour,
      ),
    );

  const emptyPlaceId = !value.address.googlePlaceId.trim();

  return (
    <div className="space-y-3">
      <ConfigSection
        icon={Store}
        title="Identity"
        description="The official business identity used across the site and structured data."
        readiness={readiness.sections.identity}
      >
        <FieldGrid columns={3}>
          <FieldCell label="Business name" {...cell("identity.businessName")}>
            <Input
              value={value.identity.businessName}
              onChange={event =>
                update("identity", { ...value.identity, businessName: event.target.value })
              }
              
            />
          </FieldCell>
          <FieldCell label="Short name" {...cell("identity.shortName")}>
            <Input
              value={value.identity.shortName}
              onChange={event =>
                update("identity", { ...value.identity, shortName: event.target.value })
              }
              
            />
          </FieldCell>
          <FieldCell label="Founded year" {...cell("identity.foundedYear")}>
            <Input
              type="number"
              min={1800}
              max={new Date().getFullYear()}
              value={value.identity.foundedYear}
              onChange={event =>
                update("identity", { ...value.identity, foundedYear: Number(event.target.value) })
              }
              className="tabular-nums"
            />
          </FieldCell>
          <FieldCell label="Tagline" span={2} {...cell("identity.tagline")}>
            <Input
              value={value.identity.tagline}
              onChange={event =>
                update("identity", { ...value.identity, tagline: event.target.value })
              }
              
            />
          </FieldCell>
          <FieldCell label="Site URL" {...cell("identity.siteUrl")}>
            <Input
              value={value.identity.siteUrl}
              onChange={event =>
                update("identity", { ...value.identity, siteUrl: event.target.value })
              }
              placeholder="https://example.com"
              
            />
          </FieldCell>
          <FieldCell
            label="Business type"
            span={3}
            hint={`schema.org · ${value.identity.schemaType}`}
            {...cell("identity.schemaType")}
          >
            <Select
              value={value.identity.schemaType}
              onValueChange={schemaType =>
                update("identity", {
                  ...value.identity,
                  schemaType: schemaType as AstroClientConfigInput["identity"]["schemaType"],
                })
              }
            >
              <SelectTrigger >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASTRO_SCHEMA_TYPE_VALUES.map(type => (
                  <SelectItem key={type} value={type}>
                    {SCHEMA_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCell>
        </FieldGrid>
      </ConfigSection>

      <ConfigSection
        icon={Phone}
        title="Contact"
        description="How customers reach the business."
        readiness={readiness.sections.contact}
        advancedLabel="Advanced — display-number override"
        advancedSummary={value.contact.phoneDisplayOverride ? "set" : "empty"}
        advanced={
          <FieldGrid columns={2}>
            <FieldCell
              label="Phone display override"
              {...cell("contact.phoneDisplayOverride", true)}
              hint="Shown to customers instead of the E.164 number."
            >
              <Input
                value={value.contact.phoneDisplayOverride}
                onChange={event =>
                  update("contact", {
                    ...value.contact,
                    phoneDisplayOverride: event.target.value,
                  })
                }
                placeholder="(701) 555-1234"
                
              />
            </FieldCell>
          </FieldGrid>
        }
      >
        <FieldGrid columns={3}>
          <FieldCell label="Main phone" {...cell("contact.phone")} hint="E.164, such as +17015551234">
            <Input
              value={value.contact.phone}
              onChange={event => update("contact", { ...value.contact, phone: event.target.value })}
              placeholder="+17015551234"
              className="tabular-nums"
            />
          </FieldCell>
          <FieldCell label="SMS phone" {...cell("contact.smsPhone", true)}>
            <Input
              value={value.contact.smsPhone}
              onChange={event =>
                update("contact", { ...value.contact, smsPhone: event.target.value })
              }
              placeholder="+17015551234"
              className="tabular-nums"
            />
          </FieldCell>
          <FieldCell label="Email" {...cell("contact.email")}>
            <Input
              type="email"
              value={value.contact.email}
              onChange={event => update("contact", { ...value.contact, email: event.target.value })}
              
            />
          </FieldCell>
        </FieldGrid>
      </ConfigSection>

      <ConfigSection
        icon={MapPin}
        title="Address"
        description="Used by maps, local search, and business schema."
        readiness={readiness.sections.address}
        advancedLabel="Advanced — Google Place ID"
        advancedSummary={emptyPlaceId ? "empty" : "set"}
        advanced={
          <FieldGrid columns={1}>
            <FieldCell label="Google Place ID" {...cell("address.googlePlaceId", true)}>
              <Input
                value={value.address.googlePlaceId}
                onChange={event =>
                  update("address", { ...value.address, googlePlaceId: event.target.value })
                }
                className="tabular-nums"
              />
            </FieldCell>
          </FieldGrid>
        }
      >
        <FieldGrid columns={3}>
          <FieldCell label="Street address" span={2} {...cell("address.street1")}>
            <Input
              value={value.address.street1}
              onChange={event =>
                update("address", { ...value.address, street1: event.target.value })
              }
              
            />
          </FieldCell>
          <FieldCell label="Suite or unit" {...cell("address.street2", true)}>
            <Input
              value={value.address.street2}
              onChange={event =>
                update("address", { ...value.address, street2: event.target.value })
              }
              
            />
          </FieldCell>
        </FieldGrid>

        <div className="border-t border-border">
          <FieldCell
            label="City, state, ZIP, country"
            state={cell("address.postalCode").state}
            message={
              fieldMessageFor(readiness, "address.city") ??
              fieldMessageFor(readiness, "address.state") ??
              fieldMessageFor(readiness, "address.postalCode") ??
              fieldMessageFor(readiness, "address.country")
            }
          >
            <JoinedFields>
              <JoinedField label="City" state={cell("address.city").state}>
                <Input
                  value={value.address.city}
                  onChange={event =>
                    update("address", { ...value.address, city: event.target.value })
                  }
                  className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                />
              </JoinedField>
              <JoinedField label="State" state={cell("address.state").state} width="84px">
                <Input
                  value={value.address.state}
                  onChange={event =>
                    update("address", { ...value.address, state: event.target.value })
                  }
                  className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                />
              </JoinedField>
              <JoinedField label="ZIP" state={cell("address.postalCode").state} width="110px">
                <Input
                  value={value.address.postalCode}
                  onChange={event =>
                    update("address", { ...value.address, postalCode: event.target.value })
                  }
                  className="h-7 border-0 bg-transparent px-0 text-sm tabular-nums shadow-none focus-visible:ring-0"
                />
              </JoinedField>
              <JoinedField label="Country" state={cell("address.country").state} width="86px">
                <Input
                  value={value.address.country}
                  onChange={event =>
                    update("address", { ...value.address, country: event.target.value })
                  }
                  className="h-7 border-0 bg-transparent px-0 text-sm uppercase shadow-none focus-visible:ring-0"
                />
              </JoinedField>
            </JoinedFields>
          </FieldCell>
        </div>

        <FieldGrid columns={2}>
          <FieldCell label="Latitude" {...cell("address.latitude", true)} hint="Required to publish maps">
            <Input
              inputMode="decimal"
              value={value.address.latitude}
              onChange={event =>
                update("address", { ...value.address, latitude: event.target.value })
              }
              placeholder="48.2325"
              className="tabular-nums"
            />
          </FieldCell>
          <FieldCell label="Longitude" {...cell("address.longitude", true)} hint="Required to publish maps">
            <Input
              inputMode="decimal"
              value={value.address.longitude}
              onChange={event =>
                update("address", { ...value.address, longitude: event.target.value })
              }
              placeholder="-101.2963"
              className="tabular-nums"
            />
          </FieldCell>
        </FieldGrid>
      </ConfigSection>

      <ConfigSection
        icon={Clock3}
        title="Hours"
        description="Set a group of days at once, then correct any exceptions below."
        readiness={readiness.sections.hours}
        toolbar={
          <>
            <span className="text-xs font-semibold text-muted-foreground">Bulk set</span>
            {BUSINESS_DAY_VALUES.map(day => (
              <button
                key={day}
                type="button"
                onClick={() =>
                  setSelectedDays(current =>
                    current.includes(day)
                      ? current.filter(item => item !== day)
                      : [...current, day],
                  )
                }
                aria-pressed={selectedDays.includes(day)}
                className={`h-9 rounded-md border px-2.5 text-xs font-medium ${
                  selectedDays.includes(day)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {DAY_LABELS[day].slice(0, 3)}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              Opens
              <Input
                type="time"
                value={groupOpens}
                disabled={groupClosed}
                onChange={event => setGroupOpens(event.target.value)}
                className="w-[130px] text-sm tabular-nums"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              Closes
              <Input
                type="time"
                value={groupCloses}
                disabled={groupClosed}
                onChange={event => setGroupCloses(event.target.value)}
                className="w-[130px] text-sm tabular-nums"
              />
            </label>
            <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium">
              <Switch checked={groupClosed} onCheckedChange={setGroupClosed} />
              Closed all day
            </label>
            <Button
              type="button"
              size="sm"
              onClick={applyGroupedHours}
              disabled={selectedDays.length === 0}
              className="ml-auto h-9 text-xs font-semibold"
            >
              Apply to {selectedDays.length} {selectedDays.length === 1 ? "day" : "days"}
            </Button>
          </>
        }
      >
        <HoursTable hours={value.hours} onChange={hours => update("hours", hours)} />
      </ConfigSection>

      <ConfigSection
        icon={MapPin}
        title="Service areas"
        description="Cities and regions shown in the footer and on Visit Us."
        readiness={readiness.sections.address}
        sectionId={null}
      >
        <FieldGrid columns={1}>
          <FieldCell label="Service areas" {...cell("serviceAreas", true)} hint="One city or region per line.">
            <Textarea
              value={value.serviceAreas}
              onChange={event => update("serviceAreas", event.target.value)}
              className="min-h-24"
            />
          </FieldCell>
        </FieldGrid>
      </ConfigSection>

      <ConfigSection
        icon={Link2}
        title="Social links"
        description="Optional. Shown in the footer and included in business schema."
        readiness={readiness.sections.socialLinks}
      >
        <FieldGrid columns={2}>
          {Object.entries(value.socialLinks).map(([key, url]) => {
            const meta = SOCIAL_META[key] ?? { label: key, placeholder: "example.com/page" };
            const path = `socialLinks.${key}`;
            const state = fieldStateFor(readiness, path, { optional: !url });
            return (
              <FieldCell
                key={key}
                label={meta.label}
                state={state}
                message={fieldMessageFor(readiness, path)}
              >
                <UrlInput
                  value={url}
                  invalid={state === "invalid"}
                  onChange={next =>
                    update("socialLinks", { ...value.socialLinks, [key]: next })
                  }
                  placeholder={meta.placeholder}
                />
              </FieldCell>
            );
          })}
        </FieldGrid>
      </ConfigSection>
    </div>
  );
}
