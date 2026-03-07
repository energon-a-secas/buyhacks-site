import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    passwordHash: v.string(),
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
    .index("by_visitor", ["visitorId"]),
});
