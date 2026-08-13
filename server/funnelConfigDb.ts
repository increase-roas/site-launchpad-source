import { and, asc, eq } from "drizzle-orm";
import {
  clientSecretSetups,
  funnelConfigs as funnelConfigRows,
  funnelSteps,
  funnelSurveyQuestions,
  funnels,
  type Client,
  type ClientSecretSetup,
  type Funnel,
  type FunnelConfig,
  type FunnelSurveyQuestion,
} from "../drizzle/schema";
import {
  defaultServiceArea,
  generateFunnelConfig,
  slugifyFunnelName,
  type FunnelEditorInput,
  type SurveyQuestionInput,
} from "../shared/funnelConfig";
import { FUNNEL_SHAPES } from "../shared/workspace";
import { decryptSetupValue, encryptSetupValue, hasProtectedValue } from "./clientSecurity";
import { getClientById, getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db;
}

const CATEGORY_LABELS = {
  hotTubs: "Hot Tubs",
  swimSpas: "Swim Spas",
  saunas: "Saunas",
  coldPlunge: "Cold Plunge",
  massageChairs: "Massage Chairs",
} as const;

function defaultQuestion(client: NonNullable<Awaited<ReturnType<typeof getClientById>>>): SurveyQuestionInput {
  const options = client.productCategories.map(category => CATEGORY_LABELS[category]);
  return {
    questionText: "What are you interested in?",
    questionType: options.length > 1 ? "checkbox" : "radio",
    options: options.length > 1 ? options : [...options, "Not sure yet"],
  };
}

function defaultConfig(client: NonNullable<Awaited<ReturnType<typeof getClientById>>>) {
  return {
    serviceArea: defaultServiceArea(client),
    offerHeadline: client.primaryOffer.slice(0, 300),
    offerSubheadline: client.tagline,
    thankYouMessage: `Thanks! ${client.businessName} will contact you shortly.`,
  };
}

function stepRows(funnelId: number, slug: string) {
  return FUNNEL_SHAPES.B.map((definition, position) => ({
    funnelId,
    stepType: definition.stepType,
    position,
    title: definition.title,
    path: `/${slug}${definition.pathSuffix}`,
    capturedFields: definition.capturedFields,
    trackingActions: definition.trackingActions,
  }));
}

function decryptOptional(value: string | null | undefined): string {
  return hasProtectedValue(value) ? decryptSetupValue(value as string) : "";
}

export function funnelContentUpdateFields(input: { name: string; slug: string }) {
  return { name: input.name, slug: input.slug };
}

export function protectGeneratedFunnelConfig(value: string): string {
  return encryptSetupValue(value);
}

export function buildFunnelAutofillProfile(
  client: Pick<Client, "businessName" | "phone" | "city" | "state" | "postalCode" | "country">,
  secretRow:
    | Pick<ClientSecretSetup, "metaPixelIdEncrypted" | "ghlWebhookUrlEncrypted">
    | undefined,
) {
  const metaPixelId = decryptOptional(secretRow?.metaPixelIdEncrypted);
  const ghlWebhookUrl = decryptOptional(secretRow?.ghlWebhookUrlEncrypted);
  return {
    businessName: client.businessName,
    phone: client.phone,
    serviceArea: defaultServiceArea(client),
    metaPixelId,
    ghlWebhookUrl,
    missingSetup: [
      ...(metaPixelId ? [] : ["Meta Pixel ID"]),
      ...(ghlWebhookUrl ? [] : ["GHL webhook URL"]),
    ],
  };
}

export function getFunnelDeployMissingItems(input: {
  metaPixelId: string;
  ghlWebhookUrl: string;
  generatedConfig: string;
}): string[] {
  return [
    ...(input.metaPixelId ? [] : ["Meta Pixel ID"]),
    ...(input.ghlWebhookUrl ? [] : ["GHL webhook URL"]),
    ...(input.generatedConfig ? [] : ["Generated funnel config"]),
  ];
}

async function getOwnedFunnel(clientId: number, funnelId: number): Promise<Funnel> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.id, funnelId), eq(funnels.clientId, clientId)))
    .limit(1);
  const funnel = rows[0];
  if (!funnel) throw new Error("Funnel not found.");
  return funnel;
}

async function getAutofill(clientId: number) {
  const [client, secretRow] = await Promise.all([
    getClientById(clientId),
    (async () => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(clientSecretSetups)
        .where(eq(clientSecretSetups.clientId, clientId))
        .limit(1);
      return rows[0];
    })(),
  ]);
  if (!client) throw new Error("Client not found.");

  return {
    client,
    profile: buildFunnelAutofillProfile(client, secretRow),
  };
}

