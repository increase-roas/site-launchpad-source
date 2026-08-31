import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  SimpleFormOperatorConfig,
  SimpleFormStoredRecord,
} from "@shared/simpleFormConfig";
import { Field, Section } from "../campaignFields";

export function CampaignLeadFormTab({
  record,
  zipText,
  onChange,
  onZipTextChange,
}: {
  record: SimpleFormStoredRecord;
  zipText: string;
  onChange: (record: SimpleFormStoredRecord) => void;
  onZipTextChange: (zipText: string) => void;
}) {
  const config = record.config;
  const patch = (partial: Partial<SimpleFormOperatorConfig>) =>
    onChange({ ...record, config: { ...config, ...partial } });
  const zipCount = zipText
    .split(/[\s,]+/)
    .map(zip => zip.trim())
    .filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Section title="Service area">
        <Field label="ZIP codes" hint={`One per line. ${zipCount} entered.`}>
          <Textarea
            value={zipText}
            onChange={event => onZipTextChange(event.target.value)}
            className="min-h-32 font-mono"
          />
        </Field>
        <Field label="In-area headline" hint="Must include {city} and {state}.">
          <Input
            value={config.geoH1Template}
            onChange={event => patch({ geoH1Template: event.target.value })}
          />
        </Field>
        <Field label="Out-of-area headline">
          <Input
            value={config.outOfArea.headline}
            onChange={event =>
              patch({ outOfArea: { ...config.outOfArea, headline: event.target.value } })
            }
          />
        </Field>
        <Field label="Out-of-area message">
          <Textarea
            value={config.outOfArea.message}
            onChange={event =>
              patch({ outOfArea: { ...config.outOfArea, message: event.target.value } })
            }
            className="min-h-20"
          />
        </Field>
      </Section>

      <Section title="Contact step">
        <Field label="Headline">
          <Textarea
            value={config.contact.headline}
            onChange={event =>
              patch({ contact: { ...config.contact, headline: event.target.value } })
            }
            className="min-h-16"
          />
        </Field>
        <Field label="Submit button label">
          <Input
            value={config.contact.submitLabel}
            onChange={event =>
              patch({ contact: { ...config.contact, submitLabel: event.target.value } })
            }
          />
        </Field>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold">Collected on this step</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            First name, last name and phone are always collected.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold">Require an email address</p>
            <Switch
              checked={config.contact.emailRequired}
              onCheckedChange={emailRequired =>
                patch({ contact: { ...config.contact, emailRequired } })
              }
            />
          </div>
        </div>
      </Section>

      <Section title="Consent" description="Stored with every lead.">
        <Field label="Consent text">
          <Textarea
            value={config.contact.consent.text}
            onChange={event =>
              patch({
                contact: {
                  ...config.contact,
                  consent: { ...config.contact.consent, text: event.target.value },
                },
              })
            }
            className="min-h-28"
          />
        </Field>
        <Field label="Consent version" hint="Change this when the wording changes.">
          <Input
            value={config.contact.consent.version}
            onChange={event =>
              patch({
                contact: {
                  ...config.contact,
                  consent: { ...config.contact.consent, version: event.target.value },
                },
              })
            }
          />
        </Field>
      </Section>
    </div>
  );
}
