import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  SIMPLE_FORM_TEMPLATE_LOGO_URL,
  SIMPLE_FORM_TEMPLATE_PRODUCTS,
  parseServiceAreaZips,
  type SimpleFormImageSource,
  type SimpleFormOperatorConfig,
  type SimpleFormStoredRecord,
} from "@shared/simpleFormConfig";
import type { SimpleFormSecretGuide } from "@shared/simpleFormContract";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  Loader2,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-extrabold">{label}</span>
      {children}
      {hint ? <span className="block text-xs font-semibold text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/8 bg-card/70 p-5">
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function SecretField({
  guide,
  present,
  value,
  onChange,
  extra,
}: {
  guide: SimpleFormSecretGuide;
  present: boolean;
  value: string;
  onChange: (value: string) => void;
  extra?: ReactNode;
}) {
  const requirement =
    guide.requirement === "required"
      ? "Required"
      : guide.requirement === "testing-only"
        ? "Testing Only"
        : guide.requirement === "generated"
          ? "Generated"
          : "Optional";
  return (
    <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-extrabold">{guide.friendlyName}</p>
          <p className="mt-1 font-mono text-xs text-cyan-300">{guide.runtimeKey}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
          {requirement}
        </span>
      </div>
      <p className="text-sm font-medium text-muted-foreground">Required for: {guide.requiredFor}</p>
      {guide.requirement === "generated" ? (
        extra
      ) : (
        <Input
          type="password"
          autoComplete="off"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={present ? "Saved — paste a new value to replace" : "Paste value"}
          className="h-12 rounded-xl border-white/10 bg-white/[0.035] font-mono text-sm"
        />
      )}
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Where do I find this?</p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">{guide.whereToFind}</p>
        <a
          href={guide.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold text-cyan-300"
        >
          Official documentation
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function ImageSourcePicker({
  label,
  source,
  previewUrl,
  assets,
  onChange,
}: {
  label: string;
  source: SimpleFormImageSource;
  previewUrl: string;
  assets: Array<{ slot: string; storageUrl: string; filename: string }>;
  onChange: (source: SimpleFormImageSource) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-extrabold">{label}</p>
      <RadioGroup
        value={source.mode}
        onValueChange={value => {
          if (value === "template") onChange({ mode: "template" });
          else onChange({ mode: "client-media", slot: source.mode === "client-media" ? source.slot : assets[0]?.slot ?? "logo" });
        }}
        className="gap-3"
      >
        <label className="flex items-start gap-3 rounded-xl border border-white/8 p-3">
          <RadioGroupItem value="template" />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">Use Template Default</p>
            <img src={previewUrl} alt="" className="mt-3 max-h-28 rounded-lg object-cover" />
          </div>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-white/8 p-3">
          <RadioGroupItem value="client-media" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-extrabold">Use Client Media</p>
            {assets.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground">Upload a photo in Media first.</p>
            ) : (
              <select
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm font-bold"
                value={source.mode === "client-media" ? source.slot : assets[0]?.slot}
                onChange={event => onChange({ mode: "client-media", slot: event.target.value })}
              >
                {assets.map(asset => (
                  <option key={asset.slot} value={asset.slot}>
                    {asset.slot} · {asset.filename}
                  </option>
                ))}
              </select>
            )}
          </div>
        </label>
      </RadioGroup>
    </div>
  );
}

export function SimpleFormFunnelEditor({
  clientId,
  funnelId,
  onBack,
}: {
  clientId: number;
  funnelId: number;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const query = trpc.simpleForm.get.useQuery({ clientId, funnelId });
  const [record, setRecord] = useState<SimpleFormStoredRecord | null>(null);
  const [zipText, setZipText] = useState("");
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    setRecord(query.data.record);
    setZipText(query.data.record.config.serviceAreaZipCodes.join("\n"));
    setSecretDrafts({});
    setRevealedSecret(null);
  }, [query.data]);

  const saveMutation = trpc.simpleForm.save.useMutation({
    onSuccess: async view => {
      await utils.simpleForm.get.invalidate({ clientId, funnelId });
      setRecord(view.record);
      toast.success("Funnel settings saved.");
    },
    onError: error => toast.error(error.message),
  });
  const secretsMutation = trpc.simpleForm.saveSecrets.useMutation({
    onSuccess: async () => {
      await utils.simpleForm.get.invalidate({ clientId, funnelId });
      setSecretDrafts({});
      toast.success("Secrets saved.");
    },
    onError: error => toast.error(error.message),
  });
  const revealMutation = trpc.simpleForm.revealCrmCallbackSecret.useMutation({
    onSuccess: result => setRevealedSecret(result.value),
    onError: error => toast.error(error.message),
  });

  const config = record?.config;
  const patchConfig = (partial: Partial<SimpleFormOperatorConfig>) => {
    if (!record) return;
    setRecord({ ...record, config: { ...record.config, ...partial } });
  };

  const readiness = query.data?.readiness;
  const assets = query.data?.assets ?? [];
  const guides = useMemo(() => query.data?.secretGuides ?? [], [query.data?.secretGuides]);

  if (query.isLoading || !record || !config) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  if (query.error) {
    return <div className="rounded-2xl border border-red-400/20 p-5 font-bold text-red-200">{query.error.message}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-extrabold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          All funnels
        </button>
        <Button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() =>
            saveMutation.mutate({
              clientId,
              funnelId,
              record: {
                ...record,
                config: {
                  ...config,
                  serviceAreaZipCodes: parseServiceAreaZips(zipText),
                },
              },
            })
          }
          className="h-11 gap-2 rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </Button>
      </div>

      <section className="rounded-2xl border border-white/8 bg-card/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">Readiness</p>
            <h2 className="mt-1 text-2xl font-extrabold">{query.data?.funnel.name}</h2>
          </div>
          <div className="text-right">
            <p className="text-sm font-extrabold text-cyan-300">
              {readiness?.configurationReady ? "CONFIGURATION READY" : "Not ready"}
            </p>
            <p className="text-xs font-bold text-muted-foreground">Not published · Publish is not built yet</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(readiness?.sections ?? []).map(section => (
            <div key={section.key} className="rounded-xl border border-white/8 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-extrabold">{section.label}</p>
                {section.ready ? (
                  <span className="inline-flex items-center gap-1 text-sm font-extrabold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Ready
                  </span>
                ) : (
                  <span className="text-sm font-extrabold text-amber-200">Missing</span>
                )}
              </div>
              {!section.ready ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-medium text-muted-foreground">
                  {section.missing.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <Section title="Client">
        <Field label="Business name shown on the funnel">
          <Input
            value={config.client.name}
            onChange={event => patchConfig({ client: { ...config.client, name: event.target.value } })}
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Phone" hint="International format, such as +17015551234">
          <Input
            value={config.client.phone}
            onChange={event => patchConfig({ client: { ...config.client, phone: event.target.value } })}
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <ImageSourcePicker
          label="Logo"
          source={record.imageSources.logo}
          previewUrl={SIMPLE_FORM_TEMPLATE_LOGO_URL}
          assets={assets}
          onChange={logo => setRecord({ ...record, imageSources: { ...record.imageSources, logo } })}
        />
      </Section>

      <Section title="Offer">
        <Field label="Headline">
          <Input
            value={config.offer.headline}
            onChange={event => patchConfig({ offer: { ...config.offer, headline: event.target.value } })}
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Subheadline">
          <Textarea
            value={config.offer.subheadline}
            onChange={event => patchConfig({ offer: { ...config.offer, subheadline: event.target.value } })}
            className="min-h-24 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Qualifying line">
          <Input
            value={config.funnel.qualifyingLine}
            onChange={event =>
              patchConfig({ funnel: { ...config.funnel, qualifyingLine: event.target.value } })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Contact headline">
          <Textarea
            value={config.contact.headline}
            onChange={event => patchConfig({ contact: { ...config.contact, headline: event.target.value } })}
            className="min-h-24 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Thank-you headline">
          <Input
            value={config.thankYou.headline}
            onChange={event => patchConfig({ thankYou: { ...config.thankYou, headline: event.target.value } })}
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Thank-you message">
          <Textarea
            value={config.thankYou.message}
            onChange={event => patchConfig({ thankYou: { ...config.thankYou, message: event.target.value } })}
            className="min-h-24 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
      </Section>

      <Section title="Service Area">
        <Field label="ZIP codes" hint="One ZIP per line. Example: 58701">
          <Textarea
            value={zipText}
            onChange={event => setZipText(event.target.value)}
            className="min-h-36 rounded-xl border-white/10 bg-white/[0.035] font-mono"
          />
        </Field>
        <Field label="ZIP results headline" hint="Must include {city} and {state}">
          <Input
            value={config.geoH1Template}
            onChange={event => patchConfig({ geoH1Template: event.target.value })}
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Out of area headline">
          <Input
            value={config.outOfArea.headline}
            onChange={event => patchConfig({ outOfArea: { ...config.outOfArea, headline: event.target.value } })}
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Out of area message">
          <Textarea
            value={config.outOfArea.message}
            onChange={event => patchConfig({ outOfArea: { ...config.outOfArea, message: event.target.value } })}
            className="min-h-24 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
      </Section>

      <Section title="Meta">
        <Field label="Meta Pixel ID" hint="This is config, not a secret. Numbers only.">
          <Input
            value={config.meta.pixelId}
            onChange={event => patchConfig({ meta: { ...config.meta, pixelId: event.target.value } })}
            className="h-12 rounded-xl border-white/10 bg-white/[0.035] font-mono"
          />
        </Field>
        <Field label="Lead conversion value">
          <Input
            type="number"
            min={0}
            value={config.meta.defaultConversionValue}
            onChange={event =>
              patchConfig({
                meta: { ...config.meta, defaultConversionValue: Number(event.target.value) || 0 },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        {guides
          .filter(guide => guide.runtimeKey === "META_CAPI_ACCESS_TOKEN" || guide.runtimeKey === "META_TEST_EVENT_CODE")
          .map(guide => (
            <SecretField
              key={guide.runtimeKey}
              guide={guide}
              present={Boolean(query.data?.secretStatus[guide.runtimeKey])}
              value={secretDrafts[guide.runtimeKey] ?? ""}
              onChange={value => setSecretDrafts(current => ({ ...current, [guide.runtimeKey]: value }))}
            />
          ))}
        {query.data?.secretStatus.META_TEST_EVENT_CODE ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              secretsMutation.mutate({ clientId, funnelId, clearMetaTestEventCode: true })
            }
            className="h-11 rounded-xl border-amber-300/30 font-extrabold text-amber-200"
          >
            Remove Meta Test Event Code
          </Button>
        ) : null}
      </Section>

      <Section title="GHL">
        {guides
          .filter(guide => guide.runtimeKey === "GHL_WEBHOOK_URL" || guide.runtimeKey === "CRM_CALLBACK_SECRET")
          .map(guide => (
            <SecretField
              key={guide.runtimeKey}
              guide={guide}
              present={Boolean(query.data?.secretStatus[guide.runtimeKey])}
              value={secretDrafts[guide.runtimeKey] ?? ""}
              onChange={value => setSecretDrafts(current => ({ ...current, [guide.runtimeKey]: value }))}
              extra={
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {query.data?.secretStatus.CRM_CALLBACK_SECRET
                      ? "Generated and saved."
                      : "Not generated yet."}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground">
                    Revealing displays the currently stored secret. Keep it private.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => revealMutation.mutate({ clientId, funnelId })}
                      className="h-11 gap-2 rounded-xl font-extrabold"
                    >
                      <Eye className="h-4 w-4" />
                      Reveal secret
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        secretsMutation.mutate({ clientId, funnelId, regenerateCrmCallbackSecret: true })
                      }
                      className="h-11 rounded-xl font-extrabold"
                    >
                      Generate a new secret
                    </Button>
                  </div>
                  {revealedSecret ? (
                    <Input readOnly value={revealedSecret} className="h-12 rounded-xl border-white/10 bg-white/[0.035] font-mono text-sm" />
                  ) : null}
                </div>
              }
            />
          ))}
        <Button
          type="button"
          disabled={secretsMutation.isPending}
          onClick={() =>
            secretsMutation.mutate({
              clientId,
              funnelId,
              META_CAPI_ACCESS_TOKEN: secretDrafts.META_CAPI_ACCESS_TOKEN,
              META_TEST_EVENT_CODE: secretDrafts.META_TEST_EVENT_CODE,
              GHL_WEBHOOK_URL: secretDrafts.GHL_WEBHOOK_URL,
              SUBMISSION_ALERT_WEBHOOK_URL: secretDrafts.SUBMISSION_ALERT_WEBHOOK_URL,
            })
          }
          className="h-11 rounded-xl bg-cyan-400 font-extrabold text-slate-950 hover:bg-cyan-300"
        >
          Save secrets
        </Button>
      </Section>

      <Section title="Inventory">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 p-3">
          <p className="font-extrabold">Show inventory on thank-you</p>
          <Switch
            checked={config.inventory.enabled}
            onCheckedChange={enabled =>
              patchConfig({ inventory: { ...config.inventory, enabled } })
            }
          />
        </div>
        <Field label="Inventory headline">
          <Input
            value={config.inventory.headline}
            onChange={event =>
              patchConfig({ inventory: { ...config.inventory, headline: event.target.value } })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        {config.inventory.products.map((product, index) => (
          <div key={product.id} className="space-y-3 rounded-xl border border-white/8 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-extrabold">Slot {index + 1}</p>
              <label className="flex items-center gap-2 text-sm font-extrabold">
                Active
                <Switch
                  checked={product.active}
                  onCheckedChange={active => {
                    const products = config.inventory.products.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, active } : item,
                    );
                    patchConfig({ inventory: { ...config.inventory, products } });
                  }}
                />
              </label>
            </div>
            <Field label="Name">
              <Input
                value={product.name}
                onChange={event => {
                  const products = config.inventory.products.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, name: event.target.value } : item,
                  );
                  patchConfig({ inventory: { ...config.inventory, products } });
                }}
                className="h-11 rounded-xl border-white/10 bg-white/[0.035]"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={product.description ?? ""}
                onChange={event => {
                  const products = config.inventory.products.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, description: event.target.value } : item,
                  );
                  patchConfig({ inventory: { ...config.inventory, products } });
                }}
                className="min-h-20 rounded-xl border-white/10 bg-white/[0.035]"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Price label">
                <Input
                  value={product.priceLabel ?? ""}
                  onChange={event => {
                    const products = config.inventory.products.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, priceLabel: event.target.value } : item,
                    );
                    patchConfig({ inventory: { ...config.inventory, products } });
                  }}
                  className="h-11 rounded-xl border-white/10 bg-white/[0.035]"
                />
              </Field>
              <Field label="CTA label">
                <Input
                  value={product.ctaLabel}
                  onChange={event => {
                    const products = config.inventory.products.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, ctaLabel: event.target.value } : item,
                    );
                    patchConfig({ inventory: { ...config.inventory, products } });
                  }}
                  className="h-11 rounded-xl border-white/10 bg-white/[0.035]"
                />
              </Field>
            </div>
            <Field label="CTA URL" hint="https://… or tel:+1…">
              <Input
                value={product.ctaUrl}
                onChange={event => {
                  const products = config.inventory.products.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, ctaUrl: event.target.value } : item,
                  );
                  patchConfig({ inventory: { ...config.inventory, products } });
                }}
                className="h-11 rounded-xl border-white/10 bg-white/[0.035]"
              />
            </Field>
            <ImageSourcePicker
              label="Product / Template Image"
              source={record.imageSources.products[index] ?? { mode: "template" }}
              previewUrl={SIMPLE_FORM_TEMPLATE_PRODUCTS[index]?.imageUrl ?? product.imageUrl}
              assets={assets}
              onChange={source => {
                const products = record.imageSources.products.map((item, itemIndex) =>
                  itemIndex === index ? source : item,
                );
                setRecord({ ...record, imageSources: { ...record.imageSources, products } });
              }}
            />
          </div>
        ))}
      </Section>

      <Section title="Consent">
        <Field label="Consent version">
          <Input
            value={config.contact.consent.version}
            onChange={event =>
              patchConfig({
                contact: {
                  ...config.contact,
                  consent: { ...config.contact.consent, version: event.target.value },
                },
              })
            }
            className="h-12 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
        <Field label="Consent text">
          <Textarea
            value={config.contact.consent.text}
            onChange={event =>
              patchConfig({
                contact: {
                  ...config.contact,
                  consent: { ...config.contact.consent, text: event.target.value },
                },
              })
            }
            className="min-h-32 rounded-xl border-white/10 bg-white/[0.035]"
          />
        </Field>
      </Section>

      <Section title="Optional Analytics">
        <Field label="GA4 Measurement ID" hint="Optional. Example: G-ABC1234">
          <Input
            value={config.ga4MeasurementId ?? ""}
            onChange={event => patchConfig({ ga4MeasurementId: event.target.value || undefined })}
            className="h-12 rounded-xl border-white/10 bg-white/[0.035] font-mono"
          />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 p-3">
          <p className="font-extrabold">Google enhanced conversions</p>
          <Switch
            checked={config.googleEnhancedConversions}
            onCheckedChange={googleEnhancedConversions => patchConfig({ googleEnhancedConversions })}
          />
        </div>
        {guides
          .filter(guide => guide.runtimeKey === "SUBMISSION_ALERT_WEBHOOK_URL")
          .map(guide => (
            <SecretField
              key={guide.runtimeKey}
              guide={guide}
              present={Boolean(query.data?.secretStatus[guide.runtimeKey])}
              value={secretDrafts[guide.runtimeKey] ?? ""}
              onChange={value => setSecretDrafts(current => ({ ...current, [guide.runtimeKey]: value }))}
            />
          ))}
      </Section>
    </div>
  );
}
