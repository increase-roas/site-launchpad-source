import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploadCard } from "@/components/ImageUploadCard";
import { uploadAssetDirectly } from "@/lib/assetUpload";
import { trpc } from "@/lib/trpc";
import type { Background, BoxSpacing, ButtonAction, DeviceVisibility, Overlay } from "@shared/paidFunnel/graph";
import { BUTTON_ACTION_TYPES, currentSpacing, inspectorModel } from "@shared/paidFunnel/inspector";
import { integrationPresenceRows } from "@shared/paidFunnel/integrationPresence";
import type { ClientIntegrationProfileDto } from "@shared/clientIntegrationProfile";
import {
  applySelectedPatch,
  attachSelectedMedia,
  canRedoStudio,
  canUndoStudio,
  patchGlobalStyles,
  reorderSelectedChild,
  resizeSelectedRow,
  saveSelectedReusable,
  setSelectedAction,
  setSelectedSpacing,
  setSelectedText,
  setSelectedVisibility,
  studioHotkey,
  type StudioState,
} from "@shared/paidFunnel/store";
import { Copy, Trash2 } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm font-bold">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={event => onChange(Number(event.target.value) || 0)}
        className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
      />
    </Field>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1520] px-3 text-sm font-bold"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SpacingFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BoxSpacing;
  onChange: (value: BoxSpacing) => void;
}) {
  const set = (key: keyof BoxSpacing, next: number) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {(["top", "right", "bottom", "left"] as const).map(side => (
          <NumberField key={side} label={side} value={value[side]} onChange={next => set(side, next)} />
        ))}
      </div>
    </div>
  );
}

function BackgroundFields({
  value,
  onChange,
}: {
  value: Background;
  onChange: (value: Background) => void;
}) {
  const kind = value.kind;
  return (
    <div className="space-y-2">
      <SelectField
        label="Background"
        value={kind}
        options={[
          { value: "none", label: "None" },
          { value: "color", label: "Color" },
          { value: "gradient", label: "Gradient" },
          { value: "image", label: "Image" },
        ]}
        onChange={next => {
          if (next === "none") onChange({ kind: "none" });
          else if (next === "color") onChange({ kind: "color", color: kind === "color" ? value.color : "#0b1c2b" });
          else if (next === "gradient") onChange({ kind: "gradient", from: "#082f49", to: "#022c22", angle: 135 });
          else onChange({ kind: "image", url: "", size: "cover", position: "center" });
        }}
      />
      {kind === "color" ? (
        <Field label="Color">
          <Input value={value.color} onChange={event => onChange({ kind: "color", color: event.target.value })} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
        </Field>
      ) : null}
      {kind === "gradient" ? (
        <>
          <Field label="From">
            <Input value={value.from} onChange={event => onChange({ ...value, from: event.target.value })} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
          </Field>
          <Field label="To">
            <Input value={value.to} onChange={event => onChange({ ...value, to: event.target.value })} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
          </Field>
          <NumberField label="Angle" value={value.angle} onChange={angle => onChange({ ...value, angle })} />
        </>
      ) : null}
      {kind === "image" ? (
        <Field label="Image URL">
          <Input value={value.url} onChange={event => onChange({ ...value, url: event.target.value })} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
        </Field>
      ) : null}
    </div>
  );
}

function VisibilityFields({
  value,
  onChange,
}: {
  value: DeviceVisibility;
  onChange: (value: DeviceVisibility) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">Visibility</p>
      {(["desktop", "tablet", "mobile"] as const).map(device => (
        <label key={device} className="flex items-center justify-between text-sm font-bold capitalize">
          {device}
          <input
            type="checkbox"
            checked={value[device]}
            onChange={event => onChange({ ...value, [device]: event.target.checked })}
          />
        </label>
      ))}
    </div>
  );
}

