import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const globals = read('./app/globals.css');
assert.ok(globals.includes('--term-bg'), 'globals.css defines terminal background token');
assert.ok(globals.includes('--term-accent'), 'globals.css defines lime terminal accent token');
assert.ok(globals.includes('--term-panel'), 'globals.css defines terminal panel token');
assert.ok(globals.includes('[data-theme="light"]'), 'globals.css defines light terminal theme');
assert.ok(globals.includes('color-scheme: light'), 'light theme advertises light color scheme');
assert.ok(!globals.includes('--apple-blue'), 'Apple system blue token removed');
assert.ok(!globals.includes('fonts.googleapis.com'), 'globals.css avoids runtime Google font import');

const primitives = read('./components/apple-ui.tsx');
for (const exportName of ['AppShell', 'SurfaceCard', 'MetricTile', 'PageHeader', 'TickerBar']) {
  assert.ok(primitives.includes(`export function ${exportName}`), `terminal UI exports ${exportName}`);
}
assert.ok(primitives.includes('LEMBAR/TERM'), 'shared shell uses Direction B terminal brand');
assert.ok(primitives.includes('font-mono'), 'shared shell uses dense mono UI');
assert.ok(primitives.includes('localStorage.setItem("theme"'), 'shared shell persists light/dark theme choice');
assert.ok(primitives.includes('data-theme'), 'shared shell applies theme to document root');
assert.ok(primitives.includes('export function ThemeToggle'), 'shared shell exports reusable theme toggle');
assert.ok(primitives.includes('useState<"dark" | "light">("light")'), 'shared shell defaults toggle state to light');

const layout = read('./app/layout.tsx');
assert.ok(layout.includes('localStorage.getItem("theme")'), 'root layout applies saved theme before paint');
assert.ok(layout.includes('?"dark":"light"'), 'root layout defaults first visit to light theme');
assert.ok(layout.includes('suppressHydrationWarning'), 'root layout suppresses theme hydration mismatch');

const landing = read('./app/page.tsx');
assert.ok(landing.includes('LEMBAR/TERM'), 'landing page uses terminal product hero');
assert.ok(landing.includes('terminal finance workspace'), 'landing page names terminal direction');
assert.ok(landing.includes('ThemeToggle'), 'landing page exposes light/dark theme toggle');

const login = read('./app/login/page.tsx');
assert.ok(login.includes('Access terminal'), 'login page uses terminal auth copy');
assert.ok(login.includes('term-panel'), 'login page uses terminal panel treatment');
assert.ok(login.includes('ThemeToggle'), 'login page exposes light/dark theme toggle');

const register = read('./app/register/page.tsx');
assert.ok(register.includes('Create operator'), 'register page uses terminal auth copy');
assert.ok(register.includes('Account created'), 'register success state preserved');
assert.ok(register.includes('ThemeToggle'), 'register page exposes light/dark theme toggle');

const dashboard = read('./app/dashboard/DashboardClient.tsx');
assert.ok(dashboard.includes('TickerBar'), 'dashboard uses terminal ticker');
assert.ok(dashboard.includes('txn.tail'), 'dashboard includes terminal transaction tail panel');
assert.ok(dashboard.includes('signals.auto'), 'dashboard includes terminal signals panel');

const statements = read('./app/dashboard/statements/StatementsClient.tsx');
assert.ok(statements.includes('volumes'), 'statements page has Direction B volume rail');
assert.ok(statements.includes('transactions.'), 'statements page uses terminal transaction table title');
assert.ok(statements.includes('grep description'), 'statements page uses terminal grep search language');

const analytics = read('./app/dashboard/analytics/AnalyticsClient.tsx');
assert.ok(analytics.includes('trend.6mo'), 'analytics page has terminal trend panel');
assert.ok(analytics.includes('insights.ai'), 'analytics keeps insights in Direction B panel');

const dailyChart = read('./components/DailyBarChart.tsx');
assert.ok(dailyChart.includes('itemStyle'), 'daily chart tooltip overrides item text color');
assert.ok(dailyChart.includes('labelStyle'), 'daily chart tooltip overrides label text color');

const pieChart = read('./components/SpendingPieChart.tsx');
assert.ok(pieChart.includes('itemStyle'), 'pie chart tooltip overrides item text color');
assert.ok(pieChart.includes('labelStyle'), 'pie chart tooltip overrides label text color');

const flowMap = read('./app/dashboard/map/FlowMapClient.tsx');
const flowFilters = read('./components/FlowFilters.tsx');
assert.ok(flowFilters.includes('filter.params'), 'flow map has terminal filter params panel');
assert.ok(flowMap.includes('sankey.cashflow'), 'flow map renders Sankey in terminal panel');

console.log('Direction B terminal redesign smoke test passed');
