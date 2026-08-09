import type { UserProfile } from "../types/user";

/** Resolution order: an explicit upload always wins (it's the user's most
 * recent, most deliberate choice), then the Google account picture (kept
 * fresh on every Google login — see backend's /auth/google), then null,
 * meaning the caller should fall back to an initials avatar. */
export function resolveAvatarUrl(user: Pick<UserProfile, "avatar_url" | "google_avatar_url">): string | null {
  return user.avatar_url ?? user.google_avatar_url ?? null;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
