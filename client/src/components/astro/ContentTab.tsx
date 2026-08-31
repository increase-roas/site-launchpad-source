import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { HomepageSectionFields } from "./HomepageSectionFields";
import {
  ASTRO_CATEGORY_VALUES,
  ASTRO_SECTION_TYPE_VALUES,
  createAstroHomepageSection,
  type AstroCategory,
  type AstroClientConfigInput,
  type AstroHomepageSection,
  type AstroNavigationItem,
  type AstroSectionType,
} from "@shared/astroConfig";
import { type ConfigReadiness } from "@shared/astroConfigReadiness";
import { ArrowDown, ArrowUp, BadgeDollarSign, GripVertical, LayoutList, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfigSection, SectionBody } from "./ConfigSection";
import { CATEGORY_ASSET_SLOT, CATEGORY_LABELS } from "./categories";

type StoredImage = { slot: string; storageUrl: string; filename: string; byteSize: number };

function move<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-semibold">{label}</span>{children}</label>;
}

export function ContentTab({ value, readiness, onChange, assets }: { value: AstroClientConfigInput; readiness: ConfigReadiness; onChange: (next: AstroClientConfigInput) => void; assets: StoredImage[] }) {
  const [dragNav, setDragNav] = useState<number | null>(null);
  const [dragSection, setDragSection] = useState<number | null>(null);
  const [newSectionType, setNewSectionType] = useState<AstroSectionType>("hero");
  const assetMap = new Map(assets.map(asset => [asset.slot, asset]));

  const updateNav = (navigationItems: AstroNavigationItem[]) => onChange({ ...value, navigationItems });
  const updateSections = (homepageSections: AstroHomepageSection[]) => onChange({ ...value, homepageSections });
  const updateCategory = (category: AstroCategory, patch: Partial<AstroClientConfigInput["categories"][AstroCategory]>) => onChange({ ...value, categories: { ...value.categories, [category]: { ...value.categories[category], ...patch } } });

  const addNav = (type: "categories" | "link") => updateNav([...value.navigationItems, { id: `nav-${type}-${Date.now()}`, type, label: type === "categories" ? "Products" : "New link", href: type === "categories" ? "" : "/", inHeader: true, inFooter: true }]);

  const enabledSections = value.homepageSections.filter(section => section.enabled);

  return <div className="space-y-3">
    <ConfigSection
      icon={LayoutList}
      title="Navigation"
      description="Drag links into the order used by the header and footer."
      readiness={readiness.sections.navigation}
    >
      <SectionBody>
      <div className="space-y-3">{value.navigationItems.map((item, index) => <div key={item.id} draggable onDragStart={() => setDragNav(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragNav !== null) updateNav(move(value.navigationItems, dragNav, index)); setDragNav(null); }} className="grid gap-3 rounded-lg border border-border bg-muted p-3 lg:grid-cols-[auto_150px_1fr_1fr_auto_auto_auto] lg:items-center"><GripVertical className="hidden h-5 w-5 cursor-grab text-muted-foreground lg:block" /><Select value={item.type} onValueChange={type => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, type: type as AstroNavigationItem["type"], href: type === "categories" ? "" : entry.href || "/" } : entry))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="categories">Categories</SelectItem><SelectItem value="link">Link</SelectItem></SelectContent></Select><Input aria-label="Navigation label" value={item.label} onChange={event => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, label: event.target.value } : entry))} /><Input aria-label="Navigation link" disabled={item.type === "categories"} value={item.href} onChange={event => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, href: event.target.value } : entry))} placeholder={item.type === "categories" ? "Auto-expands" : "/page"} /><label className="flex items-center gap-2 text-sm font-medium"><Switch checked={item.inHeader} onCheckedChange={inHeader => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, inHeader } : entry))} /> Header</label><label className="flex items-center gap-2 text-sm font-medium"><Switch checked={item.inFooter} onCheckedChange={inFooter => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, inFooter } : entry))} /> Footer</label><Button type="button" size="icon" variant="ghost" aria-label="Remove navigation item" onClick={() => updateNav(value.navigationItems.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
      <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => addNav("link")}><Plus className="h-4 w-4" /> Add link</Button><Button type="button" variant="outline" onClick={() => addNav("categories")}><Plus className="h-4 w-4" /> Add categories menu</Button></div>
      <div className="mt-4 space-y-2 lg:hidden">{value.navigationItems.map((item, index) => <div key={`${item.id}-mobile-order`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label || item.type}</span><Button type="button" size="icon" variant="ghost" disabled={index === 0} aria-label={`Move ${item.label || item.type} up`} onClick={() => updateNav(move(value.navigationItems, index, index - 1))}><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" disabled={index === value.navigationItems.length - 1} aria-label={`Move ${item.label || item.type} down`} onClick={() => updateNav(move(value.navigationItems, index, index + 1))}><ArrowDown className="h-4 w-4" /></Button></div>)}</div>
      </SectionBody>
    </ConfigSection>

    <ConfigSection
      icon={ShoppingBag}
      title="Categories"
      description="Enable only the product groups this client sells, then complete the visible details."
      readiness={readiness.sections.categories}
    >
      <SectionBody>
      <div className="space-y-4">{ASTRO_CATEGORY_VALUES.map(category => { const config = value.categories[category]; const slot = CATEGORY_ASSET_SLOT[category]; return <div key={category} className="rounded-lg border border-border bg-muted p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">{CATEGORY_LABELS[category]}</h3><p className="mt-1 text-sm font-medium text-muted-foreground">{config.enabled ? "Shown on the website" : "Hidden from the website"}</p></div><Switch checked={config.enabled} onCheckedChange={enabled => updateCategory(category, { enabled })} /></div>{config.enabled ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Label"><Input value={config.label} onChange={event => updateCategory(category, { label: event.target.value })} /></Field><Field label="Slug"><Input value={config.slug} onChange={event => updateCategory(category, { slug: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Description"><Textarea value={config.description} onChange={event => updateCategory(category, { description: event.target.value })} className="min-h-28" /></Field></div><p className="text-xs text-muted-foreground sm:col-span-2">{assetMap.has(slot) ? "Hero photo added under Media." : "Add the hero photo under Media."}</p></div> : null}</div>; })}</div>
      </SectionBody>
    </ConfigSection>

    <ConfigSection
      icon={BadgeDollarSign}
      title="Financing"
      description="Turn financing on only when the client has approved lender details and copy."
      readiness={readiness.sections.financing}
      toolbar={
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={value.financing.enabled} onCheckedChange={enabled => onChange({ ...value, financing: { ...value.financing, enabled } })} />
          {value.financing.enabled ? "Financing is on" : "Financing is off"}
        </label>
      }
    >
      <SectionBody>
      {value.financing.enabled ? <div className="grid gap-5 md:grid-cols-2"><Field label="Lender name"><Input value={value.financing.lenderName} onChange={event => onChange({ ...value, financing: { ...value.financing, lenderName: event.target.value } })} /></Field><Field label="Lender URL"><Input value={value.financing.lenderUrl} onChange={event => onChange({ ...value, financing: { ...value.financing, lenderUrl: event.target.value } })} /></Field><Field label="CTA label"><Input value={value.financing.ctaLabel} onChange={event => onChange({ ...value, financing: { ...value.financing, ctaLabel: event.target.value } })} /></Field><Field label="Monthly example"><Input value={value.financing.monthlyExample} onChange={event => onChange({ ...value, financing: { ...value.financing, monthlyExample: event.target.value } })} /></Field><div className="md:col-span-2"><Field label="Disclaimer"><Textarea value={value.financing.disclaimer} onChange={event => onChange({ ...value, financing: { ...value.financing, disclaimer: event.target.value } })} /></Field></div><div className="md:col-span-2"><Field label="Terms"><Textarea value={value.financing.terms} onChange={event => onChange({ ...value, financing: { ...value.financing, terms: event.target.value } })} /></Field></div></div> : <p className="rounded-lg border border-dashed border-border p-5 text-xs text-muted-foreground">Financing is off for this client.</p>}
      </SectionBody>
    </ConfigSection>

    <ConfigSection
      icon={LayoutList}
      title="Homepage sections"
      description="Add the sections the template supports, drag them into order, and fill each type's fields."
      readiness={readiness.sections.homepage}
      toolbar={
        <span className="text-xs tabular-nums text-muted-foreground">
          {enabledSections.length} of {value.homepageSections.length} sections enabled
        </span>
      }
    >
      <SectionBody>
      <div className="space-y-3">{value.homepageSections.map((section, index) => <div key={section.id} draggable onDragStart={() => setDragSection(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragSection !== null) updateSections(move(value.homepageSections, dragSection, index)); setDragSection(null); }} className="rounded-lg border border-border bg-muted p-4"><div className="flex flex-wrap items-center gap-3"><GripVertical className="h-5 w-5 cursor-grab text-muted-foreground" /><span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.type}</span><span className="text-sm font-medium text-muted-foreground">Position {index + 1}</span><label className="ml-auto flex items-center gap-2 text-sm font-medium"><Switch checked={section.enabled} onCheckedChange={enabled => updateSections(value.homepageSections.map((item, itemIndex) => itemIndex === index ? { ...item, enabled } : item))} /> {section.enabled ? "Enabled" : "Disabled"}</label><Button type="button" size="icon" variant="ghost" aria-label="Remove homepage section" onClick={() => updateSections(value.homepageSections.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div><HomepageSectionFields section={section} onChange={next => updateSections(value.homepageSections.map((item, itemIndex) => itemIndex === index ? next : item))} /></div>)}</div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Select value={newSectionType} onValueChange={value => setNewSectionType(value as AstroSectionType)}><SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger><SelectContent>{ASTRO_SECTION_TYPE_VALUES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><Button type="button" onClick={() => updateSections([...value.homepageSections, createAstroHomepageSection(newSectionType)])} className="bg-primary font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Add section</Button></div>
      <div className="mt-4 space-y-2 lg:hidden">{value.homepageSections.map((section, index) => <div key={`${section.id}-mobile-order`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm font-medium uppercase">{section.type}</span><Button type="button" size="icon" variant="ghost" disabled={index === 0} aria-label={`Move ${section.type} section up`} onClick={() => updateSections(move(value.homepageSections, index, index - 1))}><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" disabled={index === value.homepageSections.length - 1} aria-label={`Move ${section.type} section down`} onClick={() => updateSections(move(value.homepageSections, index, index + 1))}><ArrowDown className="h-4 w-4" /></Button></div>)}</div>
      </SectionBody>
    </ConfigSection>
  </div>;
}
