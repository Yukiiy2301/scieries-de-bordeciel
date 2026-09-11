const PEPPER = "keizaal-scierie";

function fallbackHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/**
 * Hache le mot de passe (SHA-256 si disponible, sinon hash de secours).
 * On ne stocke jamais le mot de passe en clair.
 */
export async function hashPassword(password: string): Promise<string> {
  const input = `${PEPPER}:${password}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const data = new TextEncoder().encode(input);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // crypto.subtle indisponible (contexte non sécurisé) → repli
    }
  }
  return fallbackHash(input);
}

export function hasPassword(profile: { passwordHash?: string }): boolean {
  return Boolean(profile.passwordHash);
}
