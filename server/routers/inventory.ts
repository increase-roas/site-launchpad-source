import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { mapRouterError } from "../trpcErrors";
import {
  createLiveInventoryDependencies,
  listInventoryProducts,
  pickInventoryTarget,
  saveInventoryProduct,
  setInventoryStatus,
  type InventoryDependencies,
  type InventoryWorkspace,
} from "../inventory/inventoryStore";
import { INVENTORY_PATCH_STATUSES } from "../../shared/inventoryAdmin";

const clientIdInput = z.object({ clientId: z.number().int().positive() });
const environmentInput = z.enum(["preview", "production"]).optional();

const productInput = z.object({
  slug: z.string().optional(),
  inventory_name: z.string(),
  category: z.string(),
  status: z.string().optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  monthly_payment: z.union([z.string(), z.number()]).optional(),
  sort_order: z.union([z.string(), z.number()]).optional(),
  primary_image: z.string().optional(),
  gallery_images: z.array(z.string()).optional(),
  quick_facts: z.array(z.string()).optional(),
  ghl_tags: z.array(z.string()).optional(),
  why_bullets: z.array(z.string()).optional(),
  promo_label: z.string().optional(),
  delivery_promise: z.string().optional(),
  headline: z.string().optional(),
  positioning_label: z.string().optional(),
  hero_description: z.string().optional(),
  long_description: z.string().optional(),
  best_for: z.string().optional(),
  featured: z.union([z.boolean(), z.number()]).optional(),
});

function requireTarget(
  workspace: InventoryWorkspace,
  environment?: "preview" | "production",
) {
  const target = pickInventoryTarget(workspace, environment);
  if (!target) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        workspace.blockedBy ??
        "Generate a preview or publish the website before editing inventory.",
    });
  }
  return target;
}

export function inventoryRouter(injected?: InventoryDependencies) {
  const deps = () => injected ?? createLiveInventoryDependencies();

  return router({
    workspace: protectedProcedure.input(clientIdInput).query(async ({ input }) => {
      try {
        return await deps().loadWorkspace(input.clientId);
      } catch (error) {
        throw mapRouterError(error, "Inventory could not be loaded.");
      }
    }),

    list: protectedProcedure
      .input(clientIdInput.extend({ environment: environmentInput }))
      .query(async ({ input }) => {
        try {
          const operations = deps();
          const workspace = await operations.loadWorkspace(input.clientId);
          const target = requireTarget(workspace, input.environment);
          const products = await listInventoryProducts(operations, workspace, target);
          return { workspace, environment: target.kind, products };
        } catch (error) {
          throw mapRouterError(error, "Inventory products could not be loaded.");
        }
      }),

    save: protectedProcedure
      .input(
        clientIdInput.extend({
          environment: environmentInput,
          product: productInput,
        }),
      )
      .mutation(async ({ input }) => {
        try {
          const operations = deps();
          const workspace = await operations.loadWorkspace(input.clientId);
          if (workspace.blockedBy && workspace.categories.length === 0) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: workspace.blockedBy,
            });
          }
          const target = requireTarget(workspace, input.environment);
          const product = await saveInventoryProduct(
            operations,
            workspace,
            target,
            input.product,
          );
          return { product, environment: target.kind };
        } catch (error) {
          throw mapRouterError(error, "Product could not be saved.");
        }
      }),

    setStatus: protectedProcedure
      .input(
        clientIdInput.extend({
          environment: environmentInput,
          slug: z.string().min(1),
          status: z.enum(INVENTORY_PATCH_STATUSES),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          const operations = deps();
          const workspace = await operations.loadWorkspace(input.clientId);
          const target = requireTarget(workspace, input.environment);
          await setInventoryStatus(operations, target, input.slug, input.status);
          return { ok: true };
        } catch (error) {
          throw mapRouterError(error, "Product status could not be updated.");
        }
      }),

    upload: protectedProcedure
      .input(
        clientIdInput.extend({
          environment: environmentInput,
          filename: z.string().min(1).max(255),
          mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
          bytes: z.string().min(1).max(9_000_000),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          const operations = deps();
          const workspace = await operations.loadWorkspace(input.clientId);
          const target = requireTarget(workspace, input.environment);
          const buffer = Buffer.from(input.bytes, "base64");
          if (!buffer.length) throw new Error("Choose an image file that is not empty.");
          return await operations.uploadImage(target, {
            filename: input.filename,
            mimeType: input.mimeType,
            bytes: buffer,
          });
        } catch (error) {
          throw mapRouterError(error, "Product photo could not be uploaded.");
        }
      }),
  });
}
