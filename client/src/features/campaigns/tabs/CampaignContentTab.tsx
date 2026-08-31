import { Disclosure } from "@/components/dashboard/Disclosure";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  SimpleFormOperatorConfig,
  SimpleFormStoredRecord,
} from "@shared/simpleFormConfig";
import { Field, type CampaignAsset } from "../campaignFields";
import { CampaignInventoryFields } from "./CampaignInventoryFields";

/**
 * Wording the template already ships, grouped by the page a visitor reads it
 * on and collapsed by default. A campaign publishes without anyone opening
 * this step, so nothing here is presented as work.
 */
export function CampaignContentTab({
  record,
  assets,
  onChange,
}: {
  record: SimpleFormStoredRecord;
  assets: CampaignAsset[];
  onChange: (record: SimpleFormStoredRecord) => void;
}) {
  const config = record.config;
  const patch = (partial: Partial<SimpleFormOperatorConfig>) =>
    onChange({ ...record, config: { ...config, ...partial } });

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Every line below is written by the template and ready to publish. Open a
        page to reword it for this client.
      </p>

      <Disclosure title="ZIP page" meta="Reassurance under the button">
        <div className="space-y-4">
          <Field
            label="Qualifying line"
            hint="Sits under the button so a visitor knows who this is for."
          >
            <Input
              value={config.funnel.qualifyingLine}
              onChange={event =>
                patch({
                  funnel: { ...config.funnel, qualifyingLine: event.target.value },
                })
              }
            />
          </Field>
          <Field label="Trust statement" hint="What happens after the form is sent.">
            <Textarea
              value={config.trust.statement}
              onChange={event =>
                patch({ trust: { ...config.trust, statement: event.target.value } })
              }
              className="min-h-20"
            />
          </Field>
        </div>
      </Disclosure>

      <Disclosure title="Contact page" meta="Headline, button, consent">
        <div className="space-y-4">
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
                patch({
                  contact: { ...config.contact, submitLabel: event.target.value },
                })
              }
            />
          </Field>
          <Field
            label="Consent text"
            hint="Stored with every lead. Rewording it restamps the version on save."
          >
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
        </div>
      </Disclosure>

      <Disclosure title="Thank-you page" meta="Shown once a lead is captured">
        <div className="space-y-4">
          <Field label="Headline">
            <Input
              value={config.thankYou.headline}
              onChange={event =>
                patch({ thankYou: { ...config.thankYou, headline: event.target.value } })
              }
            />
          </Field>
          <Field label="Message">
            <Textarea
              value={config.thankYou.message}
              onChange={event =>
                patch({ thankYou: { ...config.thankYou, message: event.target.value } })
              }
              className="min-h-20"
            />
          </Field>
        </div>
      </Disclosure>

      <Disclosure title="Out-of-area page" meta="Shown to a ZIP you do not serve">
        <div className="space-y-4">
          <Field label="Headline">
            <Input
              value={config.outOfArea.headline}
              onChange={event =>
                patch({ outOfArea: { ...config.outOfArea, headline: event.target.value } })
              }
            />
          </Field>
          <Field label="Message">
            <Textarea
              value={config.outOfArea.message}
              onChange={event =>
                patch({ outOfArea: { ...config.outOfArea, message: event.target.value } })
              }
              className="min-h-20"
            />
          </Field>
        </div>
      </Disclosure>

      <CampaignInventoryFields record={record} assets={assets} onChange={onChange} />
    </div>
  );
}
