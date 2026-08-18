import { StatusDot } from "@/components/StatusDot";
import { WorkspaceModeTabs } from "@/components/WorkspaceModeTabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import {
  SITE_PAGE_LABELS,
  type SitePageType,
} from "@shared/workspace";
import {
  ASTRO_SECTION_DESCRIPTIONS,
  ASTRO_SECTION_LABELS,
  type AstroSectionType,
} from "@shared/astroConfig";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  GripVertical,
  LayoutTemplate,
  Loader2,
  PanelsTopLeft,
  Save,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  nextSerializedSave,
  serializeHomepageSections,
  shouldHydrateHomepageSections,
} from "./editorIsolation";

type SectionDraft = {
  id: string;
  sectionType: AstroSectionType;
  enabled: boolean;
};

function PageThumbnail({ type }: { type: SitePageType }) {
  const shell = "h-full w-full rounded-xl border border-border bg-muted p-3";

  if (type === "homepage") {
    return (
      <div className={shell}>
        <div className="h-14 rounded-lg bg-gradient-to-r from-cyan-500/35 to-blue-500/10 p-2">
          <div className="h-2 w-1/2 rounded bg-white/50" />
          <div className="mt-2 h-1.5 w-3/4 rounded bg-white/18" />
          <div className="mt-2 h-3 w-12 rounded bg-cyan-300/70" />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map(item => <div key={item} className="h-8 rounded bg-white/[0.055]" />)}
        </div>
      </div>
    );
  }

  if (type === "inventory") {
    return (
      <div className={shell}>
        <div className="flex gap-2">
          <div className="h-7 flex-1 rounded bg-white/[0.06]" />
          <div className="h-7 w-12 rounded bg-cyan-400/25" />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map(item => (
            <div key={item} className="space-y-1 rounded bg-white/[0.04] p-1.5">
              <div className="h-6 rounded bg-white/[0.08]" />
              <div className="h-1.5 w-3/4 rounded bg-white/15" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "categories") {
    return (
      <div className={shell}>
        <div className="mb-2 h-2 w-1/3 rounded bg-white/35" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((item, index) => (
            <div
              key={item}
              className={`h-10 rounded-lg ${index % 2 ? "bg-emerald-400/13" : "bg-cyan-400/13"}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === "visitUs") {
    return (
      <div className={`${shell} grid grid-cols-[0.9fr_1.1fr] gap-2`}>
        <div className="space-y-2">
          <div className="h-2 w-3/4 rounded bg-white/35" />
          <div className="h-1.5 w-full rounded bg-white/12" />
          <div className="h-1.5 w-4/5 rounded bg-white/12" />
          <div className="h-6 rounded bg-cyan-400/20" />
        </div>
        <div className="relative rounded-lg bg-emerald-300/10">
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-400" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${shell} grid grid-cols-[1.1fr_0.9fr] gap-2`}>
      <div className="rounded-lg bg-amber-300/10 p-2">
        <div className="h-2 w-2/3 rounded bg-amber-200/35" />
        <div className="mt-2 h-1.5 w-full rounded bg-white/12" />
        <div className="mt-1.5 h-1.5 w-4/5 rounded bg-white/12" />
      </div>
      <div className="space-y-1.5 rounded-lg bg-white/[0.04] p-2">
        {[0, 1, 2].map(item => <div key={item} className="h-4 rounded bg-white/[0.07]" />)}
      </div>
    </div>
  );
}

function PageCard({
  page,
  onHomepage,
}: {
  page: {
    pageType: SitePageType;
    title: string;
    description: string;
    slug: string;
    status: "draft" | "ready" | "live" | "issue";
  };
  onHomepage: () => void;
}) {
  const tone = page.status === "live" ? "green" : page.status === "issue" ? "red" : "yellow";
  const label = page.status === "live" ? "Live" : page.status === "issue" ? "Issues" : "In progress";

  return (
    <Card className="group overflow-hidden border-white/8 bg-card/75 p-0 transition-transform duration-200 hover:-translate-y-0.5 hover:border-white/14">
      <div className="aspect-[16/9] border-b border-white/8 bg-black/20 p-4">
        <PageThumbnail type={page.pageType} />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold">{page.title}</h3>
            <p className="mt-1 text-xs font-bold text-cyan-300">{page.slug}</p>
          </div>
          <StatusDot good={tone === "green"} tone={tone} label={label} compact />
        </div>
        <p className="mt-3 min-h-10 text-sm font-medium leading-relaxed text-muted-foreground">
          {page.description}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            page.pageType === "homepage"
              ? onHomepage()
              : toast.info(`${SITE_PAGE_LABELS[page.pageType]} is ready to preview from the top bar.`)
          }
          className="mt-4 h-11 w-full justify-center gap-2 rounded-xl border-white/10 bg-white/[0.025] font-extrabold"
        >
          {page.pageType === "homepage" ? <LayoutTemplate className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {page.pageType === "homepage" ? "Arrange sections" : "View page"}
        </Button>
      </div>
    </Card>
  );
}

export default function WebsiteWorkspace({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const workspaceQuery = trpc.workspace.get.useQuery({ clientId });
  const astroConfigQuery = trpc.astroConfig.get.useQuery({ clientId });
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const sectionBuilderRef = useRef<HTMLDivElement>(null);
  const saveInFlightRef = useRef(false);
  const queuedSectionsRef = useRef<SectionDraft[] | null>(null);
  const lastCleanSerializedRef = useRef<string | null>(null);
  const sectionsRef = useRef<SectionDraft[]>([]);

  useEffect(() => {
    if (!astroConfigQuery.data) return;
    const incoming = astroConfigQuery.data.input.homepageSections.map(section => ({
      id: section.id,
      sectionType: section.type,
      enabled: section.enabled,
    }));
    const incomingSerialized = serializeHomepageSections(incoming);
    const local = sectionsRef.current;
    const localSerialized = local.length ? serializeHomepageSections(local) : null;
    if (
      !shouldHydrateHomepageSections({
        inFlight: saveInFlightRef.current,
        hasQueued: Boolean(queuedSectionsRef.current),
        localSerialized,
        lastCleanSerialized: lastCleanSerializedRef.current,
      })
    ) {
      return;
    }
    setSections(incoming);
    lastCleanSerializedRef.current = incomingSerialized;
  }, [astroConfigQuery.data]);

  sectionsRef.current = sections;

  const saveSections = trpc.astroConfig.saveHomepageSections.useMutation();

  const flushSections = (next: SectionDraft[]) => {
    saveInFlightRef.current = true;
    saveSections.mutate(
      {
        clientId,
        sections: next.map(section => ({
          id: section.id,
          type: section.sectionType,
          enabled: section.enabled,
        })),
      },
      {
        onSuccess: async () => {
          if (queuedSectionsRef.current) {
            const queued = queuedSectionsRef.current;
            queuedSectionsRef.current = null;
            flushSections(queued);
            return;
          }
          saveInFlightRef.current = false;
          lastCleanSerializedRef.current = serializeHomepageSections(next);
          await utils.astroConfig.get.invalidate({ clientId });
          toast.success("Homepage order saved.");
        },
        onError: error => {
          saveInFlightRef.current = false;
          toast.error(error.message);
        },
      },
    );
  };

  const persistSections = (next: SectionDraft[]) => {
    setSections(next);
    if (nextSerializedSave(saveInFlightRef.current) === "queue") {
      queuedSectionsRef.current = next;
      return;
    }
    flushSections(next);
  };

  const moveSection = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = sections.findIndex(section => section.id === fromId);
    const toIndex = sections.findIndex(section => section.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...sections];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persistSections(next);
  };

  const nudgeSection = (id: string, direction: -1 | 1) => {
    const index = sections.findIndex(section => section.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    persistSections(next);
  };

  if (workspaceQuery.isLoading || astroConfigQuery.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
          <p className="mt-3 font-bold text-muted-foreground">Loading website pages…</p>
        </div>
      </div>
    );
  }

  if (!workspaceQuery.data || workspaceQuery.error || !astroConfigQuery.data || astroConfigQuery.error) {
    return (
      <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-8 text-center">
        <h1 className="text-2xl font-extrabold">Website pages could not be loaded</h1>
        <Button
          type="button"
          onClick={() => {
            workspaceQuery.refetch();
            astroConfigQuery.refetch();
          }}
          className="mt-5 bg-cyan-400 font-extrabold text-slate-950"
        >
          Try again
        </Button>
      </div>
    );
  }

  const workspace = workspaceQuery.data;

  return (
    <div className="mx-auto w-full space-y-5">
      <section className="launchpad-feature-surface flex flex-col gap-4 rounded-lg border p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Website workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {workspace.client.businessName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Review the main pages, then arrange the homepage in the order customers should see it.
          </p>
        </div>
        <WorkspaceModeTabs clientId={clientId} active="website" />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Main site pages</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Five pages included in every client website.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl bg-white/[0.035] px-3 py-2 text-sm font-extrabold text-muted-foreground sm:flex">
            <PanelsTopLeft className="h-4 w-4 text-cyan-300" />
            {workspace.pages.length} pages
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspace.pages.map(page => (
            <PageCard
              key={page.id}
              page={page}
              onHomepage={() => sectionBuilderRef.current?.scrollIntoView({ behavior: "smooth" })}
            />
          ))}
        </div>
      </section>

      <section ref={sectionBuilderRef} className="scroll-mt-24 rounded-3xl border border-white/8 bg-card/70 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-300">
              <Sparkles className="h-5 w-5" />
              <p className="text-xs font-extrabold uppercase tracking-[0.18em]">Homepage builder</p>
            </div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Section order</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
              Drag cards into order, or use the arrow buttons. Turn off any section that should stay hidden.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-extrabold text-muted-foreground">
            {saveSections.isPending ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : <Save className="h-4 w-4 text-emerald-300" />}
            {saveSections.isPending ? "Saving…" : "Changes save automatically"}
          </div>
        </div>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-3">
            {sections.map((section, index) => (
              <div
                key={section.id}
                draggable
                onDragStart={() => setDraggedId(section.id)}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault();
                  if (draggedId) moveSection(draggedId, section.id);
                  setDraggedId(null);
                }}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-colors ${
                  draggedId === section.id
                    ? "border-cyan-400 bg-cyan-400/8"
                    : section.enabled
                      ? "border-white/9 bg-white/[0.025]"
                      : "border-white/6 bg-black/15 opacity-65"
                }`}
              >
                <button type="button" className="grid h-10 w-8 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.04]" aria-label={`Drag ${ASTRO_SECTION_LABELS[section.sectionType]}`}>
                  <GripVertical className="h-5 w-5" />
                </button>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-sm font-extrabold text-cyan-300">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-extrabold">{ASTRO_SECTION_LABELS[section.sectionType]}</h3>
                  <p className="mt-0.5 truncate text-sm font-medium text-muted-foreground">
                    {ASTRO_SECTION_DESCRIPTIONS[section.sectionType]}
                  </p>
                </div>
                <div className="hidden items-center gap-1 sm:flex">
                  <Button type="button" variant="ghost" size="icon" disabled={index === 0 || saveSections.isPending} onClick={() => nudgeSection(section.id, -1)} className="h-9 w-9" aria-label="Move section up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={index === sections.length - 1 || saveSections.isPending} onClick={() => nudgeSection(section.id, 1)} className="h-9 w-9" aria-label="Move section down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs font-extrabold text-muted-foreground sm:inline">
                    {section.enabled ? "On" : "Off"}
                  </span>
                  <Switch
                    checked={section.enabled}
                    disabled={saveSections.isPending}
                    onCheckedChange={enabled =>
                      persistSections(
                        sections.map(item => item.id === section.id ? { ...item, enabled } : item),
                      )
                    }
                    aria-label={`${section.enabled ? "Disable" : "Enable"} ${ASTRO_SECTION_LABELS[section.sectionType]}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <aside className="rounded-2xl border border-border bg-muted/70 p-4 xl:sticky xl:top-24">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Visual preview</p>
            <h3 className="mt-2 text-lg font-extrabold">Customer scroll order</h3>
            <div className="mt-4 space-y-2">
              {sections.filter(section => section.enabled).map((section, index) => (
                <div key={section.id} className="flex items-center gap-3 rounded-xl border border-white/7 bg-white/[0.03] p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-400/12 text-xs font-extrabold text-cyan-300">
                    {index + 1}
                  </span>
                  <span className="text-sm font-extrabold">{ASTRO_SECTION_LABELS[section.sectionType]}</span>
                </div>
              ))}
            </div>
            {sections.find(section => section.sectionType === "reviews" && !section.enabled) ? (
              <p className="mt-4 rounded-xl bg-amber-400/[0.06] p-3 text-xs font-bold leading-relaxed text-amber-200/80">
                Testimonials stay off until approved customer feedback is available.
              </p>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
