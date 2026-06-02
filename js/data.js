// ── Categories + verdict labels (UI chrome). Product rows load from Convex. ──

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "organization", label: "Organization" },
  { id: "cleaning-lifestyle", label: "Cleaning & Lifestyle" },
  { id: "work-tech", label: "Work Tech" },
  { id: "specific-useful", label: "Specific But Useful" },
  { id: "aliexpress", label: "AliExpress Finds" },
  { id: "house-tools", label: "House Tools" },
  { id: "tried-but", label: "Tried But..." },
];

const CATEGORY_ID_SET = new Set(CATEGORIES.map((c) => c.id));

/** Label-ish variants that may appear in Convex after manual edits or imports. */
const CATEGORY_ALIASES = {
  "cleaning-&-lifestyle": "cleaning-lifestyle",
  "cleaning-and-lifestyle": "cleaning-lifestyle",
};

/** Keys = category with all hyphens removed (e.g. DB typo `worktech`). */
const CATEGORY_COMPACT_TO_ID = {
  organization: "organization",
  cleaninglifestyle: "cleaning-lifestyle",
  worktech: "work-tech",
  specificuseful: "specific-useful",
  aliexpress: "aliexpress",
  housetools: "house-tools",
  triedbut: "tried-but",
};

/**
 * Normalize stored `product.category` (spaces, case, underscores) to the canonical id
 * used in filters and the category select (e.g. "Work Tech" → "work-tech").
 */
export function canonicalProductCategory(raw) {
  if (raw == null || raw === "") return "";
  let id = String(raw).trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  id = id.replace(/--+/g, "-").replace(/^-+|-+$/g, "");
  if (CATEGORY_ID_SET.has(id)) return id;
  const mapped = CATEGORY_ALIASES[id];
  if (mapped && CATEGORY_ID_SET.has(mapped)) return mapped;
  const compact = id.replace(/-/g, "").replace(/[^a-z0-9]/g, "");
  const fromCompact = CATEGORY_COMPACT_TO_ID[compact];
  if (fromCompact && CATEGORY_ID_SET.has(fromCompact)) return fromCompact;
  return id;
}

/** Clamp URL / state to a real category id so filters never use a stale or unknown value. */
export function normalizeCategoryId(raw) {
  if (raw == null || raw === "") return "all";
  const lowered = String(raw).trim().toLowerCase();
  if (lowered === "all") return "all";
  const id = canonicalProductCategory(raw);
  if (id === "") return "all";
  return CATEGORY_ID_SET.has(id) ? id : "all";
}

export const VERDICT_LABELS = {
  recommended: "Recommended",
  mixed: "Mixed Feelings",
  skip: "Skip",
};

/** Find related products by tag intersection (min 2 shared tags). */
export function getRelatedProducts(products, slug) {
  const list = products || [];
  const product = list.find((p) => p.slug === slug);
  if (!product) return [];
  return list
    .filter((p) => p.slug !== slug)
    .map((p) => ({
      ...p,
      shared: p.tags.filter((t) => product.tags.includes(t)).length,
    }))
    .filter((p) => p.shared >= 2)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3);
}
