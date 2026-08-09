import type { UserProfile } from "./user";

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

/** Either a normal sign-in (needs_profile: false) or a brand-new Google
 * identity that still needs age/sex/height before an account exists. */
export interface GoogleAuthResponse {
  needs_profile: boolean;
  google_token: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  access_token: string | null;
  token_type: string;
  user: UserProfile | null;
}
