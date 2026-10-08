import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
const { transform } = require('next/dist/build/swc');
async function compile(path, dependencies = {}, globals = {}) {
  const { code } = await transform(await readFile(new URL(path, import.meta.url), 'utf8'), {
    filename: path, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  });
  const compiled = { exports: {} };
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require: name => dependencies[name] || require(name), ...globals });
  return compiled.exports;
}

function lifecycleHooks() {
  const states = [], effects = [], previous = [];
  let cursor = 0, effectCursor = 0;
  return {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
      },
      useEffect(effect, dependencies) {
        const index = effectCursor++;
        if (!previous[index] || dependencies.some((value, i) => !Object.is(value, previous[index][i]))) {
          effects.push(effect); previous[index] = dependencies;
        }
      },
    },
    render(hook) { cursor = 0; effectCursor = 0; return hook(); },
    flush() { for (const effect of effects.splice(0)) effect(); },
  };
}

async function themeFixture(saved = 'light', blocked = false) {
  const hooks = lifecycleHooks(), writes = [], classes = [], meta = { content: '' };
  const globals = {
    localStorage: {
      getItem() { if (blocked) throw new Error('Storage blocked'); return saved; },
      setItem(key, value) { if (blocked) throw new Error('Storage blocked'); saved = value; writes.push([key, value]); },
    },
    document: { documentElement: { classList: { toggle: (...args) => classes.push(args) } }, querySelector: () => meta },
  };
  const { useThemePreference } = await compile('../src/lib/useThemePreference.js', { react: hooks.react }, globals);
  return { hooks, hook: useThemePreference, writes, classes, meta };
}

test('theme toggle SSR markup stays identical with no browser and a remembered light preference', async () => {
  const render = async globals => {
    const hook = await compile('../src/lib/useThemePreference.js', {}, globals);
    const { default: Toggle } = await compile('../src/components/billing/ThemeToggle.jsx', { '@/lib/useThemePreference': hook }, globals);
    return renderToString(React.createElement(Toggle));
  };
  const server = await render({});
  const browser = await render({ window: {}, localStorage: { getItem: () => 'light', setItem() { throw new Error('Initial render must not write'); } } });
  assert.equal(server, browser);
  assert.match(server, /disabled=""/);
  assert.match(server, /Switch to light mode/);
});

test('hydration restores light without writing the initial dark default; subsequent toggle persists', async () => {
  const f = await themeFixture();
  let [dark, , ready] = f.hooks.render(f.hook);
  assert.equal(dark, true); assert.equal(ready, false); assert.equal(f.writes.length, 0);
  f.hooks.flush(); assert.equal(f.writes.length, 0);
  let setDark;
  [dark, setDark, ready] = f.hooks.render(f.hook);
  assert.equal(dark, false); assert.equal(ready, true);
  f.hooks.flush(); assert.deepEqual(f.writes, [['courtiq-theme', 'light']]);
  assert.deepEqual(f.classes, [['dark', false]]); assert.equal(f.meta.content, '#FF6B35');
  setDark(value => !value); f.hooks.render(f.hook); f.hooks.flush();
  assert.deepEqual(f.writes.at(-1), ['courtiq-theme', 'dark']); assert.equal(f.meta.content, '#0F1117');
});

test('saved dark and missing preferences safely default to dark after hydration', async () => {
  for (const saved of ['dark', null, 'invalid']) {
    const f = await themeFixture(saved);
    f.hooks.render(f.hook); f.hooks.flush();
    const [dark, , ready] = f.hooks.render(f.hook); f.hooks.flush();
    assert.equal(dark, true); assert.equal(ready, true);
    assert.deepEqual(f.classes, [['dark', true]]);
  }
});

test('blocked device storage does not break hydration or in-memory theme controls', async () => {
  const f = await themeFixture('light', true);
  f.hooks.render(f.hook); f.hooks.flush();
  const [dark, setDark, ready] = f.hooks.render(f.hook); f.hooks.flush();
  assert.equal(dark, true); assert.equal(ready, true);
  setDark(false); f.hooks.render(f.hook); f.hooks.flush();
  assert.deepEqual(f.classes.at(-1), ['dark', false]); assert.equal(f.writes.length, 0);
});