export function PaidFunnelInspector({
  clientId,
  state,
  onChange,
  profile,
}: {
  clientId: number;
  state: StudioState;
  onChange: Dispatch<SetStateAction<StudioState | null>>;
  profile: ClientIntegrationProfileDto;
}) {
  const requestUpload = trpc.assets.requestUpload.useMutation();
  const completeUpload = trpc.assets.completeUpload.useMutation();
  const inspector = inspectorModel(state.document.graph, state.selectedId, state.device);
  const commit = (next: StudioState) => onChange(next);
  const presence = integrationPresenceRows(profile);
  const globals = state.document.graph.globalStyles;

  return (
    <aside className="space-y-4 overflow-y-auto border-l border-white/8 p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Inspector</p>
      {inspector ? (
        <div className="space-y-3">
          <h3 className="text-lg font-extrabold">{inspector.title}</h3>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{inspector.kind} · {inspector.breakpoint}</p>

          {inspector.controls.includes("layout") ? (
            <SelectField
              label="Layout"
              value={String(inspector.values.layout ?? "boxed")}
              options={[{ value: "full", label: "Full width" }, { value: "boxed", label: "Boxed" }]}
              onChange={layout => commit(applySelectedPatch(state, { layout }))}
            />
          ) : null}
          {inspector.controls.includes("maxWidth") ? (
            <NumberField label="Max width" value={Number(inspector.values.maxWidth ?? 1120)} onChange={maxWidth => commit(applySelectedPatch(state, { maxWidth }))} />
          ) : null}
          {inspector.controls.includes("minHeight") ? (
            <NumberField label="Min height" value={Number(inspector.values.minHeight ?? 0)} onChange={minHeight => commit(applySelectedPatch(state, { minHeight }))} />
          ) : null}
          {inspector.controls.includes("alignment") ? (
            <SelectField
              label="Alignment"
              value={String((inspector.values.alignment as string | undefined) ?? (inspector.kind === "element" ? (inspector.values.styles as { textAlign?: { desktop?: string } } | undefined)?.textAlign?.desktop : "left") ?? "left")}
              options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}
              onChange={alignment => {
                if (inspector.kind === "element") {
                  const styles = { ...(inspector.values.styles as Record<string, unknown>), textAlign: { desktop: alignment, [state.device]: alignment } };
                  commit(applySelectedPatch(state, { styles }));
                } else {
                  commit(applySelectedPatch(state, { alignment }));
                }
              }}
            />
          ) : null}
          {inspector.controls.includes("gap") ? (
            <NumberField label="Gap" value={Number(inspector.values.gap ?? 16)} onChange={gap => commit(applySelectedPatch(state, { gap }))} />
          ) : null}
          {inspector.controls.includes("valign") ? (
            <SelectField
              label="Vertical align"
              value={String(inspector.values.valign ?? "top")}
              options={[{ value: "top", label: "Top" }, { value: "center", label: "Center" }, { value: "bottom", label: "Bottom" }]}
              onChange={valign => commit(applySelectedPatch(state, { valign }))}
            />
          ) : null}
          {inspector.controls.includes("wrap") ? (
            <label className="flex items-center justify-between text-sm font-bold">
              Wrap
              <input type="checkbox" checked={Boolean(inspector.values.wrap)} onChange={event => commit(applySelectedPatch(state, { wrap: event.target.checked }))} />
            </label>
          ) : null}
          {inspector.controls.includes("sticky") ? (
            <label className="flex items-center justify-between text-sm font-bold">
              Sticky
              <input type="checkbox" checked={Boolean(inspector.values.sticky)} onChange={event => commit(applySelectedPatch(state, { sticky: event.target.checked }))} />
            </label>
          ) : null}
          {inspector.controls.includes("padding") || inspector.controls.includes("spacing") ? (
            <SpacingFields
              label={`Padding (${state.device})`}
              value={
                inspector.kind === "element"
                  ? currentSpacing((inspector.values.styles as { padding?: Parameters<typeof currentSpacing>[0] } | undefined)?.padding, state.device)
                  : currentSpacing(inspector.values.padding as Parameters<typeof currentSpacing>[0], state.device)
              }
              onChange={padding => {
                if (inspector.kind === "element") {
                  const styles = inspector.values.styles as { padding?: Record<string, BoxSpacing> };
                  commit(applySelectedPatch(state, { styles: { ...styles, padding: { ...styles.padding, [state.device]: padding } } }));
                } else {
                  commit(setSelectedSpacing(state, "padding", padding));
                }
              }}
            />
          ) : null}
          {inspector.controls.includes("margin") ? (
            <SpacingFields
              label={`Margin (${state.device})`}
              value={currentSpacing(inspector.values.margin as Parameters<typeof currentSpacing>[0], state.device)}
              onChange={margin => commit(setSelectedSpacing(state, "margin", margin))}
            />
          ) : null}
          {inspector.controls.includes("background") ? (
            <BackgroundFields
              value={(inspector.kind === "element" ? (inspector.values.styles as { background?: Background })?.background : inspector.values.background) as Background ?? { kind: "none" }}
              onChange={background => {
                if (inspector.kind === "element") {
                  const styles = { ...(inspector.values.styles as Record<string, unknown>), background };
                  commit(applySelectedPatch(state, { styles }));
                } else {
                  commit(applySelectedPatch(state, { background }));
                }
              }}
            />
          ) : null}
          {inspector.controls.includes("overlay") ? (
            <div className="space-y-2">
              <Field label="Overlay color">
                <Input
                  value={((inspector.values.overlay as Overlay | null)?.color) ?? "#020617"}
                  onChange={event => commit(applySelectedPatch(state, { overlay: { color: event.target.value, opacity: (inspector.values.overlay as Overlay | null)?.opacity ?? 0.25 } }))}
                  className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
                />
              </Field>
              <NumberField
                label="Overlay opacity"
                value={(inspector.values.overlay as Overlay | null)?.opacity ?? 0}
                onChange={opacity => commit(applySelectedPatch(state, { overlay: { color: (inspector.values.overlay as Overlay | null)?.color ?? "#020617", opacity } }))}
              />
            </div>
          ) : null}
          {inspector.controls.includes("border") ? (
            <>
              <Field label="Border color">
                <Input
                  value={String(inspector.values.borderColor ?? (inspector.values.styles as { borderColor?: string } | undefined)?.borderColor ?? "transparent")}
                  onChange={event => {
                    if (inspector.kind === "element") {
                      commit(applySelectedPatch(state, { styles: { ...(inspector.values.styles as object), borderColor: event.target.value } }));
                    } else {
                      commit(applySelectedPatch(state, { borderColor: event.target.value }));
                    }
                  }}
                  className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
                />
              </Field>
              <NumberField
                label="Border width"
                value={Number(inspector.values.borderWidth ?? (inspector.values.styles as { borderWidth?: number } | undefined)?.borderWidth ?? 0)}
                onChange={borderWidth => {
                  if (inspector.kind === "element") {
                    commit(applySelectedPatch(state, { styles: { ...(inspector.values.styles as object), borderWidth } }));
                  } else {
                    commit(applySelectedPatch(state, { borderWidth }));
                  }
                }}
              />
            </>
          ) : null}
          {inspector.controls.includes("radius") ? (
            <NumberField label="Radius" value={Number(inspector.values.radius ?? 0)} onChange={borderRadius => commit(applySelectedPatch(state, { borderRadius }))} />
          ) : null}
          {inspector.controls.includes("shadow") ? (
            <Field label="Shadow">
              <Input value={String(inspector.values.shadow ?? "none")} onChange={event => commit(applySelectedPatch(state, { shadow: event.target.value }))} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
            </Field>
          ) : null}
          {inspector.controls.includes("anchor") ? (
            <Field label="Anchor">
              <Input value={String(inspector.values.anchor ?? "")} onChange={event => commit(applySelectedPatch(state, { anchor: event.target.value }))} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
            </Field>
          ) : null}
          {inspector.controls.includes("className") ? (
            <Field label="Class">
              <Input value={String(inspector.values.className ?? "")} onChange={event => commit(applySelectedPatch(state, { className: event.target.value }))} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
            </Field>
          ) : null}
          {inspector.controls.includes("width") && inspector.kind === "column" ? (
            <NumberField
              label={`${state.device} width %`}
              value={Number((inspector.values.width as Record<string, number>)[state.device] ?? 100)}
              onChange={width => {
                const parent = state.document.graph.pages[state.stepKey];
                const row = parent?.sections.flatMap(section => section.rows).find(row => row.columns.some(column => column.id === inspector.id));
                if (!row) return;
                const widths = row.columns.map(column => (column.id === inspector.id ? width : column.widths[state.device]));
                commit(resizeSelectedRow(state, row.id, widths));
              }}
            />
          ) : null}
          {inspector.controls.includes("columns") && inspector.kind === "row" ? (
            <div className="space-y-2">
              <p className="text-sm font-bold">Column widths</p>
              {(inspector.values.columns as number[]).map((width, index) => (
                <NumberField
                  key={`${inspector.id}-${index}`}
                  label={`Col ${index + 1}`}
                  value={width}
                  onChange={next => {
                    const widths = [...(inspector.values.columns as number[])];
                    widths[index] = next;
                    commit(resizeSelectedRow(state, inspector.id, widths));
                  }}
                />
              ))}
            </div>
          ) : null}
          {inspector.controls.includes("elementOrder") && inspector.kind === "column" ? (
            <div className="space-y-2">
              <p className="text-sm font-bold">Element order</p>
              {(inspector.values.elementOrder as string[]).map((id, index) => (
                <div key={id} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-xs font-bold text-muted-foreground">{id}</span>
                  <Button type="button" variant="outline" className="h-8 px-2" disabled={index === 0} onClick={() => commit(reorderSelectedChild(state, id, index - 1))}>Up</Button>
                  <Button type="button" variant="outline" className="h-8 px-2" disabled={index === (inspector.values.elementOrder as string[]).length - 1} onClick={() => commit(reorderSelectedChild(state, id, index + 1))}>Down</Button>
                </div>
              ))}
            </div>
          ) : null}
          {inspector.kind === "element" && ["heading", "text", "button", "phoneCta", "testimonial"].includes(String(inspector.values.type)) ? (
            <Field label="Inline text">
              <Input
                value={String((inspector.values.props as { text?: string; label?: string; quote?: string }).text ?? (inspector.values.props as { label?: string }).label ?? (inspector.values.props as { quote?: string }).quote ?? "")}
                onChange={event => commit(setSelectedText(state, event.target.value))}
                className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
              />
            </Field>
          ) : null}
          {inspector.controls.includes("typography") && inspector.kind === "element" ? (
            <>
              <NumberField
                label="Font size"
                value={Number(((inspector.values.styles as { fontSize?: Record<string, number> }).fontSize ?? {})[state.device] ?? (inspector.values.styles as { fontSize?: { desktop?: number } }).fontSize?.desktop ?? 16)}
                onChange={fontSize => {
                  const styles = inspector.values.styles as { fontSize?: Record<string, number> };
                  commit(applySelectedPatch(state, { styles: { ...styles, fontSize: { ...styles.fontSize, [state.device]: fontSize } } }));
                }}
              />
              <NumberField
                label="Font weight"
                value={Number((inspector.values.styles as { fontWeight?: number }).fontWeight ?? 500)}
                onChange={fontWeight => commit(applySelectedPatch(state, { styles: { ...(inspector.values.styles as object), fontWeight } }))}
              />
            </>
          ) : null}
          {inspector.controls.includes("color") && inspector.kind === "element" ? (
            <Field label="Color">
              <Input
                value={String((inspector.values.styles as { color?: string }).color ?? "")}
                onChange={event => commit(applySelectedPatch(state, { styles: { ...(inspector.values.styles as object), color: event.target.value } }))}
                className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
              />
            </Field>
          ) : null}
          {inspector.controls.includes("action") && inspector.kind === "element" && (inspector.values.type === "button" || inspector.values.type === "phoneCta") ? (
            <>
              <SelectField
                label="Button action"
                value={String((inspector.values.action as ButtonAction | undefined)?.type ?? "nextStep")}
                options={BUTTON_ACTION_TYPES.map(type => ({ value: type, label: type }))}
                onChange={type => {
                  const action: ButtonAction =
                    type === "url"
                      ? { type: "url", href: "", openInNewTab: true }
                      : type === "phone"
                        ? { type: "phone", tel: "" }
                        : type === "formSubmit"
                          ? { type: "formSubmit", formId: "lead-form" }
                          : type === "booking"
                            ? { type: "booking" }
                            : { type: "nextStep" };
                  commit(setSelectedAction(state, action));
                }}
              />
              {(inspector.values.action as ButtonAction | undefined)?.type === "url" ? (
                <Field label="URL">
                  <Input
                    value={(inspector.values.action as { href?: string }).href ?? ""}
                    onChange={event => commit(setSelectedAction(state, { type: "url", href: event.target.value, openInNewTab: true }))}
                    className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
                  />
                </Field>
              ) : null}
              {(inspector.values.action as ButtonAction | undefined)?.type === "phone" ? (
                <Field label="Phone">
                  <Input
                    value={(inspector.values.action as { tel?: string }).tel ?? ""}
                    onChange={event => commit(setSelectedAction(state, { type: "phone", tel: event.target.value }))}
                    className="h-10 rounded-xl border-white/10 bg-white/[0.03]"
                  />
                </Field>
              ) : null}
            </>
          ) : null}
          {inspector.kind === "element" && (inspector.values.type as string) === "image" ? (
            <ImageUploadCard
              label="Image"
              guidance="Uses the existing media upload flow."
              busy={requestUpload.isPending || completeUpload.isPending}
              onFile={file => {
                void uploadAssetDirectly(file, { clientId, assetKind: "client", slot: "product" }, {
                  requestUpload: input => requestUpload.mutateAsync({
                    clientId: input.clientId,
                    assetKind: "client",
                    slot: "product",
                    originalFilename: input.originalFilename,
                    mimeType: input.mimeType,
                    sizeBytes: input.sizeBytes,
                  }),
                  completeUpload: input => completeUpload.mutateAsync(input),
                  fetchFn: fetch,
                }).then(result => {
                  commit(attachSelectedMedia(state, {
                    url: (result as { storageUrl?: string }).storageUrl ?? "",
                    filename: file.name,
                    assetId: (result as { assetId?: string }).assetId,
                  }));
                });
              }}
            />
          ) : null}
          {inspector.controls.includes("visibility") && inspector.values.visibility ? (
            <VisibilityFields
              value={inspector.values.visibility as DeviceVisibility}
              onChange={visibility => commit(setSelectedVisibility(state, visibility))}
            />
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => commit(studioHotkey(state, "d", { meta: true }))}>
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => commit(studioHotkey(state, "Delete", {}))}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
          {inspector.controls.includes("saveReusable") ? (
            <Button
              type="button"
              className="w-full rounded-xl bg-cyan-400 font-extrabold text-slate-950"
              onClick={() => commit(saveSelectedReusable(state, "Reusable section"))}
            >
              Save reusable
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm font-medium text-muted-foreground">Select a section, row, column, or element.</p>
      )}

      <div className="space-y-3 border-t border-white/8 pt-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Global funnel styles</p>
        <Field label="Heading font">
          <Input value={globals.fonts.heading} onChange={event => commit(patchGlobalStyles(state, { fonts: { ...globals.fonts, heading: event.target.value } }))} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
        </Field>
        <Field label="Body font">
          <Input value={globals.fonts.body} onChange={event => commit(patchGlobalStyles(state, { fonts: { ...globals.fonts, body: event.target.value } }))} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
        </Field>
        <Field label="Primary color">
          <Input value={globals.colors.primary} onChange={event => commit(patchGlobalStyles(state, { colors: { ...globals.colors, primary: event.target.value } }))} className="h-10 rounded-xl border-white/10 bg-white/[0.03]" />
        </Field>
        <NumberField label="Boxed max width" value={globals.containers.boxedMaxWidth} onChange={boxedMaxWidth => commit(patchGlobalStyles(state, { containers: { ...globals.containers, boxedMaxWidth } }))} />
      </div>

      <div className="space-y-3 border-t border-white/8 pt-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-300">Client integrations</p>
        <p className="text-xs font-medium text-muted-foreground">
          Presence from ClientIntegrationProfile for client {clientId}. Entered on Clients → Integrations. No secret values here.
        </p>
        {presence.map(group => (
          <div key={group.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="text-sm font-extrabold">{group.label}</p>
            <ul className="mt-2 space-y-1">
              {group.fields.map(field => (
                <li key={field.key} className="flex items-center justify-between text-xs font-bold">
                  <span>{field.key}</span>
                  <span className={field.presence === "SET" ? "text-cyan-300" : "text-muted-foreground"}>{field.presence}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Funnel ready: {profile.readiness.funnelReady ? "yes" : "no"}
        </p>
      </div>
      <p className="sr-only">Graph revision {state.document.graph.version} undo {String(canRedoStudio(state))}</p>
    </aside>
  );
}
