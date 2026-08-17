import type { GitHubApiClient, Repository } from "./githubApi";

export type ReconciledRepository = Repository;

export type RepositoryReconciliationClient = Pick<
  GitHubApiClient,
  "getRepository" | "generatePublicRepository"
>;

export class PublisherManualAttentionError extends Error {
  readonly code = "PUBLISHER_MANUAL_ATTENTION";

  constructor(message: string) {
    super(message);
    this.name = "PublisherManualAttentionError";
  }
}

type ReconciliationInput = {
  github: RepositoryReconciliationClient;
  owner: string;
  repository: string;
  templateOwner: string;
  templateRepository: string;
  description: string;
  allowCreate: boolean;
  markCreateRequested: () => Promise<void>;
  signal: AbortSignal;
};

function requireExactRepository(
  repository: ReconciledRepository,
  input: ReconciliationInput
): ReconciledRepository {
  const exactFullName = `${input.owner}/${input.repository}`;
  if (
    repository.ownerLogin !== input.owner ||
    repository.name !== input.repository ||
    repository.fullName !== exactFullName ||
    repository.private !== false ||
    repository.visibility !== "public" ||
    repository.templateOwnerLogin !== input.templateOwner ||
    repository.templateRepositoryName !== input.templateRepository
  ) {
    throw new PublisherManualAttentionError(
      `Repository ${exactFullName} does not have the exact public canonical-template identity; manual attention is required.`
    );
  }
  return repository;
}

async function lookupExactRepository(
  input: ReconciliationInput
): Promise<ReconciledRepository | null> {
  input.signal.throwIfAborted();
  const repository = await input.github.getRepository({
    owner: input.owner,
    repository: input.repository,
    signal: input.signal,
  });
  input.signal.throwIfAborted();
  return repository ? requireExactRepository(repository, input) : null;
}

export async function reconcilePublicTemplateRepository(
  input: ReconciliationInput
): Promise<ReconciledRepository> {
  const existing = await lookupExactRepository(input);
  if (existing) return existing;

  if (!input.allowCreate) {
    throw new PublisherManualAttentionError(
      `Repository ${input.owner}/${input.repository} was not found after an indeterminate create attempt; manual attention is required.`
    );
  }

  input.signal.throwIfAborted();
  await input.markCreateRequested();
  input.signal.throwIfAborted();

  let createError: unknown;
  try {
    await input.github.generatePublicRepository({
      templateOwner: input.templateOwner,
      templateRepository: input.templateRepository,
      owner: input.owner,
      repository: input.repository,
      description: input.description,
      signal: input.signal,
    });
  } catch (error) {
    createError = error;
  }

  input.signal.throwIfAborted();
  const reconciled = await lookupExactRepository(input);
  if (reconciled) return reconciled;
  if (createError) throw createError;

  throw new PublisherManualAttentionError(
    `Repository ${input.owner}/${input.repository} was created but its canonical template identity could not be proven; manual attention is required.`
  );
}
