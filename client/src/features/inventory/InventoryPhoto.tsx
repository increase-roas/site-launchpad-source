export function InventoryPhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return <div className={`bg-muted ${className ?? ""}`} aria-hidden="true" />;
  }
  return <img src={src} alt={alt} className={className} />;
}
