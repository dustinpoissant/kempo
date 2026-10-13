import path from 'path';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq, inArray } from 'drizzle-orm';

/*
  The admin dashboard: what a widget definition may be, how Kempo's own widgets are defined, how the
  browser's remembered layout is reconciled with what the server offers, and (against a real database)
  how extension widgets are registered, listed, filtered by permission and removed.

  The layout and definition checks need nothing. The registration checks need a reachable Postgres with
  kempo's schema applied and skip themselves, with a message, when there is none.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const { normalizeWidget } = await load('server/utils/dashboard/helpers.js');
const coreWidgets = (await load('server/utils/dashboard/coreWidgets.js')).default;
const { resolveLayout, serializeLayout, reorder } = await load('src/admin/components/dashboardLayout.js');

const db = (await load('server/db/index.js')).default;
const { dashboardWidget, extension, user, userGroup, group, groupPermission, permission } = await load('server/db/schema.js');
const sdk = await load('server/sdk.js');
const addPermissionToGroup = (await load('server/utils/permissions/addPermissionToGroup.js')).default;
const { registerDashboardWidget, unregisterDashboardWidget, listDashboardWidgets, disableExtension, enableExtension, uninstallExtension, createUser, createGroup, createPermission, addUserToGroup } = sdk;

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const widget = (key, overrides = {}) => ({
  id: `test:${key}`,
  owner: 'test',
  key,
  title: key,
  element: 'test-widget',
  module: '/test/Widget.js',
  defaultWidth: 2,
  defaultHeight: 1,
  minWidth: 1,
  maxWidth: 4,
  minHeight: 1,
  maxHeight: 3,
  permission: null,
  priority: 100,
  defaultVisible: true,
  ...overrides
});

const ids = layout => layout.map(({ widget }) => widget.id);

const OWNER = 'dash-sdk-test';
const OWNER_DISABLED = 'dash-sdk-test-disabled';
const PERMISSION = 'dash-sdk-test:thing:see';
const GROUP = 'dash-sdk-test:Team';
const EMAILS = ['member', 'outsider'].map(name => `dash-sdk-${name}@test.local`);
const state = { ids: {} };

const purge = async () => {
  await db.delete(dashboardWidget).where(inArray(dashboardWidget.owner, [OWNER, OWNER_DISABLED])).catch(() => {});
  await db.delete(extension).where(eq(extension.name, OWNER_DISABLED)).catch(() => {});
  for(const email of EMAILS){
    const [row] = await db.select().from(user).where(eq(user.email, email));
    if(!row) continue;
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
  await db.delete(groupPermission).where(eq(groupPermission.groupName, GROUP)).catch(() => {});
  await db.delete(group).where(eq(group.name, GROUP)).catch(() => {});
  await db.delete(permission).where(eq(permission.name, PERMISSION)).catch(() => {});
};

const register = async (key, overrides = {}) => {
  const [error, saved] = await registerDashboardWidget({ owner: OWNER, key, title: key, element: 'dash-sdk-widget', module: '/dash-sdk/Widget.js', ...overrides });
  expect(error === null, `registerDashboardWidget failed: ${JSON.stringify(error)}`);
  return saved;
};

const rejects = async (overrides, why) => {
  const [error, result] = await registerDashboardWidget({ owner: OWNER, key: 'bad', title: 'Bad', element: 'dash-sdk-widget', module: '/dash-sdk/Widget.js', ...overrides });
  expect(result === null && error?.code === 400, `${why}: expected a 400, got ${JSON.stringify([error, result])}`);
};

const idsFor = async options => {
  const [error, result] = await listDashboardWidgets(options);
  expect(error === null, `listDashboardWidgets failed: ${JSON.stringify(error)}`);
  return result.widgets.map(w => w.id);
};

const pure = {
  'Kempo\'s own widgets are valid, unique and point at modules that exist': async ({ pass }) => {
    const seen = new Set();
    for(const core of coreWidgets){
      const [error, clean] = normalizeWidget(core);
      expect(error === null, `${core.id} is not a valid definition: ${error?.msg}`);
      expect(clean.id === core.id, `${core.id} has an id that is not owner:key`);
      expect(!seen.has(core.id), `${core.id} is defined twice`);
      seen.add(core.id);
      expect(existsSync(path.join(root, 'src', core.module.replace(/^\//, ''))), `${core.id} points at ${core.module}, which does not exist under src/`);
    }
    pass(`${coreWidgets.length} widgets`);
  },

  'a definition is refused when the dashboard could not render it': async ({ pass }) => {
    const base = { owner: 'x', key: 'k', title: 'T', element: 'x-widget', module: '/x/W.js' };
    const refused = {
      'no title': { title: '' },
      'an element that is not a custom element name': { element: 'widget' },
      'an element with markup in it': { element: 'x-widget"><script>' },
      'a module on another origin': { module: 'https://evil.example/w.js' },
      'a protocol-relative module': { module: '//evil.example/w.js' },
      'a width over four blocks': { maxWidth: 5 },
      'a height over three blocks': { maxHeight: 4 },
      'a width of zero': { minWidth: 0 },
      'bounds that contradict each other': { minWidth: 3, maxWidth: 2 },
      'a default outside the bounds': { minWidth: 2, defaultWidth: 1 },
      'a fractional size': { defaultHeight: 1.5 },
      'a key with a colon, which would make ids ambiguous': { key: 'a:b' },
      'more than three actions': { actions: [1, 2, 3, 4].map(n => ({ label: `A${n}`, href: '/a' })) },
      'an action without a label': { actions: [{ href: '/a' }] },
      'an action that leaves the site': { actions: [{ label: 'Go', href: 'https://evil.example/' }] },
      'a protocol-relative action': { actions: [{ label: 'Go', href: '//evil.example/' }] },
      'an action that is a script': { actions: [{ label: 'Go', href: 'javascript:alert(1)' }] },
    };
    for(const [why, overrides] of Object.entries(refused)){
      const [error, result] = normalizeWidget({ ...base, ...overrides });
      expect(result === null && error?.code === 400, `${why} should be refused`);
    }
    const [error, clean] = normalizeWidget(base);
    const [, withActions] = normalizeWidget({ ...base, actions: [{ label: ' New ', href: '/a/new', icon: 'add', permission: 'x:y', extra: 'dropped' }] });
    expect(JSON.stringify(withActions.actions) === JSON.stringify([{ label: 'New', href: '/a/new', icon: 'add', permission: 'x:y' }]), `actions are reduced to the known fields, got ${JSON.stringify(withActions.actions)}`);
    expect(error === null && clean.defaultWidth === 2 && clean.defaultHeight === 1 && clean.minWidth === 1 && clean.maxHeight === 3 && clean.defaultVisible === true, 'the defaults fill in');
    pass();
  },

  'a layout with nothing remembered follows the server\'s order and defaults': async ({ pass }) => {
    const layout = resolveLayout([widget('a'), widget('b', { defaultVisible: false, defaultWidth: 4, defaultHeight: 3 })], null);
    expect(ids(layout).join() === 'test:a,test:b', 'server order');
    expect(layout[0].visible && !layout[1].visible, 'defaultVisible decides what is shown');
    expect(layout[1].width === 4 && layout[1].height === 3, 'default sizes');
    pass();
  },

  'a remembered order, hidden set and size are applied, and clamped to the current bounds': async ({ pass }) => {
    const widgets = [widget('a'), widget('b', { maxWidth: 2 }), widget('c')];
    const layout = resolveLayout(widgets, {
      order: ['test:c', 'test:a', 'test:b'],
      hidden: ['test:a'],
      sizes: { 'test:b': { width: 4, height: 2 }, 'test:c': { width: 'wide', height: 99 } }
    });
    expect(ids(layout).join() === 'test:c,test:a,test:b', 'remembered order');
    expect(layout.find(e => e.widget.key === 'a').visible === false, 'hidden stays hidden');
    const b = layout.find(e => e.widget.key === 'b');
    expect(b.width === 2 && b.height === 2, `a width the widget no longer allows is clamped, got ${b.width}x${b.height}`);
    const c = layout.find(e => e.widget.key === 'c');
    expect(c.width === 2 && c.height === 3, `a garbage size falls back to the default or clamps, got ${c.width}x${c.height}`);
    pass();
  },

  'widgets that appeared since the layout was saved are appended; ones that went are dropped': async ({ pass }) => {
    const layout = resolveLayout([widget('a'), widget('new'), widget('shown-later', { defaultVisible: false })], { order: ['test:gone', 'test:a', 'test:a'], hidden: ['test:gone'] });
    expect(ids(layout).join() === 'test:a,test:new,test:shown-later', `got ${ids(layout).join()}`);
    expect(layout[1].visible && !layout[2].visible, 'a new widget follows its defaultVisible');
    pass();
  },

  'corrupt remembered data is ignored, not fatal': async ({ pass }) => {
    for(const stored of ['nonsense', 42, [], { order: 'a', hidden: 5, sizes: 'big' }]){
      const layout = resolveLayout([widget('a')], stored);
      expect(ids(layout).join() === 'test:a' && layout[0].visible, `stored ${JSON.stringify(stored)} should fall back to defaults`);
    }
    pass();
  },

  'an unavailable widget keeps its place, hidden state and size through a save, and returns where it was': async ({ pass }) => {
    const stored = { order: ['test:a', 'test:b', 'test:c'], hidden: ['test:b'], sizes: { 'test:b': { width: 3, height: 2 } } };
    const offered = [widget('a'), widget('c')];
    const reordered = reorder(resolveLayout(offered, stored), ['test:c', 'test:a']);
    const saved = serializeLayout(reordered, { stored, unavailable: ['test:b'] });
    expect(saved.order.join() === 'test:c,test:a,test:b', `it stays right after what preceded it, got ${saved.order.join()}`);
    expect(saved.hidden.join() === 'test:b' && JSON.stringify(saved.sizes['test:b']) === '{"width":3,"height":2}', 'hidden state and size are kept');
    const back = resolveLayout([widget('a'), widget('b'), widget('c')], saved);
    expect(ids(back).join() === 'test:c,test:a,test:b', 'the order is what the user left');
    const b = back.find(e => e.widget.key === 'b');
    expect(!b.visible && b.width === 3 && b.height === 2, 'and it is still hidden at its size');
    pass();
  },

  'an unavailable widget that was first is kept first, and two in a row stay in order': async ({ pass }) => {
    const stored = { order: ['test:x', 'test:y', 'test:a'], hidden: [], sizes: {} };
    const saved = serializeLayout(resolveLayout([widget('a')], stored), { stored, unavailable: ['test:x', 'test:y'] });
    expect(saved.order.join() === 'test:x,test:y,test:a', `got ${saved.order.join()}`);
    pass();
  },

  'ids that are neither offered nor unavailable are dropped, which is what an uninstall looks like': async ({ pass }) => {
    const stored = { order: ['test:a', 'test:gone', 'test:b'], hidden: ['test:gone'], sizes: { 'test:gone': { width: 4, height: 3 } } };
    const saved = serializeLayout(resolveLayout([widget('a'), widget('b')], stored), { stored, unavailable: [] });
    expect(saved.order.join() === 'test:a,test:b' && saved.hidden.length === 0 && !('test:gone' in saved.sizes), `got ${JSON.stringify(saved)}`);
    pass();
  },

  'only sizes that differ from the default are stored': async ({ pass }) => {
    const layout = resolveLayout([widget('a'), widget('b')], { sizes: { 'test:b': { width: 3, height: 1 } } });
    const stored = serializeLayout(layout);
    expect(JSON.stringify(Object.keys(stored.sizes)) === '["test:b"]', `got ${JSON.stringify(stored.sizes)}`);
    expect(stored.order.join() === 'test:a,test:b' && stored.hidden.length === 0, 'order and hidden');
    expect(ids(resolveLayout([widget('a'), widget('b')], JSON.parse(JSON.stringify(stored)))).join() === 'test:a,test:b', 'it round-trips');
    pass();
  },

  'reordering follows the listed ids and leaves unlisted widgets after them, in order': async ({ pass }) => {
    const layout = resolveLayout([widget('a'), widget('b'), widget('c'), widget('d')], null);
    expect(ids(reorder(layout, ['test:c', 'test:a', 'test:b', 'test:d'])).join() === 'test:c,test:a,test:b,test:d', 'a full order');
    expect(ids(reorder(layout, ['test:d', 'test:b'])).join() === 'test:d,test:b,test:a,test:c', 'a partial order');
    expect(ids(layout).join() === 'test:a,test:b,test:c,test:d', 'the original is not changed');
    pass();
  },
};

const database = {
  'fixtures: a permission, a group that holds it, a member and an outsider': async ({ pass }) => {
    await purge();

    /*
      Permission checks need the system groups, which a fresh database does not have until init-db runs.
      Other suites seed them, but this one cannot rely on running after them.
    */
    try {
      execFileSync(process.execPath, [path.join(root, 'scripts', 'init-db.js')], { cwd: root, stdio: 'ignore' });
    } catch(e) {
      throw new Error(`could not seed system groups and permissions: ${e.message}`);
    }

    await createPermission({ resource: 'thing', action: 'see', description: 'test', owner: OWNER });
    await createGroup({ name: GROUP, description: 'test', owner: OWNER });
    await addPermissionToGroup(GROUP, PERMISSION);
    for(const name of ['member', 'outsider']){
      const [error, created] = await createUser({ name, email: `dash-sdk-${name}@test.local`, password: 'DashSdk123!', emailVerified: true });
      expect(!error, `could not create ${name}: ${error?.msg}`);
      state.ids[name] = created.user.id;
    }
    await addUserToGroup(state.ids.member, GROUP);
    pass();
  },

  'the SDK exports the dashboard functions': async ({ pass }) => {
    for(const name of ['listDashboardWidgets', 'registerDashboardWidget', 'unregisterDashboardWidget']){
      expect(typeof sdk[name] === 'function', `${name} is not exported from server/sdk.js`);
    }
    pass();
  },

  'a registered widget is listed beside Kempo\'s own, with defaults filled in': async ({ pass }) => {
    await register('first');
    const [, { widgets }] = await listDashboardWidgets();
    const mine = widgets.find(w => w.id === `${OWNER}:first`);
    expect(mine && mine.defaultWidth === 2 && mine.maxHeight === 3 && mine.defaultVisible === true, 'registered with defaults');
    expect(!('createdAt' in mine) && !('updatedAt' in mine), 'timestamps are not part of the public shape');
    expect(coreWidgets.every(core => widgets.some(w => w.id === core.id)), 'Kempo\'s own widgets are there too');
    pass();
  },

  'registering again updates the widget in place': async ({ pass }) => {
    await register('first', { title: 'Renamed', defaultWidth: 3 });
    const [, { widgets }] = await listDashboardWidgets();
    const matching = widgets.filter(w => w.id === `${OWNER}:first`);
    expect(matching.length === 1 && matching[0].title === 'Renamed' && matching[0].defaultWidth === 3, 'one row, updated');
    pass();
  },

  'bad definitions and the reserved owner are refused before anything is stored': async ({ pass }) => {
    await rejects({ owner: 'kempo' }, 'the core owner is reserved');
    await rejects({ element: 'nodash' }, 'an element that is not a custom element name');
    await rejects({ module: 'https://evil.example/w.js' }, 'a module on another origin');
    await rejects({ maxWidth: 9 }, 'a width the grid cannot hold');
    expect(!(await idsFor()).includes(`${OWNER}:bad`) && !(await idsFor()).includes('kempo:bad'), 'nothing was stored');
    pass();
  },

  'a widget with a permission is listed only for people who hold it': async ({ pass }) => {
    await register('guarded', { permission: PERMISSION });
    const id = `${OWNER}:guarded`;
    expect((await idsFor({ userId: state.ids.member })).includes(id), 'a member of the group sees it');
    expect(!(await idsFor({ userId: state.ids.outsider })).includes(id), 'someone outside it does not');
    const [, forOutsider] = await listDashboardWidgets({ userId: state.ids.outsider });
    expect(forOutsider.unavailable.includes(id), 'it is reported unavailable to them, so a layout they saved keeps it for when they gain the permission');
    expect((await idsFor()).includes(id), 'and with no user, nothing is filtered');
    const [admin] = await db.select({ id: userGroup.userId }).from(userGroup).where(eq(userGroup.groupName, 'system:Administrators')).limit(1);
    if(admin) expect((await idsFor({ userId: admin.id })).includes(id), 'an administrator holds every permission');
    pass();
  },

  'an action is stored with the widget and shown only to people who hold its permission': async ({ pass }) => {
    await register('acting', {
      actions: [
        { label: 'Open', href: '/dash-sdk/open', icon: 'add' },
        { label: 'Manage', href: '/dash-sdk/manage', permission: PERMISSION }
      ]
    });
    const labelsFor = async options => {
      const [, { widgets }] = await listDashboardWidgets(options);
      return widgets.find(w => w.id === `${OWNER}:acting`).actions.map(a => a.label).join();
    };
    expect(await labelsFor() === 'Open,Manage', 'with no user nothing is filtered');
    expect(await labelsFor({ userId: state.ids.member }) === 'Open,Manage', 'a holder of the permission sees both');
    expect(await labelsFor({ userId: state.ids.outsider }) === 'Open', 'everyone else sees only the unrestricted one');
    pass();
  },

  'widgets are ordered by priority, then title': async ({ pass }) => {
    await register('late', { priority: 900, title: 'AAA late' });
    await register('early', { priority: -5, title: 'ZZZ early' });
    const all = await idsFor();
    expect(all[0] === `${OWNER}:early`, `lowest priority first, got ${all[0]}`);
    expect(all[all.length - 1] === `${OWNER}:late`, `highest last, got ${all[all.length - 1]}`);
    pass();
  },

  'disabling an extension takes its widgets off the list and reports them unavailable; enabling restores them': async ({ pass }) => {
    await db.insert(extension).values({ name: OWNER_DISABLED, version: '1.0.0', enabled: true, kempo: {}, installedAt: new Date(), updatedAt: new Date() });
    const [registerError] = await registerDashboardWidget({ owner: OWNER_DISABLED, key: 'w', title: 'W', element: 'dash-off-widget', module: '/dash-off/W.js' });
    expect(registerError === null, 'registered');
    const id = `${OWNER_DISABLED}:w`;
    const status = async () => {
      const [, result] = await listDashboardWidgets();
      return JSON.stringify({ offered: result.widgets.some(w => w.id === id), unavailable: result.unavailable.includes(id) });
    };

    expect(await status() === '{"offered":true,"unavailable":false}', 'offered while enabled');
    expect((await disableExtension({ name: OWNER_DISABLED }))[0] === null, 'disabled');
    expect(await status() === '{"offered":false,"unavailable":true}', 'not offered, but reported unavailable so a saved layout keeps it');
    expect((await enableExtension({ name: OWNER_DISABLED }))[0] === null, 'enabled');
    expect(await status() === '{"offered":true,"unavailable":false}', 'offered again');
    pass();
  },

  'uninstalling an extension removes its widgets entirely, so they are not even reported unavailable': async ({ pass }) => {
    const id = `${OWNER_DISABLED}:w`;
    const [uninstallError] = await uninstallExtension({ name: OWNER_DISABLED });
    expect(uninstallError === null, `uninstall failed: ${JSON.stringify(uninstallError)}`);
    const [, result] = await listDashboardWidgets();
    expect(!result.widgets.some(w => w.id === id) && !result.unavailable.includes(id), 'gone from both lists');
    const rows = await db.select().from(dashboardWidget).where(eq(dashboardWidget.owner, OWNER_DISABLED));
    expect(rows.length === 0, 'and the rows are deleted');
    pass();
  },

  'unregistering removes one widget, or all of an owner\'s': async ({ pass }) => {
    const [, one] = await unregisterDashboardWidget({ owner: OWNER, key: 'late' });
    expect(one.removed === 1, 'one removed');
    const [, none] = await unregisterDashboardWidget({ owner: OWNER, key: 'late' });
    expect(none.removed === 0, 'removing what is gone is not an error');
    const [, rest] = await unregisterDashboardWidget({ owner: OWNER });
    expect(rest.removed === 4, `the owner's remaining four went, got ${rest.removed}`);
    expect(!(await idsFor()).some(id => id.startsWith(`${OWNER}:`)), 'none left');
    expect((await unregisterDashboardWidget({}))[0]?.code === 400, 'an owner is required');
    pass();
  },
};

export const afterAll = async () => {
  if(databaseReachable) await purge();
};

export default {
  ...pure,
  ...(databaseReachable
    ? database
    : { 'dashboard registration (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') })
};
