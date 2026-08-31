import { Disclosure } from "@/components/dashboard/Disclosure";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  parseServiceAreaZips,
  SIMPLE_FORM_TEMPLATE_LOGO_URL,
  type SimpleFormOperatorConfig,
  type SimpleFormStoredRecord,
} from "@shared/simpleFormConfig";
import {
  Field,
  ImageSourcePicker,
  Section,
  ToggleRow,
  type CampaignAsset,
} from "../campaignFields";

/**
 * Everything a template cannot supply for itself: who the client is, what this
 * campaign promises, and where it runs. Wording that already reads well lives
 * under Content, so this step stays short enough to finish in one sitting.
 */
export function CampaignSetupTab({
  record,
  assets,
  zipText,
  onChange,
  onZipTextChange,
}: {
  record: SimpleFormStoredRecord;
  assets: CampaignAsset[];
  zipText: string;
  onChange: (record: SimpleFormStoredRecord) => void;
  onZipTextChange: (zipText: string) => void;
}) {
  const config = record.config;
  const patch = (partial: Partial<SimpleFormOperatorConfig>) =>
    onChange({ ...record, config: { ...config, ...partial } });
  const zipCount = parseServiceAreaZips(zipText).length;

  return (
    <div className="space-y-4">
      <Section title="Business" description="How the client is named and reached.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <Input
              value={config.client.name}
              onChange={event =>
                patch({ client: { ...config.client, name: event.target.value } })
              }
            />
          </Field>
          <Field label="Phone" hint="International format, such as +17015551234.">
            <Input
              value={config.client.phone}
              onChange={event =>
                patch({ client: { ...config.client, phone: event.target.value } })
              }
            />
          </Field>
        </div>
        <ImageSourcePicker
          label="Logo"
          source={record.imageSources.logo}
          previewUrl={SIMPLE_FORM_TEMPLATE_LOGO_URL}
          assets={assets}
          onChange={logo =>
            onChange({ ...record, imageSources: { ...record.imageSources, logo } })
          }
        />
      </Section>

      <Section
        title="Offer"
        description="The promise the ad made, repeated on the first page."
      >
        <Field label="Headline">
          <Input
            value={config.offer.headline}
            onChange={event =>
              patch({ offer: { ...config.offer, headline: event.target.value } })
            }
          />
        </Field>
        <Field label="Subheadline">
          <Textarea
            value={config.offer.subheadline}
            onChange={event =>
              patch({ offer: { ...config.offer, subheadline: event.target.value } })
            }
            className="min-h-20"
          />
        </Field>
        <Field label="Button label" hint="Sits under the ZIP field.">
          <Input
            value={config.funnel.ctaLabel}
            onChange={event =>
              patch({ funnel: { ...config.funnel, ctaLabel: event.target.value } })
            }
          />
        </Field>
      </Section>

      <Section
        title="Service area"
        description="A visitor outside these ZIP codes sees the out-of-area page."
      >
        <Field label="ZIP codes" hint={`One per line. ${zipCount} entered.`}>
          <Textarea
            value={zipText}
            onChange={event => onZipTextChange(event.target.value)}
            className="min-h-32 font-mono"
          />
        </Field>
        <Field
          label="In-area headline"
          hint="Keep {city} and {state}; both are filled in from the ZIP."
        >
          <Input
            value={config.geoH1Template}
            onChange={event => patch({ geoH1Template: event.target.value })}
          />
        </Field>
      </Section>

      <Section title="What you collect">
        <ToggleRow
          label="Require an email address"
          hint="First name, last name and phone are always collected."
          checked={config.contact.emailRequired}
          onCheckedChange={emailRequired =>
            patch({ contact: { ...config.contact, emailRequired } })
          }
        />
      </Section>

      <Disclosure
        title="Tracking"
        meta={config.ga4MeasurementId ? "GA4 connected" : "Meta only"}
      >
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            The Meta pixel, CRM and sheet come from the client's integrations.
            These two settings are the only ones a campaign decides for itself.
          </p>
          <Field
            label="Lead conversion value"
            hint="What one lead is worth before the CRM reports the real outcome."
          >
            <Input
              type="number"
              min={0}
              value={config.meta.defaultConversionValue}
              onChange={event =>
                patch({
                  meta: {
                    ...config.meta,
                    defaultConversionValue: Number(event.target.value) || 0,
                  },
                })
              }
            />
          </Field>
          <Field label="GA4 measurement ID" hint="Optional. Example: G-ABC1234">
            <Input
              value={config.ga4MeasurementId ?? ""}
              onChange={event => {
                const next = event.target.value;
                // Enhanced conversions need a measurement ID, so clearing the
                // ID switches them off instead of leaving publish blocked.
                patch({
                  ga4MeasurementId: next.trim() ? next : undefined,
                  googleEnhancedConversions: next.trim()
                    ? config.googleEnhancedConversions
                    : false,
                });
              }}
              className="font-mono"
            />
          </Field>
          <ToggleRow
            label="Google enhanced conversions"
            hint={
              config.ga4MeasurementId
                ? undefined
                : "Add a GA4 measurement ID to enable this."
            }
            checked={config.googleEnhancedConversions}
            disabled={!config.ga4MeasurementId}
            onCheckedChange={googleEnhancedConversions =>
              patch({ googleEnhancedConversions })
            }
          />
        </div>
      </Disclosure>
    </div>
  );
}
