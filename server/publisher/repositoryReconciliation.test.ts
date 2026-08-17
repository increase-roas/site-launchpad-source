import { describe, expect, it, vi } from "vitest";
import {
  reconcilePublicTemplateRepository,
  type RepositoryReconciliationClient,
} from "./repositoryReconciliation";

function matchingRepository() {
  return {
    id: 101,
    ownerLogin: "launchpad-sites",
    name: "simple-form-northland-spas-11",
    fullName: "launchpad-sites/simple-form-northland-spas-11",
    private: false,
    visibility: "public" as const,
    templateOwnerLogin: "increase-roas",
    templateRepositoryName: "paid-funnel-simple-form-funnel",
    htmlUrl: "https://github.com/launchpad-sites/simple-form-northland-spas-11",
    defaultBranch: "main",
  };
}

function reconciliationInput(
  github: RepositoryReconciliationClient,
  signal: AbortSignal,
  allowCreate = true,
  markCreateRequested: () => Promise<void> = vi.fn()
) {
  return {
    github,
    owner: "launchpad-sites",
    repository: "simple-form-northland-spas-11",
    templateOwner: "increase-roas",
    templateRepository: "paid-funnel-simple-form-funnel",
    description: "Generated Simple Form funnel simple-form-funnel-11",
    allowCreate,
    markCreateRequested,
    signal,
  };
}

describe("repository creation reconciliation", () => {
  it("reuses only an exact public repository generated from the canonical template", async () => {
    const repository = matchingRepository();
    const github: RepositoryReconciliationClient = {
      getRepository: vi.fn().mockResolvedValue(repository),
      generatePublicRepository: vi.fn(),
    };

    const result = await reconcilePublicTemplateRepository(
      reconciliationInput(github, new AbortController().signal)
    );

    expect(result).toEqual(repository);
    expect(github.getRepository).toHaveBeenCalledWith({
      owner: "launchpad-sites",
      repository: "simple-form-northland-spas-11",
      signal: expect.any(AbortSignal),
    });
    expect(github.generatePublicRepository).not.toHaveBeenCalled();
  });

  it("never creates again when a prior create attempt has no provable repository", async () => {
    const github: RepositoryReconciliationClient = {
      getRepository: vi.fn().mockResolvedValue(null),
      generatePublicRepository: vi.fn(),
    };

    await expect(
      reconcilePublicTemplateRepository(
        reconciliationInput(github, new AbortController().signal, false)
      )
    ).rejects.toThrow(/manual attention/i);
    expect(github.generatePublicRepository).not.toHaveBeenCalled();
  });

  it("reconciles a lost or conflicting create response before considering reuse", async () => {
    const repository = matchingRepository();
    const github: RepositoryReconciliationClient = {
      getRepository: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(repository),
      generatePublicRepository: vi
        .fn()
        .mockRejectedValueOnce(new Error("response lost")),
    };

    const result = await reconcilePublicTemplateRepository(
      reconciliationInput(github, new AbortController().signal)
    );

    expect(result).toEqual(repository);
    expect(github.generatePublicRepository).toHaveBeenCalledTimes(1);
    expect(github.getRepository).toHaveBeenCalledTimes(2);
  });

  it("leaves create intent unset after lookup failure, then marks immediately before one create", async () => {
    const repository = matchingRepository();
    const events: string[] = [];
    const github: RepositoryReconciliationClient = {
      getRepository: vi
        .fn()
        .mockRejectedValueOnce(new Error("lookup unavailable"))
        .mockImplementationOnce(async () => {
          events.push("lookup");
          return null;
        })
        .mockImplementationOnce(async () => {
          events.push("reconcile");
          return repository;
        }),
      generatePublicRepository: vi.fn().mockImplementationOnce(async () => {
        events.push("create");
        return repository;
      }),
    };
    const markCreateRequested = vi.fn().mockImplementation(async () => {
      events.push("intent");
    });

    await expect(
      reconcilePublicTemplateRepository(
        reconciliationInput(
          github,
          new AbortController().signal,
          true,
          markCreateRequested
        )
      )
    ).rejects.toThrow("lookup unavailable");
    expect(markCreateRequested).not.toHaveBeenCalled();
    expect(github.generatePublicRepository).not.toHaveBeenCalled();

    const result = await reconcilePublicTemplateRepository(
      reconciliationInput(
        github,
        new AbortController().signal,
        true,
        markCreateRequested
      )
    );
    expect(result).toEqual(repository);
    expect(events).toEqual(["lookup", "intent", "create", "reconcile"]);
    expect(markCreateRequested).toHaveBeenCalledTimes(1);
    expect(github.generatePublicRepository).toHaveBeenCalledTimes(1);
  });

  it("reconciles only after an ambiguous create response has durable intent", async () => {
    const markCreateRequested = vi.fn().mockResolvedValue(undefined);
    const github: RepositoryReconciliationClient = {
      getRepository: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      generatePublicRepository: vi
        .fn()
        .mockRejectedValueOnce(new Error("create response lost")),
    };

    await expect(
      reconcilePublicTemplateRepository(
        reconciliationInput(
          github,
          new AbortController().signal,
          true,
          markCreateRequested
        )
      )
    ).rejects.toThrow("create response lost");
    expect(markCreateRequested).toHaveBeenCalledTimes(1);
    expect(github.generatePublicRepository).toHaveBeenCalledTimes(1);

    await expect(
      reconcilePublicTemplateRepository(
        reconciliationInput(
          github,
          new AbortController().signal,
          false,
          markCreateRequested
        )
      )
    ).rejects.toThrow(/manual attention/i);
    expect(markCreateRequested).toHaveBeenCalledTimes(1);
    expect(github.generatePublicRepository).toHaveBeenCalledTimes(1);
  });

  it("reconciles an aborted create only on a later call with a fresh deadline", async () => {
    const repository = matchingRepository();
    const firstController = new AbortController();
    const github: RepositoryReconciliationClient = {
      getRepository: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(repository),
      generatePublicRepository: vi.fn().mockImplementationOnce(async () => {
        firstController.abort(
          new DOMException("deadline exceeded", "AbortError")
        );
        throw firstController.signal.reason;
      }),
    };

    await expect(
      reconcilePublicTemplateRepository(
        reconciliationInput(github, firstController.signal)
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(github.getRepository).toHaveBeenCalledTimes(1);

    const result = await reconcilePublicTemplateRepository(
      reconciliationInput(github, new AbortController().signal, false)
    );
    expect(result).toEqual(repository);
    expect(github.generatePublicRepository).toHaveBeenCalledTimes(1);
    expect(github.getRepository).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["wrong owner", { ownerLogin: "other-owner" }],
    ["wrong name", { name: "lookalike" }],
    ["private visibility", { private: true, visibility: "private" }],
    ["wrong template", { templateRepositoryName: "other-template" }],
    ["unprovable template", { templateRepositoryName: null }],
  ])(
    "requires manual attention for an existing repository with %s",
    async (_label, override) => {
      const github: RepositoryReconciliationClient = {
        getRepository: vi
          .fn()
          .mockResolvedValue({ ...matchingRepository(), ...override }),
        generatePublicRepository: vi.fn(),
      };

      await expect(
        reconcilePublicTemplateRepository(
          reconciliationInput(github, new AbortController().signal)
        )
      ).rejects.toThrow(/manual attention/i);
      expect(github.generatePublicRepository).not.toHaveBeenCalled();
    }
  );
});
