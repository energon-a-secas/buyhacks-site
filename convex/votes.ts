import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** Get vote counts per product and this visitor's votes. */
export const getVotes = query({
  args: { visitorId: v.string() },
  handler: async (ctx, args) => {
    const allVotes = await ctx.db.query("votes").collect();

    // Counts per product per type: { slug: { love: N, own: N, want: N } }
    const counts: Record<string, Record<string, number>> = {};
    for (const vote of allVotes) {
      if (!counts[vote.productSlug]) counts[vote.productSlug] = { love: 0, own: 0, want: 0 };
      counts[vote.productSlug][vote.voteType] = (counts[vote.productSlug][vote.voteType] || 0) + 1;
    }

    // This visitor's votes: { slug: Set<voteType> }
    const myVotes = await ctx.db
      .query("votes")
      .withIndex("by_visitor_product", (q) => q.eq("visitorId", args.visitorId))
      .collect();

    const mine: Record<string, string[]> = {};
    for (const v of myVotes) {
      if (!mine[v.productSlug]) mine[v.productSlug] = [];
      mine[v.productSlug].push(v.voteType);
    }

    return { counts, mine };
  },
});

/** Toggle a vote: add if not present, remove if same type exists. */
export const toggleVote = mutation({
  args: { productSlug: v.string(), visitorId: v.string(), voteType: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_visitor_product", (q) =>
        q.eq("visitorId", args.visitorId).eq("productSlug", args.productSlug)
      )
      .collect();

    const match = existing.find((v) => v.voteType === args.voteType);

    if (match) {
      // Same type — remove (toggle off)
      await ctx.db.delete(match._id);
      return { action: "removed", voteType: args.voteType };
    } else {
      // Add this vote type (allows multiple types per product)
      await ctx.db.insert("votes", {
        productSlug: args.productSlug,
        visitorId: args.visitorId,
        voteType: args.voteType,
      });
      return { action: "added", voteType: args.voteType };
    }
  },
});
