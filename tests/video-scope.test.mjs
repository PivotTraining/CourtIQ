import test from 'node:test';
import assert from 'node:assert/strict';
import { reactHarness, loadComponent, deferred, findElement } from './helpers/reactHarness.mjs';

async function videoFixture(metadata = Promise.resolve()) {
  const h = reactHarness(), write = deferred(), requests = [];
  const store = {
    get: async () => null,
    put: (...args) => { requests.push(args); return write.promise; },
    remove: async () => true,
  };
  let objectUrls = 0;
  const globals = {
    URL: { createObjectURL: () => `blob:fixture-${++objectUrls}`, revokeObjectURL() {} },
    setTimeout: () => 1, clearTimeout() {}, window: { confirm: () => false },
    document: { createElement: () => ({ set src(value) { this.fixtureSource = value; metadata.then(() => this.onloadedmetadata?.()); }, removeAttribute() {}, load() {} }) },
  };
  const { default: Video, DeviceSessionVideo: View } = await loadComponent(new URL('../src/components/shots/SessionVideo.jsx', import.meta.url), {
    react: h.react,
    '@/lib/deviceVideo.mjs': { createDeviceVideoStore: () => store, validateClip() {}, clipKey: (owner, session) => JSON.stringify([owner, session]) },
    '@/lib/browserDownload.mjs': { downloadBlob() {} },
  }, globals);
  return { h, Video, View, write, requests };
}

test('session-video UI has a distinct React key for every owner and session', async () => {
  const f = await videoFixture();
  const a = f.h.render(f.Video, { accountId: 'alice', sessionId: 'one' });
  const b = f.h.render(f.Video, { accountId: 'alice', sessionId: 'two' });
  const c = f.h.render(f.Video, { accountId: 'bob', sessionId: 'two' });
  assert.ok(a.key); assert.notEqual(a.key, b.key); assert.notEqual(b.key, c.key);
});

test('a video save finishing after its session unmounts cannot update another view', async () => {
  const f = await videoFixture();
  const { h } = f;
  h.render(f.View, { accountId: 'alice', sessionId: 'one' });
  await h.settle();
  const consent = findElement(h.output, element => element.type === 'input' && element.props.type === 'checkbox');
  consent.props.onChange({ target: { checked: true } }); h.flush();
  const input = findElement(h.output, element => element.type === 'input' && element.props.type === 'file');
  const blob = new Blob(['synthetic'], { type: 'video/mp4' });
  const saving = input.props.onChange({ target: { files: [blob], value: 'fixture' } });
  await h.settle(); assert.equal(f.requests.length, 1);
  h.unmount();
  f.write.resolve({ accountId: 'alice', sessionId: 'one', blob });
  await saving;
  assert.deepEqual(h.changes, []);
  assert.equal(f.requests[0][0], 'alice'); assert.equal(f.requests[0][1], 'one');
});

test('leaving during playback validation does not start a late video write', async () => {
  const metadata = deferred(), f = await videoFixture(metadata.promise), { h } = f;
  h.render(f.View, { accountId: 'alice', sessionId: 'one' }); await h.settle();
  findElement(h.output, element => element.type === 'input' && element.props.type === 'checkbox').props.onChange({ target: { checked: true } }); h.flush();
  const input = findElement(h.output, element => element.type === 'input' && element.props.type === 'file');
  const saving = input.props.onChange({ target: { files: [new Blob(['fixture'], { type: 'video/mp4' })], value: '' } });
  h.unmount(); metadata.resolve(); await saving;
  assert.deepEqual(f.requests, []); assert.deepEqual(h.changes, []);
});
