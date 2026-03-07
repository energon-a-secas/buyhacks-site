import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** List all user-submitted products with image URLs. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").order("desc").collect();
    const results = [];
    for (const p of products) {
      let imageUrl = null;
      if (p.storageId) {
        imageUrl = await ctx.storage.getUrl(p.storageId);
      }
      results.push({ ...p, imageUrl });
    }
    return results;
  },
});

/** Generate an upload URL for product images. */
export const getUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Save a new user-submitted product. */
export const saveProduct = mutation({
  args: {
    name: v.string(),
    brand: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    description: v.string(),
    verdict: v.string(),
    note: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.uploadedBy.trim().toLowerCase()))
      .first();
    if (!user) {
      return { ok: false, error: "User not found" };
    }
    const slug = args.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) {
      return { ok: false, error: "Invalid product name" };
    }
    // Check for duplicate slug
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

    await ctx.db.insert("products", {
      slug: finalSlug,
      name: args.name.trim(),
      brand: args.brand.trim(),
      category: args.category,
      tags: args.tags,
      description: args.description.trim(),
      verdict: args.verdict,
      note: args.note?.trim() || undefined,
      storageId: args.storageId,
      uploadedBy: args.uploadedBy.trim().toLowerCase(),
      createdAt: Date.now(),
    });
    return { ok: true, slug: finalSlug };
  },
});

/** Admin-only: delete a user-submitted product. */
export const deleteProduct = mutation({
  args: { productId: v.id("products"), adminUsername: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.adminUsername.trim().toLowerCase()))
      .first();
    if (!admin || admin.role !== "admin") {
      return { ok: false, error: "Not authorized" };
    }
    const product = await ctx.db.get(args.productId);
    if (!product) return { ok: false, error: "Product not found" };
    if (product.storageId) {
      await ctx.storage.delete(product.storageId);
    }
    await ctx.db.delete(args.productId);
    return { ok: true };
  },
});
