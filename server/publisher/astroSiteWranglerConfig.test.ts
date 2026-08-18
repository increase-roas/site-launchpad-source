import { describe, expect, it } from "vitest";
import { renderAstroSiteWranglerToml } from "./astroSiteWranglerConfig";

describe("Astro site wrangler.toml renderer", () => {
  it("renders deterministic D1 and R2 bindings", () => {
    const input = {
      workerName: "website-north-star-7",
      d1DatabaseName: "website-north-star-7-inventory",
      d1DatabaseId: "00000000-0000-0000-0000-000000000001",
      r2BucketName: "website-north-star-7-images",
    };
    const rendered = renderAstroSiteWranglerToml(input);
    expect(rendered).toBe(renderAstroSiteWranglerToml(input));
    expect(rendered).toContain('name = "website-north-star-7"');
    expect(rendered).toContain('binding = "DB"');
    expect(rendered).toContain(
      'database_id = "00000000-0000-0000-0000-000000000001"',
    );
    expect(rendered).toContain('binding = "PRODUCT_IMAGES"');
    expect(rendered).toContain(
      'bucket_name = "website-north-star-7-images"',
    );
  });

  it("escapes TOML values", () => {
    const rendered = renderAstroSiteWranglerToml({
      workerName: 'safe"\nunsafe = "value',
      d1DatabaseName: "safe-db",
      d1DatabaseId: "safe-id",
      r2BucketName: "safe-bucket",
    });
    expect(rendered).not.toContain('\nunsafe = "value"\n');
  });
});
