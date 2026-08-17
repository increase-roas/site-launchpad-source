import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { HttpError } from "../../shared/_core/errors";
import { authenticateSupabaseRequest } from "./supabaseAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await authenticateSupabaseRequest(opts.req);
  } catch (error) {
    if (
      !(error instanceof HttpError) ||
      (error.statusCode !== 401 && error.statusCode !== 403)
    ) {
      throw error;
    }
    // Missing, invalid, or disallowed authentication stays optional for
    // public procedures. Runtime/database failures remain visible.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
