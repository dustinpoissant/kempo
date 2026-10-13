import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { dashboardWidget, extension } from '../../db/schema.js';
import userHasPermission from '../permissions/userHasPermission.js';
import coreWidgets from './coreWidgets.js';

const publicFields = ({ createdAt, updatedAt, ...widget }) => widget;

/*
  Every widget the dashboard can show: Kempo's own plus those extensions registered. Widgets of a
  disabled extension are left out, since the module they point at is no longer served.

  Pass `userId` to also drop widgets that person lacks the `permission` for; the check runs once per
  distinct permission, and administrators hold every one. The same applies to each action's own
  `permission`. Without `userId` nothing is filtered by permission.

  `unavailable` lists the ids of widgets that exist but are not offered to this person, because their
  extension is disabled or they lack the permission. A client that remembers a layout keeps those entries
  so the widget returns to its place when it becomes available again, and drops entries for ids that are in
  neither list, which is what an uninstalled extension looks like.

  Ordered by `priority`, then title. If the widget table has not been created yet (a site that upgraded
  without applying the schema), Kempo's own widgets are still returned so the dashboard is not blank.
*/
export default async ({ userId } = {}) => {
  let registered = [];
  const unavailable = [];

  try {
    const rows = await db
      .select({ widget: dashboardWidget, enabled: extension.enabled, installed: extension.name })
      .from(dashboardWidget)
      .leftJoin(extension, eq(extension.name, dashboardWidget.owner));
    rows.forEach(({ widget, enabled, installed }) => {
      if(installed && !enabled) unavailable.push(widget.id);
      else registered.push(publicFields(widget));
    });
  } catch(error) {
    console.warn(`Dashboard widgets from extensions are unavailable: ${error.message}`);
  }

  let widgets = [...coreWidgets, ...registered];

  if(userId){
    const permissions = [...new Set(widgets.flatMap(widget => [widget.permission, ...(widget.actions || []).map(action => action.permission)]).filter(Boolean))];
    const granted = new Set();

    await Promise.all(permissions.map(async permission => {
      const [error, allowed] = await userHasPermission(userId, permission);
      if(!error && allowed) granted.add(permission);
    }));

    widgets.filter(widget => widget.permission && !granted.has(widget.permission)).forEach(widget => unavailable.push(widget.id));

    widgets = widgets
      .filter(widget => !widget.permission || granted.has(widget.permission))
      .map(widget => ({ ...widget, actions: (widget.actions || []).filter(action => !action.permission || granted.has(action.permission)) }));
  }

  widgets.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

  return [null, { widgets, unavailable }];
};
