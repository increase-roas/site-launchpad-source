import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const HTTPS_PREFIX = "https://";

/**
 * URL input that renders `https://` as a real addon rather than placeholder text.
 * The stored value keeps its scheme, because the schema validates a complete URL;
 * only the display strips it.
 */
export function UrlInput({
  value,
  onChange,
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const withoutScheme = value.startsWith(HTTPS_PREFIX)
    ? value.slice(HTTPS_PREFIX.length)
    : value.replace(/^http:\/\//, "");
  const handle = (typed: string) => {
    const trimmed = typed.trim();
    if (!trimmed) {
      onChange("");
      return;
    }
    // Pasting a full URL should not produce https://https://example.com
    if (/^https?:\/\//i.test(trimmed)) {
      onChange(trimmed);
      return;
    }
    onChange(`${HTTPS_PREFIX}${trimmed}`);
  };
  return (
    <span className="flex">
      <span
        className={cn(
          "flex h-9 shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground",
          invalid && "border-destructive/40",
        )}
      >
        {HTTPS_PREFIX}
      </span>
      <Input
        value={withoutScheme}
        onChange={event => handle(event.target.value)}
        placeholder={placeholder}
        className={cn("rounded-l-none", invalid && "border-destructive/40")}
      />
    </span>
  );
}

