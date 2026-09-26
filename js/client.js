// Load the optional SDK after the public controls have been bound. Account
// tokens may arrive before the SDK; retain the latest one until it is ready.
const CONVEX_URL = 'https://formal-lemur-640.convex.cloud';
let client;
let pending;
let token = null;

function getClient() {
  if (!pending) {
    pending = import('https://esm.sh/convex@1.21.0/browser').then(({ ConvexHttpClient }) => {
      client = new ConvexHttpClient(CONVEX_URL);
      if (token) client.setAuth(token);
      return client;
    }).catch(error => { pending = null; throw error; });
  }
  return pending;
}

function bounded(promise) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out')), 12000); }),
  ]).finally(() => clearTimeout(timer));
}

export const convex = {
  query: (...args) => bounded(getClient().then(ready => ready.query(...args))),
  // Once dispatched, a write must settle itself. A timeout could encourage a
  // duplicate submission while the original write is still being accepted.
  mutation: async (...args) => (await bounded(getClient())).mutation(...args),
  setAuth(value) { token = value; client?.setAuth(value); },
  clearAuth() { token = null; client?.clearAuth(); },
};
