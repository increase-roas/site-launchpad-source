import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ASTRO_SCHEMA_TYPE_VALUES,
  type AstroClientConfigInput,
} from "@shared/astroConfig";
import { BUSINESS_DAY_VALUES, type BusinessDay } from "@shared/client";
import { Clock3, Link2, MapPin, Phone, Store } from "lucide-react";
import { useState } from "react";

const DAY_LABELS: Record<BusinessDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function Field({ label, children, optional = false }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return <label className="block space-y-2"><span className="text-sm font-extrabold">{label}{optional ? <span className="ml-2 font-semibold text-muted-foreground">Optional</span> : null}</span>{children}</label>;
}

function Section({ icon: Icon, title, description, children }: { icon: typeof Store; title: string; description: string; children: React.ReactNode }) {
  return <Card className="border-white/8 bg-card/70 p-5 sm:p-6"><div className="mb-6 flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold">{title}</h2><p className="mt-1 text-sm font-medium text-muted-foreground">{description}</p></div></div>{children}</Card>;
}

export function BasicInfoTab({ value, onChange }: { value: AstroClientConfigInput; onChange: (next: AstroClientConfigInput) => void }) {
  const [selectedDays, setSelectedDays] = useState<BusinessDay[]>(["monday", "tuesday", "wednesday", "thursday"]);
  const [groupOpens, setGroupOpens] = useState("09:00");
  const [groupCloses, setGroupCloses] = useState("17:00");
  const [groupClosed, setGroupClosed] = useState(false);

  const update = <K extends keyof AstroClientConfigInput>(key: K, next: AstroClientConfigInput[K]) => onChange({ ...value, [key]: next });
  const applyGroupedHours = () => update("hours", value.hours.map(hour => selectedDays.includes(hour.day) ? { ...hour, isOpen: !groupClosed, opensAt: groupClosed ? "" : groupOpens, closesAt: groupClosed ? "" : groupCloses } : hour));

  return <div className="space-y-5">
    <Section icon={Store} title="Identity" description="The official business identity used throughout the website and structured data.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Business name"><Input value={value.identity.businessName} onChange={event => update("identity", { ...value.identity, businessName: event.target.value })} /></Field>
        <Field label="Short name"><Input value={value.identity.shortName} onChange={event => update("identity", { ...value.identity, shortName: event.target.value })} /></Field>
        <Field label="Founded year"><Input type="number" min={1800} max={new Date().getFullYear()} value={value.identity.foundedYear} onChange={event => update("identity", { ...value.identity, foundedYear: Number(event.target.value) })} /></Field>
        <Field label="Tagline"><Input value={value.identity.tagline} onChange={event => update("identity", { ...value.identity, tagline: event.target.value })} /></Field>
        <Field label="Site URL"><Input value={value.identity.siteUrl} onChange={event => update("identity", { ...value.identity, siteUrl: event.target.value })} placeholder="https://example.com" /></Field>
        <Field label="Business type"><Select value={value.identity.schemaType} onValueChange={schemaType => update("identity", { ...value.identity, schemaType: schemaType as AstroClientConfigInput["identity"]["schemaType"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ASTRO_SCHEMA_TYPE_VALUES.map(type => <SelectItem key={type} value={type}>{type.replace(/([A-Z])/g, " $1").trim()}</SelectItem>)}</SelectContent></Select></Field>
      </div>
    </Section>

    <Section icon={Phone} title="Contact" description="Primary contact details plus optional text-message and display-number overrides.">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Main phone"><Input value={value.contact.phone} onChange={event => update("contact", { ...value.contact, phone: event.target.value })} placeholder="+17015551234" /></Field>
        <Field label="SMS phone" optional><Input value={value.contact.smsPhone} onChange={event => update("contact", { ...value.contact, smsPhone: event.target.value })} placeholder="+17015551234" /></Field>
        <Field label="Phone display override" optional><Input value={value.contact.phoneDisplayOverride} onChange={event => update("contact", { ...value.contact, phoneDisplayOverride: event.target.value })} placeholder="(701) 555-1234" /></Field>
        <Field label="Email"><Input type="email" value={value.contact.email} onChange={event => update("contact", { ...value.contact, email: event.target.value })} /></Field>
      </div>
    </Section>

    <Section icon={MapPin} title="Address" description="Storefront address and optional location data used by maps and search engines.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Street address"><Input value={value.address.street1} onChange={event => update("address", { ...value.address, street1: event.target.value })} /></Field>
        <Field label="Suite or unit" optional><Input value={value.address.street2} onChange={event => update("address", { ...value.address, street2: event.target.value })} /></Field>
        <Field label="City"><Input value={value.address.city} onChange={event => update("address", { ...value.address, city: event.target.value })} /></Field>
        <Field label="State or region"><Input value={value.address.state} onChange={event => update("address", { ...value.address, state: event.target.value })} /></Field>
        <Field label="ZIP or postal code"><Input value={value.address.postalCode} onChange={event => update("address", { ...value.address, postalCode: event.target.value })} /></Field>
        <Field label="Country"><Input value={value.address.country} onChange={event => update("address", { ...value.address, country: event.target.value })} /></Field>
        <Field label="Latitude" optional><Input inputMode="decimal" value={value.address.latitude} onChange={event => update("address", { ...value.address, latitude: event.target.value })} /></Field>
        <Field label="Longitude" optional><Input inputMode="decimal" value={value.address.longitude} onChange={event => update("address", { ...value.address, longitude: event.target.value })} /></Field>
        <Field label="Google Place ID" optional><Input value={value.address.googlePlaceId} onChange={event => update("address", { ...value.address, googlePlaceId: event.target.value })} /></Field>
      </div>
    </Section>

    <Section icon={Clock3} title="Hours" description="Set each day individually or apply one schedule to a group of days.">
      <div className="rounded-2xl border border-cyan-300/12 bg-cyan-400/[0.035] p-4">
        <div className="flex flex-wrap gap-2">{BUSINESS_DAY_VALUES.map(day => <button key={day} type="button" onClick={() => setSelectedDays(current => current.includes(day) ? current.filter(item => item !== day) : [...current, day])} className={`h-10 rounded-xl border px-3 text-sm font-extrabold ${selectedDays.includes(day) ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-white/10 bg-white/[0.025] text-muted-foreground"}`}>{DAY_LABELS[day].slice(0, 3)}</button>)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"><Field label="Opens"><Input type="time" value={groupOpens} disabled={groupClosed} onChange={event => setGroupOpens(event.target.value)} /></Field><Field label="Closes"><Input type="time" value={groupCloses} disabled={groupClosed} onChange={event => setGroupCloses(event.target.value)} /></Field><label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-extrabold"><Switch checked={groupClosed} onCheckedChange={setGroupClosed} /> Closed</label><Button type="button" onClick={applyGroupedHours} className="h-11 bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300">Apply to selected</Button></div>
      </div>
      <div className="mt-5 space-y-2">{value.hours.map((hour, index) => <div key={hour.day} className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.018] p-3 sm:grid-cols-[140px_auto_1fr_1fr] sm:items-center"><span className="font-extrabold">{DAY_LABELS[hour.day]}</span><label className="flex items-center gap-2 text-sm font-bold"><Switch checked={hour.isOpen} onCheckedChange={isOpen => update("hours", value.hours.map((item, itemIndex) => itemIndex === index ? { ...item, isOpen, opensAt: isOpen ? item.opensAt || "09:00" : "", closesAt: isOpen ? item.closesAt || "17:00" : "" } : item))} />{hour.isOpen ? "Open" : "Closed"}</label><Input aria-label={`${DAY_LABELS[hour.day]} opens`} type="time" disabled={!hour.isOpen} value={hour.opensAt} onChange={event => update("hours", value.hours.map((item, itemIndex) => itemIndex === index ? { ...item, opensAt: event.target.value } : item))} /><Input aria-label={`${DAY_LABELS[hour.day]} closes`} type="time" disabled={!hour.isOpen} value={hour.closesAt} onChange={event => update("hours", value.hours.map((item, itemIndex) => itemIndex === index ? { ...item, closesAt: event.target.value } : item))} /></div>)}</div>
    </Section>

    <Section icon={Link2} title="Social links" description="Optional links shown in the footer and included in business schema.">
      <div className="grid gap-5 md:grid-cols-2">{Object.entries(value.socialLinks).map(([key, url]) => <Field key={key} label={key === "x" ? "X (Twitter)" : key === "googleBusiness" ? "Google Business" : key[0]!.toUpperCase() + key.slice(1)} optional><Input value={url} onChange={event => update("socialLinks", { ...value.socialLinks, [key]: event.target.value })} placeholder="https://" /></Field>)}</div>
    </Section>
  </div>;
}
