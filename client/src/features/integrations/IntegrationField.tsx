import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CLIENT_INTEGRATION_FIELD_LABELS,
  isIdentifierKey,
  isSecretKey,
  type ClientIntegrationIdentifierKey,
  type ClientIntegrationProfileKey,
  type ClientIntegrationSecretHints,
  type ClientIntegrationSecretKey,
  type SecretPresence,
} from "@shared/clientIntegrationProfile";
import { Eye, EyeOff, Loader2, RefreshCw, Undo2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  FIELD_HINTS,
  NARROW_REQUIREMENT_LABEL,
  fieldAnchorId,
  fieldRequirement,
} from "./integrationGroupMeta";
import type { IntegrationDrafts } from "./useIntegrationDrafts";

/** Fetches one stored secret through the audited admin endpoint. */
export type RevealSecret = (key: ClientIntegrationSecretKey) => Promise<string | null>;

type FieldStatus = "set" | "required" | "optional" | "pendingChange";

const STATUS_CLASS: Record<FieldStatus, string> = {
  set: "bg-success/10 text-success",
  required: "bg-warning/15 text-warning",
  optional: "bg-muted text-muted-foreground",
  pendingChange: "bg-primary/10 text-primary",
};

function errorId(key: ClientIntegrationProfileKey): string {
  return `${key}-error`;
}

