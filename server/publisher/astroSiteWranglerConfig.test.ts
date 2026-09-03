import { describe, expect, it } from "vitest";
import { renderAstroSiteWranglerToml } from "./astroSiteWranglerConfig";

describe("Astro site wrangler.toml renderer", () => {
  it("renders deterministic D1 and R2 bindings", () => {
    const input = {
      workerName: "website-north-star-7",
      d1DatabaseName: "website-north-star-7-inventory",
      d1DatabaseId: "00000000-0000-0000-0000-000000000001",
      r2BucketName: "website-north-star-7-images",
      sessionKvNamespaceId: "8d78d85f7f7a4e07bccce07a141ec6ac",
    };
    const rendered = renderAstroSiteWranglerToml(input);
    expect(rendered).toBe(renderAstroSiteWranglerToml(input));
    expect(rendered).toContain('name = "website-north-star-7"');
    expect(rendered).toContain('compatibility_flags = ["nodejs_compat", "nodejs_als"]');
    expect(rendered).toContain('binding = "DB"');
    expect(rendered).toContain(
      'database_id = "00000000-0000-0000-0000-000000000001"',
    );
    expect(rendered).toContain('binding = "PRODUCT_IMAGES"');
    expect(rendered).toContain(
      'bucket_name = "website-north-star-7-images"',
    );
    expect(rendered).toContain('binding = "SESSION"');
    expect(rendered).toContain(
      'id = "8d78d85f7f7a4e07bccce07a141ec6ac"',
    );
  });

  it("escapes TOML values", () => {
    const rendered = renderAstroSiteWranglerToml({
      workerName: 'safe"\nunsafe = "value',
      d1DatabaseName: "safe-db",
      d1DatabaseId: "safe-id",
      r2BucketName: "safe-bucket",
      sessionKvNamespaceId: "safe-kv",
    });
    expect(rendered).not.toContain('\nunsafe = "value"\n');
  });
});
