import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple hash — not cryptographic, but sufficient for a fun site.
// For production auth, use Convex Auth or a proper auth provider.
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  // Mix with salt-like constant for basic obfuscation
  hash = ((hash >>> 0) * 2654435761) >>> 0;
  return hash.toString(36);
}

export const register = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    if (username.length < 2 || username.length > 20) {
      return { ok: false, error: "Username must be 2-20 characters" };
    }
    if (args.password.length < 4) {
      return { ok: false, error: "Password must be at least 4 characters" };
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (existing) {
      return { ok: false, error: "Username already taken" };
    }
    await ctx.db.insert("users", {
      username,
      passwordHash: simpleHash(args.password),
    });
    return { ok: true, username };
  },
});

export const login = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (!user || user.passwordHash !== simpleHash(args.password)) {
      return { ok: false, error: "Invalid username or password" };
    }
    return { ok: true, username: user.username };
  },
});
