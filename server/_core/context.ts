import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const INTERNAL_OPERATOR_DATE = new Date(0);
const INTERNAL_OPERATOR: User = {
  id: 0,
  authUserId: "00000000-0000-0000-0000-000000000000",
  name: "Site Launchpad Operator",
  email: null,
  loginMethod: "internal",
  role: "admin",
  createdAt: INTERNAL_OPERATOR_DATE,
  updatedAt: INTERNAL_OPERATOR_DATE,
  lastSignedIn: INTERNAL_OPERATOR_DATE,
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: INTERNAL_OPERATOR,
  };
}
