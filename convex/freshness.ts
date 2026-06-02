import { query } from "./_generated/server";
import { v } from "convex/values";

export const getFeed = query({
  args: {
    tipsLimit: v.optional(v.number()),
    productsLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const tipsLimit = Math.min(Math.max(args.tipsLimit ?? 12, 1), 50);
    const productsLimit = Math.min(Math.max(args.productsLimit ?? 8, 1), 30);

    const [hackDocs, allProducts] = await Promise.all([
      ctx.db
        .query("hacks")
        .withIndex("by_created", (q) => q)
        .order("desc")
        .take(tipsLimit),
      ctx.db.query("products").collect(),
    ]);

    allProducts.sort((a, b) => {
      const ca = typeof a.createdAt === "number" ? a.createdAt : a._creationTime;
      const cb = typeof b.createdAt === "number" ? b.createdAt : b._creationTime;
      return cb - ca;
    });
    const productDocs = allProducts.slice(0, productsLimit);

    const recentTips = hackDocs.map((h) => ({
      _id: h._id,
      productSlug: h.productSlug,
      text: h.text,
      submittedBy: h.submittedBy,
      createdAt: h.createdAt,
    }));

    const newestProducts = [];
    for (const p of productDocs) {
      let imageUrl = null;
      if (p.storageId) {
        imageUrl = await ctx.storage.getUrl(p.storageId);
      }
      newestProducts.push({ ...p, imageUrl });
    }

    return { recentTips, newestProducts };
  },
});
