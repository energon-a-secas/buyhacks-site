import { normalizeCategoryId } from "./data.js";
import { state } from './state.js';
import { updateQuery, createQueryHistory } from './neorgon-navigation.js';

export function readBrowseState(href) {
  const p = new URL(href).searchParams;
  return {
    searchQuery: (p.get('q') || '').trim().slice(0, 300),
    activeCategory: normalizeCategoryId(p.get('cat')),
    sortBy: ['default', 'love', 'own', 'want', 'newest', 'name'].includes(p.get('sort')) ? p.get('sort') : 'default',
    viewMode: p.get('view') === 'compact' ? 'compact' : 'grid',
  };
}

export function readUrlIntoState(state) {
  Object.assign(state, readBrowseState(location.href));
}

export function urlForBrowseState(href, state) {
  const values = { q: state.searchQuery.trim(), cat: state.activeCategory === 'all' ? '' : state.activeCategory,
    sort: state.sortBy === 'default' ? '' : state.sortBy, view: state.viewMode };
  return updateQuery(href, values);
}

export const navigation = createQueryHistory(href => urlForBrowseState(href, state));
