import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compare, deployedFunctions, envDeployment, exportsOf, frontendCalls,
  shippedDeployment, sourceFunctions,
} from '../scripts/check-deployed.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts/check-deployed.mjs');
const source = sourceFunctions(join(root, 'convex'));
const DELETED = ['auth.js:register', 'auth.js:login', 'auth.js:setRole', 'auth.js:getRole'];

const spec = (ids) => ({
  url: 'https://example-test-123.convex.cloud',
  functions: ids.map((identifier) => ({ identifier, functionType: 'Query', visibility: { kind: 'public' } })),
});

function runSpec(ids) {
  const dir = mkdtempSync(join(tmpdir(), 'buyhacks-spec-'));
  const file = join(dir, 'spec.json');
  writeFileSync(file, JSON.stringify(spec(ids)));
  try {
    const stdout = execFileSync(process.execPath, [script, '--spec', file], { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('exportsOf names built-in constructors the way function-spec does', () => {
  const text = [
    'export const a = query({',
    'export const b = internalMutation({',
    'export const c = httpAction(async () => {',
    'export const NOT_A_FUNCTION = [1, 2];',
    'const hidden = query({',
    'export default action({',
  ].join('\n');
  assert.deepEqual(exportsOf('dir/mod.ts', text), ['dir/mod.js:a', 'dir/mod.js:b', 'dir/mod.js:c', 'dir/mod.js:default']);
});

test('source no longer exports the deleted password-era auth functions', () => {
  for (const id of DELETED) assert.ok(!source.includes(id), `${id} is back in convex/`);
  assert.ok(source.includes('auth.js:isAdmin'));
  assert.ok(!source.some((id) => id.startsWith('curatedCatalog.js:')), 'a data export was counted as a function');
});

test('every function the frontend calls is exported by source', () => {
  const calls = frontendCalls(readFileSync(join(root, 'js/state.js'), 'utf8'));
  assert.ok(calls.length > 0);
  const missing = calls.filter((id) => !source.includes(id));
  assert.deepEqual(missing, [], 'js/state.js calls a function convex/ does not export');
});

test('compare separates stale deployed functions from undeployed ones', () => {
  const deployed = deployedFunctions(spec(['b.js:x', 'a.js:old', 'a.js:keep']));
  assert.deepEqual(deployed, ['a.js:keep', 'a.js:old', 'b.js:x']);
  assert.deepEqual(compare(['a.js:keep', 'a.js:new', 'b.js:x'], deployed), { stale: ['a.js:old'], missing: ['a.js:new'] });
  assert.throws(() => deployedFunctions({ url: 'x' }), /no functions array/);
});

test('the shipped deployment comes from js/client.js, and only one is allowed', () => {
  const name = shippedDeployment(readFileSync(join(root, 'js/client.js'), 'utf8'));
  assert.match(name, /^[a-z]+-[a-z]+-\d+$/);
  assert.throws(() => shippedDeployment('https://a-b-1.convex.cloud https://c-d-2.convex.cloud'), /found 2/);
  assert.throws(() => shippedDeployment('no url here'), /found 0/);
});

test('envDeployment reads CONVEX_DEPLOYMENT and nothing else', () => {
  assert.equal(envDeployment('# x\nCONVEX_URL=https://q.convex.cloud\nCONVEX_DEPLOYMENT=dev:formal-lemur-640 # team: t, project: p\n'), 'formal-lemur-640');
  assert.equal(envDeployment('CONVEX_DEPLOYMENT=prod:other-name-1'), 'other-name-1');
  assert.equal(envDeployment('CONVEX_URL=https://q.convex.cloud\n'), null);
});

test('the CLI fails on a deployment still serving the deleted functions and passes on one that matches', () => {
  const stale = runSpec([...source, ...DELETED]);
  assert.equal(stale.code, 1);
  for (const id of DELETED) assert.match(stale.stdout, new RegExp(id.replace('.', '\\.')));
  assert.match(stale.stdout, /FAIL/);

  const behind = runSpec(source.filter((id) => id !== 'auth.js:isAdmin'));
  assert.equal(behind.code, 1);
  assert.match(behind.stdout, /in source but not deployed \(1\):\n\s+auth\.js:isAdmin/);

  const exact = runSpec(source);
  assert.equal(exact.code, 0);
  assert.match(exact.stdout, /ok: serves exactly what source exports/);
});

test('the guard refuses a push when .env.local selects a deployment the shipped page does not call', () => {
  const dir = mkdtempSync(join(tmpdir(), 'buyhacks-guard-'));
  try {
    for (const sub of ['scripts', 'js']) mkdirSync(join(dir, sub));
    copyFileSync(script, join(dir, 'scripts/check-deployed.mjs'));
    writeFileSync(join(dir, 'js/client.js'), "const CONVEX_URL = 'https://shipped-name-111.convex.cloud';\n");
    const guard = () => {
      try {
        return { code: 0, out: execFileSync(process.execPath, [join(dir, 'scripts/check-deployed.mjs'), '--guard'], { encoding: 'utf8', stdio: 'pipe' }) };
      } catch (err) {
        return { code: err.status, out: err.stderr };
      }
    };

    const absent = guard();
    assert.equal(absent.code, 1);
    assert.match(absent.out, /no \.env\.local/);

    writeFileSync(join(dir, '.env.local'), 'CONVEX_DEPLOYMENT=dev:other-name-222 # team: t\n');
    const split = guard();
    assert.equal(split.code, 1);
    assert.match(split.out, /selects other-name-222, but the shipped page calls shipped-name-111\.[\s\S]*Refusing/);

    writeFileSync(join(dir, '.env.local'), 'CONVEX_DEPLOYMENT=dev:shipped-name-111\n');
    const same = guard();
    assert.equal(same.code, 0);
    assert.match(same.out, /guard ok/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
