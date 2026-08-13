import { ImageUploadCard } from "@/components/ImageUploadCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { HomepageSectionFields } from "./HomepageSectionFields";
import {
  ASTRO_ASSET_LABELS,
  ASTRO_CATEGORY_VALUES,
  ASTRO_SECTION_TYPE_VALUES,
  createAstroHomepageSection,
  type AstroAssetSlot,
  type AstroCategory,
  type AstroClientConfigInput,
  type AstroHomepageSection,
  type AstroNavigationItem,
  type AstroSectionType,
} from "@shared/astroConfig";
import { ArrowDown, ArrowUp, BadgeDollarSign, GripVertical, LayoutList, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";

type StoredImage = { slot: string; storageUrl: string; filename: string; byteSize: number };
const CATEGORY_ASSET_SLOT: Record<AstroCategory, AstroAssetSlot> = {
  "hot-tubs": "categoryHotTubs",
  "swim-spas": "categorySwimSpas",
  saunas: "categorySaunas",
  "cold-plunge": "categoryColdPlunge",
  "massage-chairs": "categoryMassageChairs",
};
const CATEGORY_LABELS: Record<AstroCategory, string> = {
  "hot-tubs": "Hot Tubs",
  "swim-spas": "Swim Spas",
  saunas: "Saunas",
  "cold-plunge": "Cold Plunge",
  "massage-chairs": "Massage Chairs",
};

function move<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm font-extrabold">{label}</span>{children}</label>;
}

function Header({ icon: Icon, title, description }: { icon: typeof LayoutList; title: string; description: string }) {
  return <div className="mb-6 flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold">{title}</h2><p className="mt-1 text-sm font-medium text-muted-foreground">{description}</p></div></div>;
}

