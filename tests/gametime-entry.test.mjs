import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';
import { BILLING_PLANS } from '../src/lib/billingPolicy.mjs';
import { FREE_STARTER } from '../src/lib/starterPolicy.mjs';
const base = new URL('../src/components/', import.meta.url);
const Empty = () => null;

test('Gametime is an accessible large labeled action, not an unlabeled plus or a training link', async () => {
  const { default: Action } = await loadComponent(new URL('GametimeAction.jsx', base), { './ui/Icons': Empty });
  let launches = 0;
  const h = reactHarness();
  h.render(Action, { onStart: () => launches++ });
  const button = findElement(h.output, node => node.type === 'button');
  assert.equal(button.props['aria-label'], 'GAMETIME — Record stats');
  button.props.onClick(); assert.equal(launches, 1);
  const html = renderToStaticMarkup(React.createElement(Action, { onStart() {} }));
  assert.match(html, /GAMETIME/); assert.match(html, /Record stats/);
  const css = await readFile(new URL('gametime-action.css', base), 'utf8');
  assert.match(css, /min-height:60px/); assert.match(css, /focus-visible/);
});

async function shellFixture(screen = 'home', billingEnabled = false) {
  const h = reactHarness(), routes = [];
  const app = { screen, setScreen: route => routes.push(route), player: { name: 'Sample Player' }, refreshData: async () => {}, isTeamIQ: false };
  const Gametime = () => null, Logger = () => null, Overview = () => null, Billing = () => null;
  const deps = { react: h.react, '@/context/AppContext': { useApp: () => app },
    '@/lib/useThemePreference': { useThemePreference: () => [false, () => {}] },
    '@/lib/firebase': { signOutUser: async () => {} }, '@/lib/utils': { getGreeting: () => 'Hello' },
    './ui/Icons': Empty, './GametimeAction': Gametime, './shots/ShotLogger': Logger,
    './billing/MembershipOverview': Overview, './billing/BillingScreen': Billing };
  for (const name of ['BottomNav', 'DesktopNav', 'dashboard/HomeDashboard', 'shots/ShotTracking', 'heatmap/HeatMapScreen',
    'journal/JournalScreen', 'train/TrainScreen', 'train/SkillsScreen', 'iq/IQScreen', 'auth/ProfileEditor', 'PlayerSwitcher',
    'gamelog/GameLogScreen', 'family/FamilyDashboard', 'settings/SettingsScreen', 'film/FilmLab', 'profile/DevelopmentProfile',
    'coach/CoachWorkspace', 'team/CoachWorkspace']) deps[`./${name}`] = Empty;
  const { default: Shell } = await loadComponent(new URL('Shell.jsx', base), deps, {
    process: { env: { NEXT_PUBLIC_COURTIQ_BILLING_ENABLED: billingEnabled ? 'true' : 'false' } },
    document: { addEventListener() {}, removeEventListener() {} }, setTimeout, clearTimeout,
  });
  h.render(Shell); h.flush();
  return { h, app, routes, Gametime, Logger, Overview, Billing };
}

test('the real sticky shell action opens the existing logger from every app screen, without navigation or persistence', async () => {
  for (const screen of ['home', 'skills', 'iq', 'family', 'billing']) {
    const f = await shellFixture(screen);
    const header = findElement(f.h.output, node => node.type === 'header');
    const action = findElement(header, node => node.type === f.Gametime);
    assert.ok(action, screen); assert.equal(header.props.style.position, 'sticky');
    action.props.onStart(); f.h.flush();
    const logger = findElement(f.h.output, node => node.type === f.Logger);
    assert.ok(logger, screen); assert.deepEqual(f.routes, []);
    logger.props.onClose(); f.h.flush();
    assert.equal(findElement(f.h.output, node => node.type === f.Logger), null);
    f.h.unmount();
  }
});

test('VIP is discoverable with billing off and remains a non-transactional overview', async () => {
  const f = await shellFixture('billing');
  assert.ok(findElement(f.h.output, node => node.type === f.Overview));
  assert.equal(findElement(f.h.output, node => node.type === f.Billing), null);
  findElement(f.h.output, node => node.type === 'button' && node.props['aria-label'] === 'Profile menu').props.onClick({ stopPropagation() {} });
  f.h.flush();
  const vip = findElement(f.h.output, node => node.type === 'button' && node.props.children === 'VIP & membership');
  assert.ok(vip); vip.props.onClick(); assert.deepEqual(f.routes, ['billing']);
  f.h.unmount();
  const enabled = await shellFixture('billing', true);
  assert.ok(findElement(enabled.h.output, node => node.type === enabled.Billing));
  assert.equal(findElement(enabled.h.output, node => node.type === enabled.Overview), null); enabled.h.unmount();
});

test('membership overview uses configured proposals and clearly separates rollout from account entitlement', async () => {
  const { default: Overview } = await loadComponent(new URL('billing/MembershipOverview.jsx', base), {
    '@/lib/billingPolicy.mjs': { BILLING_PLANS }, '@/lib/starterPolicy.mjs': { FREE_STARTER }, Intl,
  }, { Intl });
  const html = renderToStaticMarkup(React.createElement(Overview));
  for (const text of ['$9', '$79', '$29', '$249', 'No card', 'No automatic charge', 'not your current account access',
    '0 saved games', '0 journal entries', '1 introductory training session', 'not in-app full-game recording']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /<button|<input|<form|Continue to.*checkout|<a /);
});

test('desktop GAMETIME appears before scrolling links and VIP is available independently of activation', async () => {
  const Action = () => null, routes = [];
  const { default: Nav } = await loadComponent(new URL('DesktopNav.jsx', base), {
    '@/context/AppContext': { useApp: () => ({ screen: 'home', setScreen: value => routes.push(value), player: null }) },
    '@/components/ui/Icons': Empty, './GametimeAction': Action,
    '@/components/ui/BrandLogo': Empty,
  }, { process: { env: {} } });
  let launches = 0;
  const tree = Nav({ onStartSession: () => launches++ });
  const children = tree.props.children.flat();
  assert.ok(children.findIndex(node => node?.type === Action) < children.findIndex(node => node?.type === 'nav'));
  findElement(tree, node => node.type === Action).props.onStart(); assert.equal(launches, 1);
  const vip = findElement(tree, node => node.type === 'button' && renderToStaticMarkup(node).includes('VIP &amp; membership'));
  assert.ok(vip); vip.props.onClick(); assert.deepEqual(routes, ['billing']);
});
