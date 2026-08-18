import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { integrationsRoute } from "@/lib/workspaceNavigation";
import { publicErrorMessage } from "@shared/safePublicError";
import { trpc } from "@/lib/trpc";
import { WRANGLER_SECRET_DESCRIPTIONS } from "@shared/astroConfig";
import { integrationPresenceRows } from "@shared/paidFunnel/integrationPresence";
import {
  CLIENT_INTEGRATION_IDENTIFIER_KEYS,
  CLIENT_INTEGRATION_FIELD_LABELS,
  CLIENT_INTEGRATION_SECRET_KEYS,
  clientIntegrationFieldError,
  isIdentifierKey,
  isSecretKey,
  type ClientIntegrationIdentifierKey,
  type ClientIntegrationProfileDto,
  type ClientIntegrationSecretKey,
} from "@shared/clientIntegrationProfile";
import { integrationPresenceTone } from "@shared/operationalSummary";
import { AlertCircle, ArrowLeft, Loader2, PlugZap, RefreshCw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type IdentifierDrafts = Record<ClientIntegrationIdentifierKey, string>;
type SecretDrafts = Partial<Record<ClientIntegrationSecretKey, string>>;

function identifierDraftsFrom(dto: ClientIntegrationProfileDto): IdentifierDrafts {
  return {
    GHL_LOCATION_ID: dto.identifiers.GHL_LOCATION_ID ?? "",
    GOOGLE_SHEETS_ID: dto.identifiers.GOOGLE_SHEETS_ID ?? "",
    META_PIXEL_ID: dto.identifiers.META_PIXEL_ID ?? "",
  };
}

function IntegrationEditor({ dto }: { dto: ClientIntegrationProfileDto }) {
  const utils = trpc.useUtils();
  const [identifiers, setIdentifiers] = useState<IdentifierDrafts>(() =>
    identifierDraftsFrom(dto),
  );
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<Date | null>(dto.lastUpdated);
  const [secrets, setSecrets] = useState<SecretDrafts>({});
  const [clearSecrets, setClearSecrets] = useState<ClientIntegrationSecretKey[]>([]);
  const [rotateStageWebhookSecret, setRotateStageWebhookSecret] = useState(false);
  const groups = integrationPresenceRows(dto);
  const identifiersChanged = useMemo(
    () =>
      CLIENT_INTEGRATION_IDENTIFIER_KEYS.some(
        key => identifiers[key].trim() !== (dto.identifiers[key] ?? ""),
      ),
    [dto.identifiers, identifiers],
  );
  const hasSecretChanges = CLIENT_INTEGRATION_SECRET_KEYS.some(
    key => Boolean(secrets[key]?.trim()),
  );
  const fieldErrors = useMemo(() => {
    const errors = new Map<string, string>();
    for (const key of CLIENT_INTEGRATION_IDENTIFIER_KEYS) {
      const error = clientIntegrationFieldError(key, identifiers[key]);
      if (error) errors.set(key, error);
    }
    for (const key of CLIENT_INTEGRATION_SECRET_KEYS) {
      const value = secrets[key];
      if (!value?.trim()) continue;
      const error = clientIntegrationFieldError(key, value);
      if (error) errors.set(key, error);
    }
    return errors;
  }, [identifiers, secrets]);
  const saveMutation = trpc.clients.saveIntegrationProfile.useMutation({
    onSuccess: async saved => {
      setIdentifiers(identifierDraftsFrom(saved));
      setBaseUpdatedAt(saved.lastUpdated);
      setSecrets({});
      setClearSecrets([]);
      setRotateStageWebhookSecret(false);
      utils.clients.getIntegrationProfile.setData({ clientId: dto.clientId }, saved);
      await Promise.all([
        utils.clients.list.invalidate(),
        utils.astroConfig.get.invalidate({ clientId: dto.clientId }),
      ]);
      toast.success("Client integrations saved for the website and every funnel.");
    },
    onError: async error => {
      if (error.data?.code === "CONFLICT") {
        try {
          const refreshed = await utils.clients.getIntegrationProfile.fetch({
            clientId: dto.clientId,
          });
          setIdentifiers(identifierDraftsFrom(refreshed));
          setBaseUpdatedAt(refreshed.lastUpdated);
          toast.error(
            "This client changed in another session. Latest identifiers were reloaded; unsaved secret replacements were kept.",
          );
        } catch {
          await utils.clients.getIntegrationProfile.invalidate({ clientId: dto.clientId });
          toast.error("This client changed in another session. Reload before saving again.");
        }
        return;
      }
      toast.error(publicErrorMessage(error.message, "Integrations could not be saved."));
    },
  });

  const save = () => {
    if (fieldErrors.size > 0) {
      toast.error("Fix the highlighted integration fields before saving.");
      return;
    }
    const replaceSecrets = Object.fromEntries(
      CLIENT_INTEGRATION_SECRET_KEYS.flatMap(key => {
        const value = secrets[key]?.trim();
        return value ? [[key, value]] : [];
      }),
    ) as Partial<Record<ClientIntegrationSecretKey, string>>;
    const changedIdentifiers = Object.fromEntries(
      CLIENT_INTEGRATION_IDENTIFIER_KEYS.flatMap(key =>
        identifiers[key].trim() !== (dto.identifiers[key] ?? "")
          ? [[key, identifiers[key].trim() || null]]
          : [],
      ),
    ) as Partial<Record<ClientIntegrationIdentifierKey, string | null>>;
    saveMutation.mutate({
      clientId: dto.clientId,
      // Keep the version captured with these drafts. A background refetch must
      // not bless stale identifiers with a newer optimistic-lock token.
      expectedUpdatedAt: baseUpdatedAt,
      identifiers: changedIdentifiers,
      replaceSecrets,
      clearSecrets,
      rotateStageWebhookSecret: rotateStageWebhookSecret || undefined,
    });
  };

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-muted-foreground">Website ready</p>
          <p className="mt-1 text-xl font-extrabold">{dto.readiness.websiteReady ? "SET" : "NOT SET"}</p>
        </Card>
        <Card className="border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-muted-foreground">Every funnel ready</p>
          <p className="mt-1 text-xl font-extrabold">{dto.readiness.funnelReady ? "SET" : "NOT SET"}</p>
        </Card>
        <Card className="border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-muted-foreground">Reconciliation</p>
          <p className="mt-1 text-xl font-extrabold capitalize">{dto.reconciliationStatus}</p>
        </Card>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map(group => (
          <Card key={group.id} className="border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">{group.label}</h2>
            <div className="mt-4 space-y-4">
              {group.fields.map(field => {
                const identifierKey = isIdentifierKey(field.key) ? field.key : null;
                const secretKey = isSecretKey(field.key) ? field.key : null;
                if (!identifierKey && !secretKey) return null;
                const value = identifierKey
                  ? identifiers[identifierKey]
                  : (secrets[secretKey!] ?? "");
                const presence =
                  field.presence ??
                  (identifierKey && identifiers[identifierKey].trim() ? "SET" : "NOT SET");
                const tone = integrationPresenceTone(field.key, presence);
                return (
                  <div key={field.key} className="space-y-2">
                    <label className="block space-y-2">
                      <span className="flex items-center justify-between gap-3 text-xs font-extrabold">
                        <span className="truncate text-slate-700">{CLIENT_INTEGRATION_FIELD_LABELS[field.key as keyof typeof CLIENT_INTEGRATION_FIELD_LABELS]}</span>
                        <span
                          className={
                            tone === "set"
                              ? "text-emerald-600"
                              : tone === "optional"
                                ? "text-muted-foreground"
                                : "text-red-600"
                          }
                        >
                          {tone === "optional" ? "Optional" : presence}
                        </span>
                      </span>
                      <Input
                        aria-label={field.key}
                        type={secretKey ? "password" : "text"}
                        autoComplete={secretKey ? "new-password" : "off"}
                        disabled={Boolean(secretKey && clearSecrets.includes(secretKey))}
                        value={value}
                        placeholder={
                          secretKey && presence === "SET"
                            ? "Stored — enter a new value to replace"
                            : "Enter value"
                        }
                        onChange={event => {
                          if (identifierKey) {
                            setIdentifiers(current => ({
                              ...current,
                              [identifierKey]: event.target.value,
                            }));
                          } else if (secretKey) {
                            setSecrets(current => ({
                              ...current,
                              [secretKey]: event.target.value,
                            }));
                            setClearSecrets(current => current.filter(key => key !== secretKey));
                            if (secretKey === "STAGE_WEBHOOK_SECRET") {
                              setRotateStageWebhookSecret(false);
                            }
                          }
                        }}
                        aria-invalid={fieldErrors.has(field.key)}
                        aria-describedby={fieldErrors.has(field.key) ? `${field.key}-error` : undefined}
                        className="h-11 rounded-xl border-slate-300 bg-white font-mono text-sm text-slate-950"
                      />
                      {fieldErrors.has(field.key) ? (
                        <span id={`${field.key}-error`} role="alert" className="block text-xs font-semibold text-red-600">
                          {fieldErrors.get(field.key)}
                        </span>
                      ) : null}
                      <span className="block text-[11px] font-medium text-muted-foreground">
                        {WRANGLER_SECRET_DESCRIPTIONS[identifierKey ?? secretKey!]}
                      </span>
                      {secretKey ? (
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          Leave blank to keep the stored value. Stored values are never returned.
                        </span>
                      ) : null}
                    </label>
                    {secretKey && presence === "SET" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          const willClear = !clearSecrets.includes(secretKey);
                          setClearSecrets(current =>
                            willClear
                              ? [...current.filter(key => key !== secretKey), secretKey]
                              : current.filter(key => key !== secretKey),
                          );
                          if (willClear) {
                            setSecrets(current => ({ ...current, [secretKey]: "" }));
                            if (secretKey === "STAGE_WEBHOOK_SECRET") {
                              setRotateStageWebhookSecret(false);
                            }
                          }
                        }}
                        className="h-8 px-2 text-xs font-extrabold text-muted-foreground"
                      >
                        {clearSecrets.includes(secretKey) ? "Keep stored value" : "Clear on save"}
                      </Button>
                    ) : null}
                    {secretKey === "STAGE_WEBHOOK_SECRET" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSecrets(current => ({ ...current, STAGE_WEBHOOK_SECRET: "" }));
                          setClearSecrets(current =>
                            current.filter(key => key !== "STAGE_WEBHOOK_SECRET"),
                          );
                          setRotateStageWebhookSecret(true);
                        }}
                        className="h-9 gap-2 text-xs font-extrabold"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {rotateStageWebhookSecret ? "Will generate on save" : "Generate / rotate"}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <Button
          type="button"
          onClick={save}
          disabled={
            saveMutation.isPending ||
            fieldErrors.size > 0 ||
            (!identifiersChanged &&
              !hasSecretChanges &&
              !rotateStageWebhookSecret &&
              clearSecrets.length === 0)
          }
          className="h-12 gap-2 rounded-xl bg-blue-600 px-6 font-extrabold text-white hover:bg-blue-700"
        >
          {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Save once for website + funnels
        </Button>
      </div>
    </>
  );
}

export default function ClientIntegrationsPage({ clientId }: { clientId: number }) {
  const [, setLocation] = useLocation();
  const query = trpc.clients.getIntegrationProfile.useQuery({ clientId });

  if (query.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-8 text-center">
        <AlertCircle className="mx-auto h-9 w-9 text-red-300" />
        <h1 className="mt-4 text-2xl font-extrabold">Integrations could not be loaded</h1>
        <p className="mt-2 text-muted-foreground">{publicErrorMessage(query.error?.message, "Try again. If this keeps happening, ask Alex for help.")}</p>
      </div>
    );
  }

  const dto = query.data;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_88%_-10%,rgba(37,99,235,0.10),transparent_35%),white] p-6 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setLocation(`/workspace/${clientId}/settings`)}
          className="-ml-3 h-11 gap-2 text-base font-bold text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to settings
        </Button>
        <div className="mt-3 flex items-start gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <PlugZap className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">Client integrations</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.03em]">Enter once. Reuse everywhere.</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground">
              These client-level values power the website and every funnel. Secret fields stay blank after saving and are never returned. Path: {integrationsRoute(clientId)}
            </p>
          </div>
        </div>
      </header>

      <IntegrationEditor dto={dto} />
    </div>
  );
}
