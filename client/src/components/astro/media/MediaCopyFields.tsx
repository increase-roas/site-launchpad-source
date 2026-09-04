import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";

export function MediaCopyFields({
  alt,
  description,
  disabled,
  onSave,
}: {
  alt: string;
  description: string;
  disabled?: boolean;
  onSave: (next: { alt: string; description: string }) => void;
}) {
  const [draftAlt, setDraftAlt] = useState(alt);
  const [draftDescription, setDraftDescription] = useState(description);

  useEffect(() => {
    setDraftAlt(alt);
    setDraftDescription(description);
  }, [alt, description]);

  const persist = () => {
    if (draftAlt === alt && draftDescription === description) return;
    onSave({ alt: draftAlt, description: draftDescription });
  };

  return (
    <div className="grid gap-3">
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold">Alt text</span>
        <Input
          value={draftAlt}
          disabled={disabled}
          maxLength={240}
          placeholder="What this photo shows"
          onChange={event => setDraftAlt(event.target.value)}
          onBlur={persist}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold">Description</span>
        <Textarea
          value={draftDescription}
          disabled={disabled}
          maxLength={2000}
          placeholder="Optional notes or caption"
          className="min-h-16"
          onChange={event => setDraftDescription(event.target.value)}
          onBlur={persist}
        />
      </label>
    </div>
  );
}
