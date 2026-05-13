import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "../src/lib/crypto";
import { maskSecret } from "../src/lib/utils";

describe("secret encryption", () => {
  it("round trips secrets without storing plaintext", () => {
    process.env.MASTER_ENCRYPTION_KEY = "joWK4aC1M2Bf77FxBWN8fAisrBRRuV6I0ajYe4DJ1ug=";

    const encrypted = encryptSecret("sk-test-1234567890");

    expect(encrypted).not.toContain("sk-test");
    expect(decryptSecret(encrypted)).toBe("sk-test-1234567890");
  });

  it("masks secrets for display", () => {
    expect(maskSecret("sk-abcdefghijkl")).toBe("sk-a...ijkl");
  });
});
