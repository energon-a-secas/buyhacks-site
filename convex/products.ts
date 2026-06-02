import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { CURATED_CATALOG } from "./curatedCatalog";

/** Stable synthetic createdAt for curated rows (ordering + freshness). */
const CURATED_CREATED_AT_BASE = 1_704_067_200_000;

function normalizeProductUrl(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  if (t.length > 2048 || !/^https?:\/\//i.test(t)) return undefined;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

function displayFromIdentity(identity: { name?: string; email?: string; subject: string }) {
  if (identity.name && String(identity.name).trim()) return String(identity.name).trim();
  if (identity.email) {
    const local = identity.email.split("@")[0];
    if (local) return local;
  }
  return identity.subject.slice(0, 12);
}

const PRODUCT_CATEGORY_IDS = new Set([
  "organization",
  "cleaning-lifestyle",
  "work-tech",
  "specific-useful",
  "aliexpress",
  "house-tools",
  "tried-but",
]);

/** Match `canonicalProductCategory` in `js/data.js` — keeps filters aligned with stored rows. */
function canonicalProductCategoryServer(raw: string): string {
  let id = raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  id = id.replace(/--+/g, "-").replace(/^-+|-+$/g, "");
  if (id === "cleaning-&-lifestyle" || id === "cleaning-and-lifestyle") return "cleaning-lifestyle";
  if (PRODUCT_CATEGORY_IDS.has(id)) return id;
  const compact = id.replace(/-/g, "").replace(/[^a-z0-9]/g, "");
  const COMPACT: Record<string, string> = {
    organization: "organization",
    cleaninglifestyle: "cleaning-lifestyle",
    worktech: "work-tech",
    specificuseful: "specific-useful",
    aliexpress: "aliexpress",
    housetools: "house-tools",
    triedbut: "tried-but",
  };
  const fromCompact = COMPACT[compact];
  if (fromCompact && PRODUCT_CATEGORY_IDS.has(fromCompact)) return fromCompact;
  return id;
}

/** Resolved id, or `null` if the string cannot be mapped to a catalog category. */
function resolveProductCategoryServer(raw: string): string | null {
  const id = canonicalProductCategoryServer(raw);
  return PRODUCT_CATEGORY_IDS.has(id) ? id : null;
}

/** List all products with image URLs (newest first). Uses full-table read so rows missing `createdAt` are not dropped from the `by_createdAt` index. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    products.sort((a, b) => {
      const ca = typeof a.createdAt === "number" ? a.createdAt : a._creationTime;
      const cb = typeof b.createdAt === "number" ? b.createdAt : b._creationTime;
      return cb - ca;
    });
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

/**
 * One-time (or idempotent) import of the 24 curated catalog rows.
 * Set `BUYHACKS_SEED_SECRET` in the Convex dashboard, then run:
 * `npx convex run products:seedCuratedCatalog '{"secret":"YOUR_SECRET"}'`
 * Skips any row whose `slug` already exists.
 */
export const seedCuratedCatalog = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.BUYHACKS_SEED_SECRET;
    if (!expected || args.secret !== expected) {
      return { ok: false, error: "Set BUYHACKS_SEED_SECRET in Convex env and pass the same value as `secret`." };
    }
    let inserted = 0;
    let skipped = 0;
    for (const row of CURATED_CATALOG) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", row.slug))
        .first();
      if (existing) {
        skipped++;
        continue;
      }
      const productUrl = row.productUrl ? normalizeProductUrl(row.productUrl) : undefined;
      await ctx.db.insert("products", {
        slug: row.slug,
        name: row.name,
        brand: row.brand,
        category: row.category,
        tags: row.tags,
        description: row.description,
        verdict: row.verdict,
        note: row.note?.trim() || undefined,
        productUrl,
        tips: row.tips.length > 0 ? row.tips : undefined,
        imagePath: row.imagePath || undefined,
        isCurated: true,
        catalogOrder: row.catalogOrder,
        uploadedBy: "neorgon",
        createdAt: CURATED_CREATED_AT_BASE + row.catalogOrder,
      });
      inserted++;
    }
    return { ok: true, inserted, skipped, expected: CURATED_CATALOG.length };
  },
});

/**
 * Fix category strings already in the DB (e.g. "Work Tech" → "work-tech") so filters match.
 * Uses the same `BUYHACKS_SEED_SECRET` as `seedCuratedCatalog`.
 */
export const repairProductCategorySlugs = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.BUYHACKS_SEED_SECRET;
    if (!expected || args.secret !== expected) {
      return { ok: false, error: "Set BUYHACKS_SEED_SECRET and pass the same value as `secret`." };
    }
    const all = await ctx.db.query("products").collect();
    /** Raw `category` string as stored → row count (for debugging). */
    const categoryHistogram: Record<string, number> = {};
    const unrecognized = new Set<string>();
    let updated = 0;
    for (const p of all) {
      const raw = String(p.category ?? "");
      categoryHistogram[raw] = (categoryHistogram[raw] || 0) + 1;
      const next = resolveProductCategoryServer(raw);
      if (next === null) {
        unrecognized.add(raw);
        continue;
      }
      if (next !== p.category) {
        await ctx.db.patch(p._id, { category: next });
        updated++;
      }
    }
    return {
      ok: true,
      updated,
      scanned: all.length,
      categoryHistogram,
      unrecognized: Array.from(unrecognized).slice(0, 30),
    };
  },
});

/**
 * Backfill `createdAt` from `_creationTime` when missing (older rows were invisible to `by_createdAt` index scans).
 * Same `BUYHACKS_SEED_SECRET` as seed/repair.
 */
export const backfillProductCreatedAt = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.BUYHACKS_SEED_SECRET;
    if (!expected || args.secret !== expected) {
      return { ok: false, error: "Set BUYHACKS_SEED_SECRET and pass the same value as `secret`." };
    }
    const all = await ctx.db.query("products").collect();
    let updated = 0;
    for (const p of all) {
      if (typeof p.createdAt !== "number") {
        await ctx.db.patch(p._id, { createdAt: p._creationTime });
        updated++;
      }
    }
    return { ok: true, updated, scanned: all.length };
  },
});

/** Generate an upload URL for product images. */
export const getUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
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
    productUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { ok: false, error: "Not authenticated" };
    }
    const uploadedBy = displayFromIdentity(identity).toLowerCase();
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

    const productUrl = normalizeProductUrl(args.productUrl);

    const category = resolveProductCategoryServer(args.category);
    if (category === null) {
      return { ok: false, error: "Invalid category" };
    }

    await ctx.db.insert("products", {
      slug: finalSlug,
      name: args.name.trim(),
      brand: args.brand.trim(),
      category,
      tags: args.tags,
      description: args.description.trim(),
      verdict: args.verdict,
      note: args.note?.trim() || undefined,
      productUrl,
      storageId: args.storageId,
      uploadedBy,
      createdAt: Date.now(),
    });
    return { ok: true, slug: finalSlug };
  },
});

/** Admin-only: delete a user-submitted product. */
export const deleteProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, error: "Not authenticated" };
    const admins = (process.env.ADMIN_SUBJECTS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!admins.includes(identity.subject)) {
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
