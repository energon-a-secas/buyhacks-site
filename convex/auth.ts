import { query } from "./_generated/server";

function adminSubjects(): string[] {
  return (process.env.ADMIN_SUBJECTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when the signed-in Clerk user is in ADMIN_SUBJECTS (Convex dashboard). */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    return adminSubjects().includes(identity.subject);
  },
});

// The password-era register, login, setRole and getRole were deleted on
// 2026-09-18 (queue #63c). They lost their last caller when the Auth Kit landed
// on 2026-09-10 and stayed deployed, so this deployment's public URL, which sits
// in js/state.js, still answered them:
//
//   register  inserted a users row for anyone who asked, unauthenticated and
//             uncapped, and made the first caller an admin.
//   login     confirmed a legacy username plus password with no rate limit,
//             which is a free oracle for exactly the credentials
//             migration.ts:linkLegacyAccount accepts, over a 32-bit
//             non-cryptographic digest.
//   setRole   trusted an adminUsername the caller supplied.
//
// Nothing was lost: legacy sign-in is Clerk's, and linkLegacyAccount verifies
// legacy passwords itself, so linking still works. The users table and its
// by_username index stay in schema.ts because that is what it reads.
