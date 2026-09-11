import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { InventoryDependencies, InventoryWorkspace } from "./inventory/inventoryStore";
import { inventoryRouter } from "./routers/inventory";

function context(role: "admin" | "user" | null = "admin"): TrpcContext {
  return {
    user:
      role === null
        ? null
        : {
            id: 1,
            authUserId: "123e4567-e89b-12d3-a456-426614174004",
            name: "Operator",
            email: "operator@example.com",
            loginMethod: "manus",
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const readyWorkspace = (): InventoryWorkspace => ({
  environment: "production",
  targets: [
    {
      kind: "production",
      label: "Live website",
      d1DatabaseId: "d1-live",
      r2BucketName: "live-images",
      r2PublicUrl: "https://live.example",
      siteUrl: "https://live.example",
      adminUrl: "https://live.example/admin",
      ready: true,
    },
  ],
  categories: [{ slug: "hot-tub", label: "Hot Tubs" }],
  d1Enabled: true,
  r2Enabled: true,
  blockedBy: null,
});

function deps(workspace: InventoryWorkspace): InventoryDependencies {
  return {
    loadWorkspace: vi.fn().mockResolvedValue(workspace),
    query: vi.fn().mockResolvedValue({ rows: [], changes: 0 }),
    uploadImage: vi.fn().mockResolvedValue({ url: "https://live.example/products/1.jpg" }),
  };
}

describe("inventory router", () => {
  it("lists products once a live or preview database exists", async () => {
    const operations = deps(readyWorkspace());
    const caller = inventoryRouter(operations).createCaller(context());
    const result = await caller.list({ clientId: 15 });
    expect(result.environment).toBe("production");
    expect(result.products).toEqual([]);
    expect(operations.query).toHaveBeenCalled();
  });

  it("saves gallery photos and featured with the rest of the product", async () => {
    const operations = deps(readyWorkspace());
    const caller = inventoryRouter(operations).createCaller(context());
    const result = await caller.save({
      clientId: 15,
      product: {
        inventory_name: "Caldera Utopia",
        category: "hot-tub",
        featured: true,
        gallery_images: ["https://live.example/products/a.webp"],
      },
    });
    expect(result.product.featured).toBe(1);
    expect(result.product.gallery_images).toEqual([
      "https://live.example/products/a.webp",
    ]);
    expect(operations.query).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "production" }),
      expect.stringContaining("gallery_images"),
      expect.arrayContaining([
        JSON.stringify(["https://live.example/products/a.webp"]),
        1,
      ]),
    );
  });

  it("blocks listing when the website has no inventory database yet", async () => {
    const caller = inventoryRouter(
      deps({
        ...readyWorkspace(),
        targets: [],
        blockedBy: "Generate a preview or publish the website so inventory has a database.",
      }),
    ).createCaller(context());

    await expect(caller.list({ clientId: 15 })).rejects.toMatchObject({
      message: "Generate a preview or publish the website so inventory has a database.",
    });
  });
});
