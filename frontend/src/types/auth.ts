import type { UserProfile } from "./user";

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}
