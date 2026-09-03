import { describe, expect, it } from "vitest";
import sodium from "libsodium-wrappers";
import { encryptGitHubActionsSecret } from "./githubActionsSecret";

describe("GitHub Actions secret encryption", () => {
  it("seals plaintext so only the repository public key can open it", async () => {
    await sodium.ready;
    const { publicKey, privateKey } = sodium.crypto_box_keypair();
    const publicKeyB64 = sodium.to_base64(
      publicKey,
      sodium.base64_variants.ORIGINAL,
    );
    const sealedB64 = await encryptGitHubActionsSecret(
      publicKeyB64,
      "publisher-token",
    );
    expect(sealedB64).not.toContain("publisher-token");
    const opened = sodium.crypto_box_seal_open(
      sodium.from_base64(sealedB64, sodium.base64_variants.ORIGINAL),
      publicKey,
      privateKey,
    );
    expect(sodium.to_string(opened)).toBe("publisher-token");
  });
});
