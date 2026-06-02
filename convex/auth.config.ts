import type { AuthConfig } from "convex/server";

const CLERK_JWT_ISSUER = "https://liked-pup-17.clerk.accounts.dev";

export default {
  providers: [
    {
      domain: CLERK_JWT_ISSUER,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
