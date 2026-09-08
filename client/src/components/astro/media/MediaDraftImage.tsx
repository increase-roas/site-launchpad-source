import { useEffect, useState } from "react";

/**
 * Draft URLs can exist in the database after a local upload even when this
 * Launchpad instance cannot serve the file. Show that instead of a broken image.
 */
export function MediaDraftImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
  }, [src]);

  if (missing) {
    return (
      <span className="grid h-full min-h-24 w-full place-items-center px-3 text-center text-[11px] font-semibold text-muted-foreground">
        File missing in this environment
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setMissing(true)}
    />
  );
}
