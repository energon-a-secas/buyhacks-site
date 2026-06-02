import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Legacy digest used by memes, buyhacks, character-sheet, etc. */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  hash = ((hash >>> 0) * 2654435761) >>> 0;
  return hash.toString(36);
}

/** gamebin-site `hashStr` (see `gamebin-site/js/events.js`). */
function gamebinHashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h = ((h << 5) - h) + ch;
    h = h & h;
  }
  return "h_" + Math.abs(h).toString(36);
}

function legacyPasswordMatches(stored: string, plain: string): boolean {
  if (stored === simpleHash(plain)) return true;
  if (stored === gamebinHashStr(plain)) return true;
  try {
    if (stored === btoa(plain)) return true;
  } catch {
    /* btoa fails on some Unicode; ignore */
  }
  return false;
}

/** Row linking the current Clerk JWT to a legacy `users` document (no password stored here). */
export const myAccountLink = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("clerkAccountLinks")
      .withIndex("by_subject", (q) => q.eq("clerkSubject", identity.subject))
      .first();
  },
});

/**
 * After signing in with Clerk, call once with the old Neorgon username + password.
 * Verifies against the legacy `users` table, then inserts `clerkAccountLinks`.
 * Passwords are never written to `clerkAccountLinks` or `userSettings`.
 */
export const linkLegacyAccount = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const subject = identity.subject;

    const existingSubject = await ctx.db
      .query("clerkAccountLinks")
      .withIndex("by_subject", (q) => q.eq("clerkSubject", subject))
      .first();
    if (existingSubject) {
      return { ok: false, error: "This Clerk account is already linked to a legacy profile." };
    }

    const raw = args.username.trim();
    const lower = raw.toLowerCase();
    let user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", lower))
      .first();
    if (!user && raw !== lower) {
      user = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", raw))
        .first();
    }

    if (!user || !legacyPasswordMatches(user.passwordHash, args.password)) {
      return { ok: false, error: "Invalid username or password" };
    }

    const taken = await ctx.db
      .query("clerkAccountLinks")
      .withIndex("by_legacy_username", (q) => q.eq("legacyUsername", user.username))
      .first();
    if (taken) {
      return { ok: false, error: "That legacy account is already linked to another Clerk sign-in." };
    }

    const role = "role" in user ? (user as { role?: string }).role : undefined;

    await ctx.db.insert("clerkAccountLinks", {
      clerkSubject: subject,
      legacyUsername: user.username,
      legacyConvexUserId: user._id,
      legacyRole: role,
      linkedAt: Date.now(),
    });

    return { ok: true, legacyUsername: user.username };
  },
});

export const getUserSetting = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const row = await ctx.db
      .query("userSettings")
      .withIndex("by_owner_key", (q) =>
        q.eq("clerkSubject", identity.subject).eq("key", key),
      )
      .first();
    return row?.value ?? null;
  },
});

export const setUserSetting = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_owner_key", (q) =>
        q.eq("clerkSubject", identity.subject).eq("key", key),
      )
      .first();
    const now = Date.now();
    if (existing) await ctx.db.patch(existing._id, { value, updatedAt: now });
    else {
      await ctx.db.insert("userSettings", {
        clerkSubject: identity.subject,
        key,
        value,
        updatedAt: now,
      });
    }
    return { ok: true };
  },
});

export const listUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("userSettings")
      .withIndex("by_subject", (q) => q.eq("clerkSubject", identity.subject))
      .collect();
  },
});
