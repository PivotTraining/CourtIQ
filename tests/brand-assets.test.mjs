import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { loadComponent } from './helpers/reactHarness.mjs';
import { socialCardSvg } from '../src/lib/socialCard.mjs';
import { buildSessionReport } from '../src/lib/sessionReport.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('wordmarks are font-independent paths, tightly framed and free of external assets', async () => {
  for (const surface of ['light', 'dark', 'mono']) {
    const svg = await read(`public/brand/courtiq-v2/courtiq-logo-${surface}.svg`);
    assert.match(svg, /viewBox="0 0 679 120"/);
    assert.match(svg, /<title[^>]*>CourtIQ<\/title>/);
    assert.equal((svg.match(/scale\(0\.0605469 -0\.0605469\)/g) || []).length, 7);
    assert.doesNotMatch(svg, /<text\b|<image\b|font-family|href=|<script\b|<foreignObject\b/);
    const png = await sharp(new URL(`public/brand/courtiq-v2/courtiq-logo-${surface}.png`, root).pathname).metadata();
    assert.equal(png.width, 2400); assert.ok(png.hasAlpha);
  }
});

test('automatic and explicit logo surfaces render accessible artwork without document reads', async () => {
  const Image = props => React.createElement('img', props);
  const { default: Logo } = await loadComponent(new URL('src/components/ui/BrandLogo.jsx', root), { 'next/image': Image });
  const auto = renderToStaticMarkup(React.createElement(Logo));
  assert.match(auto, /courtiq-brand-auto/);
  assert.match(auto, /courtiq-logo-light.svg/); assert.match(auto, /courtiq-logo-dark.svg/);
  const dark = renderToStaticMarkup(React.createElement(Logo, { surface: 'dark', width: 320 }));
  assert.match(dark, /alt="CourtIQ"/); assert.doesNotMatch(dark, /courtiq-logo-light/);
  const css = await read('src/app/globals.css');
  assert.match(css, /html.dark .courtiq-brand-auto .courtiq-brand-image-dark \{ display: block; \}/);
  assert.match(css, /html.dark .courtiq-brand-auto .courtiq-brand-image-light \{ display: none; \}/);
});

test('PWA icons match manifest dimensions and maskable artwork stays in its safe circle', async () => {
  const manifest = JSON.parse(await read('public/manifest.json'));
  for (const icon of manifest.icons) {
    const metadata = await sharp(new URL(`public${icon.src}`, root).pathname).metadata();
    assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
  }
  assert.notEqual(manifest.icons.find(icon => icon.purpose === 'any' && icon.sizes === '512x512').src, manifest.icons.find(icon => icon.purpose === 'maskable').src);
  const { data, info } = await sharp(new URL('public/brand/courtiq-v2/icon-maskable-512.png', root).pathname).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let orangePixels = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels;
    assert.equal(data[i + 3], 255, 'maskable background must be opaque');
    if (data[i] > 80) {
      orangePixels++;
      assert.ok(Math.hypot(x - 256, y - 256) < 204.8, `safe area at ${x},${y}`);
    }
  }
  assert.ok(orangePixels > 10000);
  const apple = await sharp(new URL('public/brand/courtiq-v2/apple-touch-icon.png', root).pathname).metadata();
  assert.equal(apple.width, 180); assert.equal(apple.height, 180);
});

test('cached assets all exist and worker refresh preserves auth/data exclusions', async () => {
  const worker = await read('public/sw.js');
  const paths = JSON.parse(worker.match(/const STATIC_ASSETS = (\[[^\n]*\]);/)[1]);
  for (const path of paths) assert.ok((await readFile(new URL(`public${path}`, root))).length);
  assert.match(worker, /url.pathname.startsWith\("\/api\/"\) \|\| url.pathname.startsWith\("\/auth\/"\)/);
  assert.match(worker, /k.startsWith\("courtiq-"\) && k !== CACHE_NAME/);
});

test('legacy artwork remains recoverable while all image entry points use v2', async () => {
  for (const file of ['logo.svg', 'courtiq-dark.png', 'courtiq-light.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
    assert.ok((await readFile(new URL(`public/${file}`, root))).length);
  }
  for (const file of ['src/components/App.jsx', 'src/components/auth/LoginScreen.jsx', 'src/components/dashboard/HomeDashboard.jsx', 'src/components/DesktopNav.jsx', 'src/app/page.js', 'src/app/layout.js', 'src/lib/notifications.js', 'public/offline.html']) {
    assert.doesNotMatch(await read(file), /["']\/(?:logo.svg|courtiq-(?:light|dark).png|icon-192.(?:png|svg)|apple-touch-icon.png)["']/);
  }
});

test('social cards embed the same outlined logo without external fetches or altered statistics', async () => {
  const report = buildSessionReport([], { reb: 7, ast: 4 });
  for (const format of ['square', 'story']) {
    const svg = socialCardSvg(report, { format, energy: 'none' });
    assert.match(svg, /translate\(64 56\) scale\(.62\)/);
    assert.doesNotMatch(svg, /href=|<image\b/);
    assert.match(svg, /RECORDED POINTS/);
    const raster = await sharp(Buffer.from(svg)).png().toBuffer();
    const metadata = await sharp(raster).metadata();
    assert.equal(metadata.width, 1080);
    assert.equal(metadata.height, format === 'story' ? 1920 : 1080);
  }
});