function FieldShell({
  fieldKey,
  status,
  statusLabel,
  inputId,
  error,
  hint,
  children,
}: {
  fieldKey: ClientIntegrationProfileKey;
  status: FieldStatus;
  statusLabel: string;
  inputId?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const requirementLabel = NARROW_REQUIREMENT_LABEL[fieldRequirement(fieldKey)];
  const Label = inputId ? "label" : "span";

  return (
    <div id={fieldAnchorId(fieldKey)} className="scroll-mt-24 bg-card px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={inputId} className="text-xs font-semibold">
          {CLIENT_INTEGRATION_FIELD_LABELS[fieldKey]}
        </Label>
        {requirementLabel ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {requirementLabel}
          </span>
        ) : null}
        <span
          className={cn(
            "ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold",
            STATUS_CLASS[status],
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-2">{children}</div>

      {error ? (
        <p
          id={errorId(fieldKey)}
          role="alert"
          className="mt-1.5 text-xs font-semibold text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Coloured strip for a change that has no input, such as a queued clear or rotate. */
function PendingNotice({
  tone,
  message,
  onUndo,
}: {
  tone: "danger" | "success";
  message: string;
  onUndo: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2",
        tone === "danger"
          ? "border-destructive/30 bg-destructive/5"
          : "border-success/30 bg-success/5",
      )}
    >
      <span
        className={cn(
          "text-xs font-semibold",
          tone === "danger" ? "text-destructive" : "text-success",
        )}
      >
        {message}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onUndo}
        className="ml-auto h-7 gap-1.5 px-2 text-xs font-semibold"
      >
        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        Undo
      </Button>
    </div>
  );
}

function IdentifierField({
  fieldKey,
  drafts,
}: {
  fieldKey: ClientIntegrationIdentifierKey;
  drafts: IntegrationDrafts;
}) {
  const value = drafts.identifiers[fieldKey];
  const error = drafts.fieldErrors.get(fieldKey);
  const filled = value.trim().length > 0;

  return (
    <FieldShell
      fieldKey={fieldKey}
      status={filled ? "set" : "required"}
      statusLabel={filled ? "Set" : "Required"}
      inputId={fieldKey}
      error={error}
      hint={FIELD_HINTS[fieldKey]}
    >
      <Input
        id={fieldKey}
        type="text"
        autoComplete="off"
        value={value}
        placeholder="Enter value"
        onChange={event => drafts.setIdentifier(fieldKey, event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId(fieldKey) : undefined}
        className="font-mono"
      />
    </FieldShell>
  );
}

function SecretField({
  fieldKey,
  presence,
  secretHint,
  revealSecret,
  drafts,
}: {
  fieldKey: ClientIntegrationSecretKey;
  presence: SecretPresence;
  secretHint: string | null;
  revealSecret: RevealSecret;
  drafts: IntegrationDrafts;
}) {
  const [visible, setVisible] = useState(false);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [revealPending, setRevealPending] = useState(false);
  const error = drafts.fieldErrors.get(fieldKey);
  const isCleared = drafts.clearedSecrets.includes(fieldKey);
  const isRotating = fieldKey === "STAGE_WEBHOOK_SECRET" && drafts.rotateStageWebhookSecret;
  const isStored = presence === "SET";
  const draft = drafts.secrets[fieldKey];
  const isStaged = !isCleared && !isRotating && Boolean(draft?.trim());
  const isOptional = fieldRequirement(fieldKey) === "optional";

  // A save replaces what we fetched, so drop the plaintext rather than leave a
  // stale value on screen.
  useEffect(() => {
    setVisible(false);
    setRevealedValue(null);
  }, [presence, secretHint]);

  const status: FieldStatus = isCleared || isRotating || isStaged
    ? "pendingChange"
    : isStored
      ? "set"
      : isOptional
        ? "optional"
        : "required";
  const statusLabel = isCleared
    ? "Clearing"
    : isRotating
      ? "Generating"
      : isStaged
        ? "Replacing"
        : isStored
          ? "Stored"
          : isOptional
            ? "Optional"
            : "Required";

  const hint = isStaged && isStored
    ? "Replaces the stored value when you save."
    : FIELD_HINTS[fieldKey];

  // Until the eye fetches it, the stored value is represented by its saved tail.
  // Typing over whatever is in the box stages a replacement.
  const placeholder = isStored
    ? `${"\u2022".repeat(8)}${secretHint ?? "\u2022\u2022\u2022\u2022"}`
    : "Paste the value";

  const value = draft ?? revealedValue ?? "";

  const toggleVisible = async () => {
    if (visible) {
      setVisible(false);
      setRevealedValue(null);
      return;
    }
    if (isStored && draft === undefined) {
      setRevealPending(true);
      try {
        setRevealedValue(await revealSecret(fieldKey));
      } finally {
        setRevealPending(false);
      }
    }
    setVisible(true);
  };

  return (
    <FieldShell
      fieldKey={fieldKey}
      status={status}
      statusLabel={statusLabel}
      inputId={isCleared || isRotating ? undefined : fieldKey}
      error={error}
      hint={hint}
    >
      {isCleared ? (
        <PendingNotice
          tone="danger"
          message="Will be removed when you save"
          onUndo={() => drafts.toggleClearSecret(fieldKey)}
        />
      ) : isRotating ? (
        <PendingNotice
          tone="success"
          message="A new secret will be generated when you save"
          onUndo={drafts.cancelRotate}
        />
      ) : (
        <>
          <div className="relative">
            <Input
              id={fieldKey}
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={value}
              placeholder={placeholder}
              onChange={event => drafts.setSecret(fieldKey, event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId(fieldKey) : undefined}
              className="pr-9 font-mono"
            />
            <button
              type="button"
              onClick={toggleVisible}
              disabled={revealPending}
              aria-label={visible ? "Hide value" : "Show value"}
              className="absolute top-1/2 right-1 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {revealPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : visible ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {isStaged ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => drafts.discardSecretDraft(fieldKey)}
                className="h-7 gap-1.5 px-2 text-xs font-semibold text-muted-foreground"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                Undo
              </Button>
            ) : null}
            {fieldKey === "STAGE_WEBHOOK_SECRET" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={drafts.requestRotate}
                className="h-7 gap-1.5 px-2 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Generate one for me
              </Button>
            ) : null}
            {isStored ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => drafts.toggleClearSecret(fieldKey)}
                className="ml-auto h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </>
      )}
    </FieldShell>
  );
}

export function IntegrationField({
  fieldKey,
  presence,
  secretHints,
  revealSecret,
  drafts,
}: {
  fieldKey: string;
  presence: SecretPresence;
  secretHints: ClientIntegrationSecretHints;
  revealSecret: RevealSecret;
  drafts: IntegrationDrafts;
}) {
  if (isIdentifierKey(fieldKey)) {
    return <IdentifierField fieldKey={fieldKey} drafts={drafts} />;
  }
  if (isSecretKey(fieldKey)) {
    return (
      <SecretField
        fieldKey={fieldKey}
        presence={presence}
        secretHint={secretHints[fieldKey]}
        revealSecret={revealSecret}
        drafts={drafts}
      />
    );
  }
  return null;
}
