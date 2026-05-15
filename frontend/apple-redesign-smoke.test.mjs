import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const globals = read('./app/globals.css');
assert.ok(globals.includes('--apple-blue'), 'globals.css defines Apple system blue token');
assert.ok(globals.includes('--surface-glass'), 'globals.css defines translucent surface token');
assert.ok(!globals.includes('fonts.googleapis.com'), 'globals.css removes Google font import');
assert.ok(!globals.includes('--accent-gradient: linear-gradient(135deg, #3B82F6, #8B5CF6)'), 'old purple gradient token removed');

const primitives = read('./components/apple-ui.tsx');
for (const exportName of ['AppShell', 'SurfaceCard', 'MetricTile', 'HeroFinanceCard', 'PageHeader']) {
  assert.ok(primitives.includes(`export function ${exportName}`), `apple-ui exports ${exportName}`);
}

const landing = read('./app/page.tsx');
assert.ok(landing.includes('Understand your BCA spending'), 'landing page has Apple redesign product hero');
assert.ok(landing.includes('HeroFinanceCard'), 'landing page uses HeroFinanceCard');

const login = read('./app/login/page.tsx');
assert.ok(login.includes('AuthVisual'), 'login page uses Apple auth visual');
assert.ok(login.includes('backdrop-blur'), 'login page uses translucent Apple surface treatment');

const register = read('./app/register/page.tsx');
assert.ok(register.includes('AuthVisual'), 'register page uses Apple auth visual');
assert.ok(register.includes('Account created'), 'register success state preserved');

const dashboard = read('./app/dashboard/DashboardClient.tsx');
assert.ok(dashboard.includes('AppShell'), 'dashboard uses shared AppShell');
assert.ok(dashboard.includes('HeroFinanceCard'), 'dashboard uses hero finance card');
assert.ok(dashboard.includes('MetricTile'), 'dashboard uses metric tiles');

const statements = read('./app/dashboard/statements/StatementsClient.tsx');
assert.ok(statements.includes('AppShell'), 'statements uses shared AppShell');
assert.ok(statements.includes('sticky top-4'), 'statements controls are sticky/prominent');

const analytics = read('./app/dashboard/analytics/AnalyticsClient.tsx');
assert.ok(analytics.includes('Lightbulb'), 'analytics keeps insights panel');
assert.ok(analytics.includes('MetricTile'), 'analytics uses metric tiles');

const flowMap = read('./app/dashboard/map/FlowMapClient.tsx');
assert.ok(flowMap.includes('AppShell'), 'flow map uses shared AppShell');
assert.ok(flowMap.includes('SurfaceCard'), 'flow map renders Sankey in Apple surface');

console.log('Apple redesign smoke test passed');