async function ensureFunnelConfiguration(clientId: number, funnelId: number) {
  const db = await requireDb();
  const funnel = await getOwnedFunnel(clientId, funnelId);
  const rows = await db
    .select()
    .from(funnelConfigRows)
    .where(eq(funnelConfigRows.funnelId, funnelId))
    .limit(1);

  if (rows[0]) return rows[0];

  const { client } = await getAutofill(clientId);
  const created = await db
    .insert(funnelConfigRows)
    .values({ funnelId, ...defaultConfig(client) })
    .$returningId();
  const configId = created[0]?.id;
  if (!configId) throw new Error("Funnel configuration could not be created.");

  const existingQuestions = await db
    .select({ id: funnelSurveyQuestions.id })
    .from(funnelSurveyQuestions)
    .where(eq(funnelSurveyQuestions.funnelId, funnelId));
  if (existingQuestions.length === 0) {
    const question = defaultQuestion(client);
    await db.insert(funnelSurveyQuestions).values({ funnelId, position: 0, ...question });
  }

  const inserted = await db
    .select()
    .from(funnelConfigRows)
    .where(eq(funnelConfigRows.id, configId))
    .limit(1);
  if (!inserted[0]) throw new Error(`Funnel ${funnel.name} could not be configured.`);
  return inserted[0];
}

export async function listFunnelBuilderCards(clientId: number) {
  const db = await requireDb();
  const [funnelList, configs, questions] = await Promise.all([
    db.select().from(funnels).where(eq(funnels.clientId, clientId)).orderBy(asc(funnels.id)),
    db
      .select()
      .from(funnelConfigRows)
      .innerJoin(funnels, eq(funnelConfigRows.funnelId, funnels.id))
      .where(eq(funnels.clientId, clientId)),
    db
      .select({ funnelId: funnelSurveyQuestions.funnelId })
      .from(funnelSurveyQuestions)
      .innerJoin(funnels, eq(funnelSurveyQuestions.funnelId, funnels.id))
      .where(eq(funnels.clientId, clientId)),
  ]);
  const configByFunnel = new Map(configs.map(row => [row.funnelConfigs.funnelId, row.funnelConfigs]));
  const questionCounts = new Map<number, number>();
  for (const question of questions) {
    questionCounts.set(question.funnelId, (questionCounts.get(question.funnelId) ?? 0) + 1);
  }

  return funnelList.map(funnel => {
    const config = configByFunnel.get(funnel.id);
    return {
      ...funnel,
      offerHeadline: config?.offerHeadline ?? "",
      questionCount: questionCounts.get(funnel.id) ?? 0,
      hasGeneratedConfig: hasProtectedValue(config?.generatedConfigEncrypted),
      generatedAt: config?.generatedAt ?? null,
    };
  });
}

