import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ASTRO_INTEGRATION_FIELDS,
  ASTRO_INTEGRATION_VALUES,
  type AstroClientConfigInput,
  type AstroIntegration,
  type WranglerSecretName,
} from "@shared/astroConfig";
import { type ConfigReadiness } from "@shared/astroConfigReadiness";
import { summarizeRuntimeConfiguration } from "@shared/operationalSummary";
import { CloudCog, KeyRound } from "lucide-react";
import { ConfigSection, SectionBody } from "./ConfigSection";

const INTEGRATION_LABELS: Record<AstroIntegration, string> = {
  d1: "Cloudflare D1",
  r2: "Cloudflare R2",
  ghl: "GoHighLevel",
  meta: "Meta",
  zaraz: "Cloudflare Zaraz",
  sentry: "Sentry",
};

export function TechnicalTab({
  value,
  readiness,
  onChange,
  secretStatus,
  onOpenClientIntegrations,
}: {
  value: AstroClientConfigInput;
  readiness: ConfigReadiness;
  onChange: (next: AstroClientConfigInput) => void;
  secretStatus: Record<WranglerSecretName, boolean>;
  onOpenClientIntegrations: () => void;
}) {
  const updateIntegration = (
    name: AstroIntegration,
    patch: Partial<AstroClientConfigInput["integrations"][AstroIntegration]>,
  ) =>
    onChange({
      ...value,
      integrations: {
        ...value.integrations,
        [name]: { ...value.integrations[name], ...patch },
      },
    });

  const enabledIntegrations = ASTRO_INTEGRATION_VALUES.filter(
    name => value.integrations[name].enabled,
  ).length;
  const credentials = readiness.sections.clientIntegrations;

  return (
    <div className="space-y-3">
      <ConfigSection
        icon={CloudCog}
        title="Integrations"
        description="Turn on only the services this site uses. Setup fields appear automatically."
        readiness={readiness.sections.integrations}
        toolbar={
          <span className="text-xs tabular-nums text-muted-foreground">
            {enabledIntegrations} of {ASTRO_INTEGRATION_VALUES.length} enabled
          </span>
        }
      >
        <SectionBody>
          <div className="grid gap-4 lg:grid-cols-2">
            {ASTRO_INTEGRATION_VALUES.map(name => {
              const integration = value.integrations[name];
              const integrationConfig = integration.config as Record<string, string>;
              const fields = Object.entries(ASTRO_INTEGRATION_FIELDS[name]);
              return (
                <div key={name} className="rounded-lg border border-border bg-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-tight">
                        {INTEGRATION_LABELS[name]}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {integration.enabled ? "Enabled" : "Not used"}
                      </p>
                    </div>
                    <Switch
                      checked={integration.enabled}
                      onCheckedChange={enabled => updateIntegration(name, { enabled })}
                    />
                  </div>
                  {integration.enabled && fields.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {fields.map(([key, label]) => (
                        <label key={key} className="block space-y-1.5">
                          <span className="text-xs font-semibold">{label}</span>
                          <Input
                            value={integrationConfig[key] ?? ""}
                            onChange={event =>
                              updateIntegration(name, {
                                config: { ...integrationConfig, [key]: event.target.value },
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ) : integration.enabled ? (
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      Client identifiers and protected values are managed once in Client
                      integrations below.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SectionBody>
      </ConfigSection>

      <ConfigSection
        icon={KeyRound}
        title="Client integrations"
        description="Enter these values once at the client level. The website and every funnel reuse the same protected profile."
        readiness={credentials}
      >
        <SectionBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">
              {credentials.incomplete > 0
                ? `${credentials.incomplete} of ${credentials.requiredTotal} still needed for the integrations this site has switched on.`
                : "Every credential this site needs is set."}
            </p>
            <p className="text-xs text-muted-foreground">
              {summarizeRuntimeConfiguration(secretStatus).label}, shared with this client's
              funnels.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={onOpenClientIntegrations}
            className="h-9 shrink-0 text-xs font-semibold"
          >
            Open client integrations
          </Button>
        </SectionBody>
      </ConfigSection>
    </div>
  );
}
