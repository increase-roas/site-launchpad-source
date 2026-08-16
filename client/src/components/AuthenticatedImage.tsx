import { fetchAuthenticatedStorageObject } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  useEffect,
  useState,
  type ImgHTMLAttributes,
} from "react";

type AuthenticatedImageProps =
  ImgHTMLAttributes<HTMLImageElement>;

export function AuthenticatedImage({
  src,
  ...props
}: AuthenticatedImageProps) {
  const [resolvedSource, setResolvedSource] = useState<
    string | undefined
  >(
    src?.startsWith("/manus-storage/") ? undefined : src,
  );

  useEffect(() => {
    if (!src?.startsWith("/manus-storage/")) {
      setResolvedSource(src);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | undefined;
    setResolvedSource(undefined);

    void fetchAuthenticatedStorageObject(src, {
      auth: supabase.auth,
      fetchFn: globalThis.fetch,
      signal: controller.signal,
    })
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSource(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setResolvedSource(undefined);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return <img {...props} src={resolvedSource} />;
}
