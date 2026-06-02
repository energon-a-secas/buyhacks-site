import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    passwordHash: v.string(),
    role: v.optional(v.string()),
  }).index("by_username", ["username"]),

  votes: defineTable({
    productSlug: v.string(),
    visitorId: v.string(),
    voteType: v.string(), // "love" | "own" | "want"
  }).index("by_product", ["productSlug"])
    .index("by_visitor_product", ["visitorId", "productSlug"]),

  hacks: defineTable({
    productSlug: v.string(),
    text: v.string(),
    submittedBy: v.string(),
    visitorId: v.string(),
    createdAt: v.number(),
  }).index("by_product", ["productSlug"])
    .index("by_visitor", ["visitorId"])
    .index("by_created", ["createdAt"]),

  products: defineTable({
    slug: v.string(),
    name: v.string(),
    brand: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    description: v.string(),
    verdict: v.string(),
    note: v.optional(v.string()),
    productUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    /** Site-relative image path (e.g. images/foo.png) for curated rows without Convex storage. */
    imagePath: v.optional(v.string()),
    /** Curator-written tips (migrated catalog); community tips stay in `hacks`. */
    tips: v.optional(v.array(v.string())),
    /** Migrated BuyHacks catalog entries vs community submissions. */
    isCurated: v.optional(v.boolean()),
    /** Display order among curated items (1-based); undefined for user submissions. */
    catalogOrder: v.optional(v.number()),
    uploadedBy: v.string(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"])
    .index("by_createdAt", ["createdAt"]),

  clerkAccountLinks: defineTable({
    clerkSubject: v.string(),
    legacyUsername: v.string(),
    legacyConvexUserId: v.id("users"),
    legacyRole: v.optional(v.string()),
    linkedAt: v.number(),
  })
    .index("by_subject", ["clerkSubject"])
    .index("by_legacy_username", ["legacyUsername"]),

  userSettings: defineTable({
    clerkSubject: v.string(),
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  })
    .index("by_owner_key", ["clerkSubject", "key"])
    .index("by_subject", ["clerkSubject"]),
});
