import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { ESLint } from 'eslint';
import { execFileSync } from 'node:child_process';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';
import { pathForScreen, screenFromPath } from '../src/lib/routes.js';

test('security containment preserves TensorFlow 4.22 operations and MoveNet exports', async () => {
  const require = createRequire(import.meta.url);
  // Exercise the published browser bundle used by this web-only product.
  // The separate Node entry has an undeclared `long` dependency upstream.
  const tf = require('@tensorflow/tfjs/dist/tf.js');
  const pose = require('@tensorflow-models/pose-detection');
  assert.equal(tf.version.tfjs, '4.22.0');
  await tf.setBackend('cpu');
  await tf.ready();
  const result = tf.tidy(() => tf.tensor1d([1, 2, 3]).mul(2));
  assert.deepEqual(Array.from(await result.data()), [2, 4, 6]);
  result.dispose();
  assert.equal(pose.SupportedModels.MoveNet, 'MoveNet');
  assert.equal(typeof pose.createDetector, 'function');
  const cli = join(dirname(require.resolve('@tensorflow/tfjs')), 'tools/custom_module/cli.js');
  assert.match(execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8', timeout: 10000 }), /--config/);
});

test('lockfile excludes the vulnerable sprintf dependency and uses patched source maps', async () => {
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url)));
  assert.equal(lock.packages['node_modules/source-map-js'].version, '1.2.2');
  assert.ok(!Object.keys(lock.packages).some(path => path.endsWith('/sprintf-js')));
  const require = createRequire(import.meta.url);
  const tfRequire = createRequire(require.resolve('@tensorflow/tfjs'));
  assert.equal(tfRequire('argparse/package.json').version, '2.0.1');
});

test('reviewed lint-only replacement retains all 21 Next rules and their severity', async () => {
  const eslint = new ESLint();
  const config = await eslint.calculateConfigForFile('src/components/Shell.jsx');
  const errors = ['inline-script-id','no-assign-module-variable','no-document-import-in-page','no-duplicate-head','no-head-import-in-document','no-script-component-in-head','no-html-link-for-pages','no-sync-scripts'];
  const warnings = ['google-font-display','google-font-preconnect','next-script-for-ga','no-async-client-component','no-before-interactive-script-outside-document','no-css-tags','no-head-element','no-img-element','no-page-custom-font','no-styled-jsx-in-document','no-title-in-document-head','no-typos','no-unwanted-polyfillio'];
  const actual = Object.entries(config.rules).filter(([name]) => name.startsWith('@next/next/'));
  assert.equal(actual.length, 21);
  for (const [names, severity] of [[errors, 2], [warnings, 1]])
    for (const name of names) assert.equal(config.rules[`@next/next/${name}`][0], severity, name);
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.dependencies.next, '15.5.27');
  assert.equal(pkg.devDependencies['eslint-config-next'], '15.5.27');
});

test('actual lint configuration still detects async client components and synchronous scripts', async () => {
  const [result] = await new ESLint().lintText("'use client'; export default async function Broken() { return <script src='/bad.js' />; }", { filePath: 'src/components/ReleaseLintFixture.jsx' });
  assert.ok(result.messages.some(message => message.ruleId === '@next/next/no-async-client-component'));
  assert.ok(result.messages.some(message => message.ruleId === '@next/next/no-sync-scripts' && message.severity === 2));
  assert.ok(!result.messages.some(message => message.fatal));
});

test('compatibility wrapper preserves ancestor-based duplicate-Head checks under ESLint 9', async () => {
  const [result] = await new ESLint().lintText("import Document, { Head } from 'next/document'; export default class Broken extends Document { render() { return <html><Head /><Head /></html>; } }", { filePath: 'src/pages/_document.jsx' });
  assert.ok(result.messages.some(message => message.ruleId === '@next/next/no-duplicate-head' && message.severity === 2));
  assert.ok(!result.messages.some(message => message.fatal));
});

test('reviewed directory matcher retains explicit and globbed Next root-directory discovery', () => {
  const require = createRequire(import.meta.url);
  const { getRootDirs } = require(join(dirname(require.resolve('@next/eslint-plugin-next')), 'utils/get-root-dirs.js'));
  const context = { getCwd: () => process.cwd(), settings: {} };
  assert.deepEqual(getRootDirs(context), [process.cwd()]);
  const exact = getRootDirs({ ...context, settings: { next: { rootDir: process.cwd() } } });
  assert.ok(exact.some(path => path.replace(/\/$/, '') === process.cwd()));
  const matched = getRootDirs({ ...context, settings: { next: { rootDir: `${process.cwd()}/src/*` } } });
  assert.ok(matched.some(path => path.replace(/\/$/, '').endsWith('/src/components')));
});

test('combined release retains current production sections and new membership routes', async () => {
  const sections = { home: 'dashboard', train: 'training', skills: 'skills', shots: 'sessions', heatmap: 'heatmap', journal: 'journal', gamelog: 'game-log', iq: 'iq', coach: 'coach', billing: 'billing', family: 'family', settings: 'settings', film: 'film', developmentProfile: 'development-profile' };
  const App = () => null;
  const page = await loadComponent(new URL('../src/app/[section]/page.js', import.meta.url), {
    'next/dynamic': () => App, 'next/link': () => null, 'next/navigation': { notFound: () => { throw new Error('not found'); } },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture' } } });
  for (const [screen, section] of Object.entries(sections)) {
    assert.equal(pathForScreen(screen), `/${section}`);
    assert.equal(screenFromPath(`/${section}`), screen);
    assert.equal((await page.default({ params: Promise.resolve({ section }) })).type, App);
  }
  await assert.rejects(page.default({ params: Promise.resolve({ section: 'not-an-app-route' }) }), /not found/);
});

test('current coach screen survives inactive roster flags; approved roster mode uses the new workspace', async () => {
  const source = await readFile(new URL('../src/components/Shell.jsx', import.meta.url), 'utf8');
  for (const enabled of [false, true]) {
    const h = reactHarness();
    const dependencies = {
      react: h.react,
      '@/context/AppContext': { useApp: () => ({ screen: 'coach', setScreen: () => {}, player: { name: 'Fixture' }, refreshData: async () => {}, isTeamIQ: false }) },
      '@/lib/utils': { getGreeting: () => 'Hello' }, '@/lib/firebase': { signOutUser: async () => {} },
      '@/lib/useThemePreference': { useThemePreference: () => [true, () => {}] },
    };
    for (const match of source.matchAll(/import \w+ from ['"]([^'"]+)['"]/g)) dependencies[match[1]] ??= () => null;
    const { default: Shell } = await loadComponent(new URL('../src/components/Shell.jsx', import.meta.url), dependencies, {
      process: { env: { NEXT_PUBLIC_COACH_GAMES_ENABLED: String(enabled), NEXT_PUBLIC_TRACKER_RECOVERY_ENABLED: 'true' } },
    });
    const expected = dependencies[enabled ? './team/CoachWorkspace' : './coach/CoachWorkspace'];
    assert.ok(findElement(h.render(Shell), element => element.type === expected));
  }
});
