#!/usr/bin/env node
// Compare the Convex functions a deployment serves with the ones convex/
// exports. Deleting a function from source does not withdraw it from a
// deployment, only a push does, and nothing else reports the gap: the four
// password-era auth functions deleted on 2026-09-18 (queue #63) kept answering
// on both deployments for weeks. Read-only: it runs `convex function-spec`,
// never a push.
//
//   node scripts/check-deployed.mjs           the deployment the shipped page
//                                             calls (the URL in js/client.js)
//   node scripts/check-deployed.mjs --prod    the project's production deployment
//   node scripts/check-deployed.mjs --spec F  a saved function-spec JSON, offline
//   node scripts/check-deployed.mjs --guard   only check that .env.local selects
//                                             the deployment the shipped page
//                                             calls, so `convex dev --once`
//                                             pushes to the one people use
//
// Exit 0 when the deployment serves exactly what source exports, 1 on any
// difference (or a failed guard), 2 on a usage or tooling error.
//
// Limit: only the built-in constructors (query, mutation, action and their
// internal forms, httpAction) are recognised in source. A function built with a
// custom wrapper would be reported as stale.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CONSTRUCTORS = 'query|mutation|action|internalQuery|internalMutation|internalAction|httpAction';
const NAMED_EXPORT = new RegExp(`^export\\s+const\\s+(\\w+)\\s*=\\s*(?:${CONSTRUCTORS})\\s*\\(`, 'gm');
const DEFAULT_EXPORT = new RegExp(`^export\\s+default\\s+(?:${CONSTRUCTORS})\\s*\\(`, 'm');
const SKIP_FILES = new Set(['schema.ts', 'auth.config.ts', 'convex.config.ts', 'crons.ts', 'http.ts']);

/** Identifiers as function-spec spells them, e.g. `auth.js:isAdmin`, for one file's source. */
export function exportsOf(modulePath, text) {
  const mod = modulePath.replace(/\.(ts|js)$/, '.js');
  const names = [...text.matchAll(NAMED_EXPORT)].map((m) => `${mod}:${m[1]}`);
  if (DEFAULT_EXPORT.test(text)) names.push(`${mod}:default`);
  return names;
}

/** Every registered function exported under convexDir, sorted. */
export function sourceFunctions(convexDir) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '_generated' && entry.name !== 'node_modules') walk(full);
        continue;
      }
      if (!/\.(ts|js)$/.test(entry.name) || /\.d\.ts$/.test(entry.name)) continue;
      const rel = relative(convexDir, full).split(sep).join('/');
      if (SKIP_FILES.has(rel)) continue;
      out.push(...exportsOf(rel, readFileSync(full, 'utf8')));
    }
  };
  walk(convexDir);
  return out.sort();
}

/** Identifiers a `convex function-spec` JSON lists, sorted. */
export function deployedFunctions(spec) {
  if (!spec || !Array.isArray(spec.functions)) throw new Error('not a convex function-spec: no functions array');
  return spec.functions.map((f) => f.identifier).sort();
}

/** What a deployment serves that source no longer exports, and the reverse. */
export function compare(source, deployed) {
  const src = new Set(source);
  const dep = new Set(deployed);
  return {
    stale: deployed.filter((id) => !src.has(id)),
    missing: source.filter((id) => !dep.has(id)),
  };
}

/** The one deployment name the shipped page calls, from js/client.js. */
export function shippedDeployment(clientJs) {
  const names = new Set([...clientJs.matchAll(/https:\/\/([a-z0-9-]+)\.convex\.cloud/g)].map((m) => m[1]));
  if (names.size !== 1) throw new Error(`expected one *.convex.cloud URL in js/client.js, found ${names.size}`);
  return [...names][0];
}

/** The deployment name CONVEX_DEPLOYMENT selects in .env.local text, or null. Reads that one line only. */
export function envDeployment(envText) {
  const m = envText.match(/^CONVEX_DEPLOYMENT=([^\s#]+)/m);
  if (!m) return null;
  return m[1].split(':').pop();
}

/** The frontend's `api` string map in js/state.js, as function-spec identifiers. */
export function frontendCalls(stateJs) {
  const block = stateJs.match(/export const api = \{([\s\S]*?)\n\};/);
  if (!block) throw new Error('no `export const api = {` block in js/state.js');
  return [...block[1].matchAll(/"([\w/]+):(\w+)"/g)].map((m) => `${m[1]}.js:${m[2]}`).sort();
}

function report(label, source, deployed) {
  const { stale, missing } = compare(source, deployed);
  console.log(`${label}: ${deployed.length} deployed, ${source.length} in source`);
  if (stale.length) {
    console.log(`  stale, deployed but no longer in source (${stale.length}):`);
    for (const id of stale) console.log(`    ${id}`);
  }
  if (missing.length) {
    console.log(`  in source but not deployed (${missing.length}):`);
    for (const id of missing) console.log(`    ${id}`);
  }
  if (stale.length || missing.length) {
    console.log('  FAIL: this deployment does not serve what source exports; `make deploy` pushes it');
    return 1;
  }
  console.log('  ok: serves exactly what source exports');
  return 0;
}

function fail(message) {
  console.error(`check-deployed: ${message}`);
  process.exit(2);
}

function main(argv) {
  const args = argv.slice(2);
  const shipped = shippedDeployment(readFileSync(join(ROOT, 'js/client.js'), 'utf8'));

  if (args[0] === '--guard') {
    const envPath = join(ROOT, '.env.local');
    if (!existsSync(envPath)) {
      console.error('check-deployed: no .env.local, so `convex dev --once` has no deployment to push to.');
      console.error(`  Run \`npx convex dev --configure existing\` once and pick ${shipped}.`);
      return 1;
    }
    const selected = envDeployment(readFileSync(envPath, 'utf8'));
    if (selected !== shipped) {
      console.error(`check-deployed: .env.local selects ${selected ?? 'no deployment'}, but the shipped page calls ${shipped}.`);
      console.error('  `convex dev --once` would push to a deployment the live site does not call. Refusing.');
      return 1;
    }
    console.log(`guard ok: .env.local selects ${shipped}, the deployment js/client.js calls`);
    return 0;
  }

  const source = sourceFunctions(join(ROOT, 'convex'));

  if (args[0] === '--spec') {
    if (!args[1]) fail('--spec needs a file');
    return report(args[1], source, deployedFunctions(JSON.parse(readFileSync(args[1], 'utf8'))));
  }

  let target;
  let label;
  if (args.length === 0) {
    target = ['--deployment', shipped];
    label = `${shipped} (the deployment js/client.js calls)`;
  } else if (args[0] === '--prod' && args.length === 1) {
    target = ['--prod'];
    label = 'production deployment (--prod)';
  } else {
    fail(`unknown arguments: ${args.join(' ')}`);
  }

  let raw;
  try {
    raw = execFileSync('npx', ['--no-install', 'convex', 'function-spec', ...target], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    fail(`convex function-spec failed: ${(err.stderr || err.message || '').trim().split('\n').pop()}`);
  }
  return report(label, source, deployedFunctions(JSON.parse(raw)));
}

// Compared through realpath: import.meta.url is resolved, argv[1] is not, so a
// symlinked path (macOS /var is one) would otherwise skip main and exit 0.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv);
}
