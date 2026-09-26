import test from 'node:test';
import assert from 'node:assert/strict';
import { readBrowseState, urlForBrowseState } from '../js/url-sync.js';

test('browse URLs preserve themes and reset missing or invalid fields', () => {
  const state = readBrowseState('https://buyhacks.test/?q=desk&cat=Work+Tech&view=compact&sort=love');
  assert.deepEqual(state, {searchQuery:'desk',activeCategory:'work-tech',viewMode:'compact',sortBy:'love'});
  const url = urlForBrowseState('https://buyhacks.test/?theme=rain&utm=x#main',state);
  assert.equal(url.searchParams.get('theme'),'rain');
  assert.equal(url.searchParams.get('utm'),'x');
  assert.equal(url.hash,'#main');
  assert.deepEqual(readBrowseState(url),state);
  assert.deepEqual(readBrowseState('https://buyhacks.test/?cat=unknown&view=bad&sort=bad'), {
    searchQuery:'',activeCategory:'all',viewMode:'grid',sortBy:'default',
  });
  assert.equal(readBrowseState('https://buyhacks.test/?q='+'a'.repeat(500)).searchQuery.length,300);
});
