import test from "node:test";
import assert from "node:assert/strict";
import { canonicalProductCategory } from "../js/data.js";
import {
  filterAndSortProducts,
  catalogFromConvexRows,
  CURATED_CATALOG_CREATED_AT_BASE,
} from "../js/filters.js";

function rowCommunity(overrides = {}) {
  return {
    _id: "kcommunity",
    slug: "test-user-widget",
    name: "Widget",
    brand: "W",
    category: "organization",
    tags: [],
    description: "d",
    verdict: "recommended",
    uploadedBy: "u1",
    createdAt: 2_000_000_000_000,
    ...overrides,
  };
}

function rowCurated(order, slug, extra = {}) {
  return {
    _id: `cid${order}`,
    slug,
    name: `Curated ${order}`,
    brand: "B",
    category: "organization",
    tags: [],
    description: "x",
    verdict: "recommended",
    uploadedBy: "neorgon",
    createdAt: CURATED_CATALOG_CREATED_AT_BASE + order,
    isCurated: true,
    catalogOrder: order,
    ...extra,
  };
}

test("catalogFromConvexRows orders curated then community", () => {
  const cat = catalogFromConvexRows([
    rowCommunity({ slug: "z-user", createdAt: 99 }),
    rowCurated(1, "a-cur"),
    rowCurated(2, "b-cur"),
  ]);
  assert.equal(cat[0].slug, "a-cur");
  assert.equal(cat[1].slug, "b-cur");
  assert.equal(cat[2].slug, "z-user");
  assert.equal(cat[0].isUserSubmitted, false);
  assert.equal(cat[2].isUserSubmitted, true);
});

test("filterAndSortProducts AND-tags + verdict", () => {
  const merged = catalogFromConvexRows([
    rowCurated(1, "cordless-vacuum", {
      category: "cleaning-lifestyle",
      tags: ["vacuum", "cleaning", "cordless"],
      description: "Freedom from cords.",
      verdict: "recommended",
    }),
  ]);
  const cordless = merged.find((p) => p.slug === "cordless-vacuum");
  assert.ok(cordless);
  const out = filterAndSortProducts({
    products: merged,
    activeCategory: "all",
    searchQuery: "",
    activeTags: ["vacuum", "cleaning"],
    verdictFilter: "recommended",
    sortBy: "default",
    voteCounts: {},
  });
  assert.ok(out.length >= 1);
  assert.ok(out.every((p) => p.verdict === "recommended"));
  assert.ok(
    out.every((p) => {
      const set = new Set((p.tags || []).map((t) => String(t).toLowerCase()));
      return ["vacuum", "cleaning"].every((t) => set.has(t));
    })
  );
});

test("sort by name is stable alphabetical", () => {
  const merged = catalogFromConvexRows([
    rowCurated(1, "x", { name: "Zebra" }),
    rowCurated(2, "y", { name: "Alpha" }),
    rowCurated(3, "z", { name: "Mike" }),
  ]);
  const out = filterAndSortProducts({
    products: merged,
    activeCategory: "all",
    searchQuery: "",
    activeTags: [],
    verdictFilter: "all",
    sortBy: "name",
    voteCounts: {},
  });
  const names = out.map((p) => p.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  assert.deepEqual(names, sorted);
});

test("default sort lists curated block before community submissions", () => {
  const merged = catalogFromConvexRows([
    rowCommunity({ slug: "user-only-item", name: "User Thing", createdAt: 9 }),
    rowCurated(1, "cur-one", { name: "Curated One" }),
  ]);
  const out = filterAndSortProducts({
    products: merged,
    activeCategory: "all",
    searchQuery: "",
    activeTags: [],
    verdictFilter: "all",
    sortBy: "default",
    voteCounts: {},
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].slug, "cur-one");
  assert.equal(out[1].slug, "user-only-item");
});

test("canonicalProductCategory maps spaced / cased labels to work-tech", () => {
  assert.equal(canonicalProductCategory("work-tech"), "work-tech");
  assert.equal(canonicalProductCategory("Work Tech"), "work-tech");
  assert.equal(canonicalProductCategory("WORK_TECH"), "work-tech");
  assert.equal(canonicalProductCategory("  work   tech  "), "work-tech");
  assert.equal(canonicalProductCategory("worktech"), "work-tech");
});

test("work-tech filter includes rows whose Convex category used human spacing", () => {
  const merged = catalogFromConvexRows([
    rowCurated(1, "trackpad", { category: "Work Tech", name: "Trackpad" }),
    rowCurated(2, "monitor", { category: "work-tech", name: "Monitor" }),
    rowCurated(3, "vacuum", { category: "cleaning-lifestyle", name: "Vacuum" }),
  ]);
  const out = filterAndSortProducts({
    products: merged,
    activeCategory: "work-tech",
    searchQuery: "",
    activeTags: [],
    verdictFilter: "all",
    sortBy: "default",
    voteCounts: {},
  });
  assert.equal(out.length, 2);
  assert.ok(out.every((p) => p.slug === "trackpad" || p.slug === "monitor"));
});
