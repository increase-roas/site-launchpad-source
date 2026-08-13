import { SectionHeading } from "@/components/client/ClientEditorFields";
import type { FieldErrors } from "@/components/client/clientEditorForm";
import { StatusDot } from "@/components/StatusDot";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SECRET_FIELD_LABELS, SECRET_FIELD_VALUES, type SecretField, type SecretStatus } from "@shared/client";
import { AlertCircle, ShieldCheck } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

export function ClientSecretsFields({
  setup,
  errors,
  secretStatus,
  setSetup,
}: {
  setup: Record<SecretField, string>;
  errors: FieldErrors;
  secretStatus: SecretStatus | undefined;
  setSetup: Dispatch<SetStateAction<Record<SecretField, string>>>;
}) {
  return (
    <Card className="border-amber-300/15 bg-[linear-gradient(145deg,rgba(120,83,22,0.10),rgba(23,29,38,0.92))] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
      <SectionHeading
        icon={ShieldCheck}
        eyebrow="Step 5"
        title="Technical Setup (ask Alex)"
        description="If you do not have these, ask Alex. Saved values stay hidden."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        {SECRET_FIELD_VALUES.map(field => {
          const filled = Boolean(setup[field].trim()) || Boolean(secretStatus?.[field]);
          const isWide = field === "ghlApiKey" || field === "ghlWebhookUrl";
          return (
            <div key={field} className={isWide ? "sm:col-span-2" : ""}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor={`setup-${field}`} className="text-sm font-extrabold">
                  {SECRET_FIELD_LABELS[field]}
                </label>
                <StatusDot good={filled} label={filled ? "Filled" : "Missing"} compact />
              </div>
              <Input
                id={`setup-${field}`}
                type={field === "ghlApiKey" ? "password" : field === "ghlWebhookUrl" ? "url" : "text"}
                autoComplete="off"
                value={setup[field]}
                onChange={event => setSetup(current => ({ ...current, [field]: event.target.value }))}
                placeholder={
                  secretStatus?.[field] ? "Saved — type here only to replace it" : `Enter ${SECRET_FIELD_LABELS[field]}`
                }
                className="h-12 rounded-xl border-white/10 bg-black/15 text-base"
              />
              {errors[field] ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-red-300">
                  <AlertCircle className="h-4 w-4" /> {errors[field]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
