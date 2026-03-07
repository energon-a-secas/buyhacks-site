import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** Get all hacks grouped by product. */
export const getHacks = query({
  args: {},
  handler: async (ctx) => {
    const allHacks = await ctx.db.query("hacks").collect();

    const byProduct: Record<string, Array<{ text: string; submittedBy: string; createdAt: number }>> = {};
    for (const hack of allHacks) {
      if (!byProduct[hack.productSlug]) byProduct[hack.productSlug] = [];
      byProduct[hack.productSlug].push({
        text: hack.text,
        submittedBy: hack.submittedBy,
        createdAt: hack.createdAt,
      });
    }

    // Sort each product's hacks newest first
    for (const slug of Object.keys(byProduct)) {
      byProduct[slug].sort((a, b) => b.createdAt - a.createdAt);
    }

    return byProduct;
  },
});

/** Submit a hack tip for a product. Max 3 per visitor per product. */
export const submitHack = mutation({
  args: {
    productSlug: v.string(),
    text: v.string(),
    submittedBy: v.string(),
    visitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmed = args.text.trim();
    if (trimmed.length === 0 || trimmed.length > 280) {
      return { ok: false, error: "Hack must be 1-280 characters" };
    }

    // Rate limit: max 3 hacks per visitor per product
    const existing = await ctx.db
      .query("hacks")
      .withIndex("by_product", (q) => q.eq("productSlug", args.productSlug))
      .collect();

    const visitorCount = existing.filter((h) => h.visitorId === args.visitorId).length;
    if (visitorCount >= 3) {
      return { ok: false, error: "Max 3 tips per product reached" };
    }

    await ctx.db.insert("hacks", {
      productSlug: args.productSlug,
      text: trimmed,
      submittedBy: args.submittedBy,
      visitorId: args.visitorId,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});
