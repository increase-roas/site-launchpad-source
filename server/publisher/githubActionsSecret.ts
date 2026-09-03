import sodium from "libsodium-wrappers";

export async function encryptGitHubActionsSecret(
  publicKeyBase64: string,
  plaintext: string,
): Promise<string> {
  await sodium.ready;
  const publicKey = sodium.from_base64(
    publicKeyBase64,
    sodium.base64_variants.ORIGINAL,
  );
  const sealed = sodium.crypto_box_seal(
    sodium.from_string(plaintext),
    publicKey,
  );
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}
