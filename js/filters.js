import { sanitizeExternalUrl } from "./utils.js";
import { canonicalProductCategory } from "./data.js";

/** Synthetic timestamp base for curated rows (matches Convex seed). */
export const CURATED_CATALOG_CREATED_AT_BASE = 1_704_067_200_000;

export function mapConvexProduct(p) {
  const isCurated = !!p.isCurated;
  const image = p.imageUrl || p.imagePath || null;
  const tips = Array.isArray(p.tips) ? p.tips : [];
  const url = sanitizeExternalUrl(p.productUrl || "") || null;
  return {
    id: p._id,
    _id: p._id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: canonicalProductCategory(p.category),
    tags: p.tags || [],
    description: p.description,
    image,
    tips,
    note: p.note || null,
    productUrl: url || undefined,
    verdict: p.verdict,
    uploadedBy: p.uploadedBy,
    isUserSubmitted: !isCurated,
    catalogOrder: p.catalogOrder,
    createdAtForSort: typeof p.createdAt === "number" ? p.createdAt : 0,
  };
}

/** Curated block first (by catalogOrder), then community submissions (newest first). */
function sortCatalogDisplayOrder(mapped) {
  return [...mapped].sort((a, b) => {
    const ao = a.catalogOrder;
    const bo = b.catalogOrder;
    const aCur = ao != null;
    const bCur = bo != null;
    if (aCur && bCur) return ao - bo;
    if (aCur && !bCur) return -1;
    if (!aCur && bCur) return 1;
    return (b.createdAtForSort || 0) - (a.createdAtForSort || 0);
  });
}

/** Map Convex `products:list` rows into UI models in browse order. */
export function catalogFromConvexRows(rows) {
  return sortCatalogDisplayOrder((rows || []).map(mapConvexProduct));
}

export function filterAndSortProducts({
  products,
  activeCategory,
  searchQuery,
  activeTags,
  verdictFilter,
  sortBy,
  voteCounts,
}) {
  let list = products;

  if (activeCategory !== "all") {
    const ac = activeCategory;
    list = list.filter((p) => canonicalProductCategory(p.category) === ac);
  }

  if (verdictFilter && verdictFilter !== "all") {
    list = list.filter((p) => p.verdict === verdictFilter);
  }

  const tagFilter = activeTags || [];
  if (tagFilter.length) {
    list = list.filter((p) => {
      const set = new Set((p.tags || []).map((t) => String(t).toLowerCase()));
      return tagFilter.every((t) => set.has(t));
    });
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => String(t).toLowerCase().includes(q))
    );
  }

  if (sortBy === "love" || sortBy === "own" || sortBy === "want") {
    list = [...list].sort((a, b) => {
      const ca = (voteCounts[a.slug] || {})[sortBy] || 0;
      const cb = (voteCounts[b.slug] || {})[sortBy] || 0;
      return cb - ca;
    });
  } else if (sortBy === "newest") {
    list = [...list].sort((a, b) => (b.createdAtForSort || 0) - (a.createdAtForSort || 0));
  } else if (sortBy === "name") {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } else if (sortBy === "default") {
    list = sortCatalogDisplayOrder(list);
  }

  return list;
}
