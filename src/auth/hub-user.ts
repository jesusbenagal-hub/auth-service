import { z } from "zod";

import { AppRole } from "../generated/prisma/client.js";

/** Who is calling, as the access token says: what a guarded route gets. */
export interface HubUser {
  id: string;
  email: string;
  name: string | null;
  isHubAdmin: boolean;
  apps: Record<string, AppRole>;
}

// The claims AccessTokenService signs (§5.2), checked at runtime: a valid
// signature says we wrote the token, the schema says it has what we need.
const accessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  name: z.string().nullable(),
  hub_admin: z.boolean(),
  apps: z.record(z.string(), z.enum(AppRole)),
});

/** Turns the verified payload of an access token into a HubUser. */
export function toHubUser(payload: unknown): HubUser {
  const claims = accessTokenClaimsSchema.parse(payload);
  return {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
    isHubAdmin: claims.hub_admin,
    apps: claims.apps,
  };
}