export function ContentTab({ value, onChange, assets, uploadingSlot, onUpload }: { value: AstroClientConfigInput; onChange: (next: AstroClientConfigInput) => void; assets: StoredImage[]; uploadingSlot: AstroAssetSlot | null; onUpload: (slot: AstroAssetSlot, file: File) => void }) {
  const [dragNav, setDragNav] = useState<number | null>(null);
  const [dragSection, setDragSection] = useState<number | null>(null);
  const [newSectionType, setNewSectionType] = useState<AstroSectionType>("hero");
  const assetMap = new Map(assets.map(asset => [asset.slot, asset]));

  const updateNav = (navigationItems: AstroNavigationItem[]) => onChange({ ...value, navigationItems });
  const updateSections = (homepageSections: AstroHomepageSection[]) => onChange({ ...value, homepageSections });
  const updateCategory = (category: AstroCategory, patch: Partial<AstroClientConfigInput["categories"][AstroCategory]>) => onChange({ ...value, categories: { ...value.categories, [category]: { ...value.categories[category], ...patch } } });

  const addNav = (type: "categories" | "link") => updateNav([...value.navigationItems, { id: `nav-${type}-${Date.now()}`, type, label: type === "categories" ? "Products" : "New link", href: type === "categories" ? "" : "/", inHeader: true, inFooter: true }]);

  return <div className="space-y-5">
    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <Header icon={LayoutList} title="Navigation" description="Drag links into the order used by the header and footer." />
      <div className="space-y-3">{value.navigationItems.map((item, index) => <div key={item.id} draggable onDragStart={() => setDragNav(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragNav !== null) updateNav(move(value.navigationItems, dragNav, index)); setDragNav(null); }} className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.018] p-3 lg:grid-cols-[auto_150px_1fr_1fr_auto_auto_auto] lg:items-center"><GripVertical className="hidden h-5 w-5 cursor-grab text-muted-foreground lg:block" /><Select value={item.type} onValueChange={type => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, type: type as AstroNavigationItem["type"], href: type === "categories" ? "" : entry.href || "/" } : entry))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="categories">Categories</SelectItem><SelectItem value="link">Link</SelectItem></SelectContent></Select><Input aria-label="Navigation label" value={item.label} onChange={event => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, label: event.target.value } : entry))} /><Input aria-label="Navigation link" disabled={item.type === "categories"} value={item.href} onChange={event => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, href: event.target.value } : entry))} placeholder={item.type === "categories" ? "Auto-expands" : "/page"} /><label className="flex items-center gap-2 text-sm font-bold"><Switch checked={item.inHeader} onCheckedChange={inHeader => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, inHeader } : entry))} /> Header</label><label className="flex items-center gap-2 text-sm font-bold"><Switch checked={item.inFooter} onCheckedChange={inFooter => updateNav(value.navigationItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, inFooter } : entry))} /> Footer</label><Button type="button" size="icon" variant="ghost" aria-label="Remove navigation item" onClick={() => updateNav(value.navigationItems.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
      <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => addNav("link")}><Plus className="h-4 w-4" /> Add link</Button><Button type="button" variant="outline" onClick={() => addNav("categories")}><Plus className="h-4 w-4" /> Add categories menu</Button></div>
      <div className="mt-4 space-y-2 lg:hidden">{value.navigationItems.map((item, index) => <div key={`${item.id}-mobile-order`} className="flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.label || item.type}</span><Button type="button" size="icon" variant="ghost" disabled={index === 0} aria-label={`Move ${item.label || item.type} up`} onClick={() => updateNav(move(value.navigationItems, index, index - 1))}><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" disabled={index === value.navigationItems.length - 1} aria-label={`Move ${item.label || item.type} down`} onClick={() => updateNav(move(value.navigationItems, index, index + 1))}><ArrowDown className="h-4 w-4" /></Button></div>)}</div>
    </Card>

    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <Header icon={ShoppingBag} title="Categories" description="Enable only the product groups this client sells, then complete the visible category details." />
      <div className="space-y-4">{ASTRO_CATEGORY_VALUES.map(category => { const config = value.categories[category]; const slot = CATEGORY_ASSET_SLOT[category]; return <div key={category} className="rounded-2xl border border-white/8 bg-white/[0.018] p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold">{CATEGORY_LABELS[category]}</h3><p className="mt-1 text-sm font-medium text-muted-foreground">{config.enabled ? "Shown on the website" : "Hidden from the website"}</p></div><Switch checked={config.enabled} onCheckedChange={enabled => updateCategory(category, { enabled })} /></div>{config.enabled ? <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><div className="grid gap-4 sm:grid-cols-2"><Field label="Label"><Input value={config.label} onChange={event => updateCategory(category, { label: event.target.value })} /></Field><Field label="Slug"><Input value={config.slug} onChange={event => updateCategory(category, { slug: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Description"><Textarea value={config.description} onChange={event => updateCategory(category, { description: event.target.value })} className="min-h-28" /></Field></div></div><ImageUploadCard label={ASTRO_ASSET_LABELS[slot]} guidance="Wide category image used at the top of the category page." image={assetMap.get(slot)} busy={uploadingSlot === slot} onFile={file => onUpload(slot, file)} /></div> : null}</div>; })}</div>
    </Card>

    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><Header icon={BadgeDollarSign} title="Financing" description="Turn financing on only when the client has approved lender details and copy." /><Switch checked={value.financing.enabled} onCheckedChange={enabled => onChange({ ...value, financing: { ...value.financing, enabled } })} /></div>
      {value.financing.enabled ? <div className="grid gap-5 md:grid-cols-2"><Field label="Lender name"><Input value={value.financing.lenderName} onChange={event => onChange({ ...value, financing: { ...value.financing, lenderName: event.target.value } })} /></Field><Field label="Lender URL"><Input value={value.financing.lenderUrl} onChange={event => onChange({ ...value, financing: { ...value.financing, lenderUrl: event.target.value } })} /></Field><Field label="CTA label"><Input value={value.financing.ctaLabel} onChange={event => onChange({ ...value, financing: { ...value.financing, ctaLabel: event.target.value } })} /></Field><Field label="Monthly example"><Input value={value.financing.monthlyExample} onChange={event => onChange({ ...value, financing: { ...value.financing, monthlyExample: event.target.value } })} /></Field><div className="md:col-span-2"><Field label="Disclaimer"><Textarea value={value.financing.disclaimer} onChange={event => onChange({ ...value, financing: { ...value.financing, disclaimer: event.target.value } })} /></Field></div><div className="md:col-span-2"><Field label="Terms"><Textarea value={value.financing.terms} onChange={event => onChange({ ...value, financing: { ...value.financing, terms: event.target.value } })} /></Field></div></div> : <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm font-bold text-muted-foreground">Financing is off for this client.</p>}
    </Card>

    <Card className="border-white/8 bg-card/70 p-5 sm:p-6">
      <Header icon={LayoutList} title="Homepage sections" description="Add the section types the template supports, drag them into order, and fill the fields shown for each type." />
      <div className="space-y-3">{value.homepageSections.map((section, index) => <div key={section.id} draggable onDragStart={() => setDragSection(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragSection !== null) updateSections(move(value.homepageSections, dragSection, index)); setDragSection(null); }} className="rounded-2xl border border-white/8 bg-white/[0.018] p-4"><div className="flex flex-wrap items-center gap-3"><GripVertical className="h-5 w-5 cursor-grab text-muted-foreground" /><span className="rounded-lg bg-cyan-400/10 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-cyan-300">{section.type}</span><span className="text-sm font-bold text-muted-foreground">Position {index + 1}</span><label className="ml-auto flex items-center gap-2 text-sm font-bold"><Switch checked={section.enabled} onCheckedChange={enabled => updateSections(value.homepageSections.map((item, itemIndex) => itemIndex === index ? { ...item, enabled } : item))} /> {section.enabled ? "Enabled" : "Disabled"}</label><Button type="button" size="icon" variant="ghost" aria-label="Remove homepage section" onClick={() => updateSections(value.homepageSections.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div><HomepageSectionFields section={section} onChange={next => updateSections(value.homepageSections.map((item, itemIndex) => itemIndex === index ? next : item))} /></div>)}</div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Select value={newSectionType} onValueChange={value => setNewSectionType(value as AstroSectionType)}><SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger><SelectContent>{ASTRO_SECTION_TYPE_VALUES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><Button type="button" onClick={() => updateSections([...value.homepageSections, createAstroHomepageSection(newSectionType)])} className="bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"><Plus className="h-4 w-4" /> Add section</Button></div>
      <div className="mt-4 space-y-2 lg:hidden">{value.homepageSections.map((section, index) => <div key={`${section.id}-mobile-order`} className="flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm font-bold uppercase">{section.type}</span><Button type="button" size="icon" variant="ghost" disabled={index === 0} aria-label={`Move ${section.type} section up`} onClick={() => updateSections(move(value.homepageSections, index, index - 1))}><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" disabled={index === value.homepageSections.length - 1} aria-label={`Move ${section.type} section down`} onClick={() => updateSections(move(value.homepageSections, index, index + 1))}><ArrowDown className="h-4 w-4" /></Button></div>)}</div>
    </Card>
  </div>;
}
