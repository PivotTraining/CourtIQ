import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';

const require = createRequire(import.meta.url);
const { transform } = require('next/dist/build/swc');

export async function loadComponent(url, dependencies = {}, globals = {}) {
  const { code } = await transform(await readFile(url, 'utf8'), {
    filename: url.pathname, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  });
  const compiled = { exports: {} };
  vm.runInNewContext(code, {
    module: compiled, exports: compiled.exports,
    require: name => name.endsWith('.css') ? {} : dependencies[name] || require(name),
    ...globals,
  });
  return compiled.exports;
}

// Runs the actual component/hook code with deterministic effect lifecycles.
// This is not a browser or a substitute for rendered/hydration verification.
export function reactHarness() {
  const slots = [], pending = new Map();
  let cursor = 0, component, props, output, dirty = false, disposed = false;
  const changes = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    ...React,
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (disposed) changes.push({ afterUnmount: true, index, value });
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !equal(previous.dependencies, dependencies)) {
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        pending.set(index, effect);
      }
    },
    useMemo(factory, dependencies) {
      const index = cursor++;
      if (!slots[index] || !equal(slots[index].dependencies, dependencies)) slots[index] = { dependencies, value: factory() };
      return slots[index].value;
    },
    useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
  };
  function render(Component = component, nextProps = props) {
    component = Component; props = nextProps; cursor = 0; dirty = false;
    output = component(props); return output;
  }
  function flush() {
    for (let count = 0; pending.size || dirty; count++) {
      if (count > 30) throw new Error('Component did not settle');
      if (dirty) render();
      for (const [index, effect] of [...pending]) {
        pending.delete(index); slots[index].cleanup?.(); slots[index].cleanup = effect();
      }
    }
    return output;
  }
  async function settle() { for (let count = 0; count < 8; count++) { await Promise.resolve(); flush(); } return output; }
  function unmount() { for (const slot of slots) slot?.cleanup?.(); pending.clear(); disposed = true; }
  return { react, render, flush, settle, unmount, changes, get output() { return output; } };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function findElement(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}