export async function createFunnelBuilder(clientId: number, requestedName: string) {
  const db = await requireDb();
  const { client } = await getAutofill(clientId);
  const existing = await db.select({ slug: funnels.slug }).from(funnels).where(eq(funnels.clientId, clientId));
  const used = new Set(existing.map(row => row.slug));
  const baseSlug = slugifyFunnelName(requestedName) || "new-funnel";
  let slug = baseSlug;
  let suffix = 2;
  while (used.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const created = await db.transaction(async transaction => {
    const inserted = await transaction
      .insert(funnels)
      .values({
        clientId,
        name: requestedName.trim(),
        slug,
        shape: "B",
        status: "draft",
        deploymentStatus: "draft",
      })
      .$returningId();
    const funnelId = inserted[0]?.id;
    if (!funnelId) throw new Error("Funnel could not be created.");
    await transaction.insert(funnelSteps).values(stepRows(funnelId, slug));
    await transaction.insert(funnelConfigRows).values({ funnelId, ...defaultConfig(client) });
    await transaction
      .insert(funnelSurveyQuestions)
      .values({ funnelId, position: 0, ...defaultQuestion(client) });
    return funnelId;
  });

  return getFunnelBuilderDetail(clientId, created);
}

export async function getFunnelBuilderDetail(clientId: number, funnelId: number) {
  const db = await requireDb();
  const funnel = await getOwnedFunnel(clientId, funnelId);
  const config = await ensureFunnelConfiguration(clientId, funnelId);
  const [questions, { profile }] = await Promise.all([
    db
      .select()
      .from(funnelSurveyQuestions)
      .where(eq(funnelSurveyQuestions.funnelId, funnelId))
      .orderBy(asc(funnelSurveyQuestions.position)),
    getAutofill(clientId),
  ]);

  return {
    funnel,
    config: {
      serviceArea: config.serviceArea,
      offerHeadline: config.offerHeadline,
      offerSubheadline: config.offerSubheadline,
      thankYouMessage: config.thankYouMessage,
      generatedConfig: decryptOptional(config.generatedConfigEncrypted),
      generatedAt: config.generatedAt,
    },
    questions,
    profile,
  };
}

export async function saveFunnelBuilder(
  clientId: number,
  funnelId: number,
  input: FunnelEditorInput,
) {
  const db = await requireDb();
  const current = await getOwnedFunnel(clientId, funnelId);
  const { profile } = await getAutofill(clientId);
  const generatedConfig = generateFunnelConfig({
    ...input,
    businessName: profile.businessName,
    phone: profile.phone,
    metaPixelId: profile.metaPixelId,
    ghlWebhookUrl: profile.ghlWebhookUrl,
  });
  const generatedAt = new Date();

  await db.transaction(async transaction => {
    await transaction
      .update(funnels)
      .set(funnelContentUpdateFields(input))
      .where(eq(funnels.id, funnelId));

    if (current.slug !== input.slug) {
      const steps = await transaction
        .select()
        .from(funnelSteps)
        .where(eq(funnelSteps.funnelId, funnelId));
      for (const step of steps) {
        const nextPath = step.path.startsWith(`/${current.slug}`)
          ? `/${input.slug}${step.path.slice(current.slug.length + 1)}`
          : step.path;
        await transaction.update(funnelSteps).set({ path: nextPath }).where(eq(funnelSteps.id, step.id));
      }
    }

    await transaction
      .insert(funnelConfigRows)
      .values({
        funnelId,
        serviceArea: input.serviceArea,
        offerHeadline: input.offerHeadline,
        offerSubheadline: input.offerSubheadline,
        thankYouMessage: input.thankYouMessage,
        generatedConfigEncrypted: protectGeneratedFunnelConfig(generatedConfig),
        generatedAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          serviceArea: input.serviceArea,
          offerHeadline: input.offerHeadline,
          offerSubheadline: input.offerSubheadline,
          thankYouMessage: input.thankYouMessage,
          generatedConfigEncrypted: protectGeneratedFunnelConfig(generatedConfig),
          generatedAt,
        },
      });

    await transaction.delete(funnelSurveyQuestions).where(eq(funnelSurveyQuestions.funnelId, funnelId));
    if (input.questions.length > 0) {
      await transaction.insert(funnelSurveyQuestions).values(
        input.questions.map((question, position) => ({
          funnelId,
          position,
          questionText: question.questionText,
          questionType: question.questionType,
          options: question.questionType === "text" ? [] : question.options,
        })),
      );
    }
  });

  return getFunnelBuilderDetail(clientId, funnelId);
}

export async function markFunnelReady(clientId: number, funnelId: number) {
  const db = await requireDb();
  const detail = await getFunnelBuilderDetail(clientId, funnelId);
  const missing = getFunnelDeployMissingItems({
    metaPixelId: detail.profile.metaPixelId,
    ghlWebhookUrl: detail.profile.ghlWebhookUrl,
    generatedConfig: detail.config.generatedConfig,
  });
  if (missing.length > 0) {
    throw new Error(`Finish these items first: ${missing.join(", ")}.`);
  }

  await db
    .update(funnels)
    .set({ deploymentStatus: "ready", status: "ready", readyAt: new Date() })
    .where(and(eq(funnels.id, funnelId), eq(funnels.clientId, clientId)));
  return getFunnelBuilderDetail(clientId, funnelId);
}

export async function markFunnelDeployed(clientId: number, funnelId: number) {
  const db = await requireDb();
  const funnel = await getOwnedFunnel(clientId, funnelId);
  if (funnel.deploymentStatus !== "ready" && funnel.deploymentStatus !== "deployed") {
    throw new Error("Mark this funnel ready before recording it as deployed.");
  }

  await db
    .update(funnels)
    .set({ deploymentStatus: "deployed", status: "live", deployedAt: new Date() })
    .where(and(eq(funnels.id, funnelId), eq(funnels.clientId, clientId)));
  return getFunnelBuilderDetail(clientId, funnelId);
}
