import db from '../../db/index.js';
import { dashboardWidget } from '../../db/schema.js';
import { CORE_OWNER, normalizeWidget } from './helpers.js';

/*
  Adds a widget to the admin dashboard, or updates it when `owner` and `key` already exist, so an
  extension can call this from `install.js` and again from `update.js` without checking first.

  `element` is the custom element the dashboard creates and `module` is the site path of the script
  that defines it. The element loads its own data when it connects, so nothing here is fetched until a
  user has the widget on their dashboard. `permission` hides it from people who do not hold it.

  Sizes are in blocks: width 1 to 4, height 1 to 3. `minWidth`/`maxWidth`/`minHeight`/`maxHeight` bound
  what a user may resize it to; `priority` orders it among the defaults, lowest first.
*/
export default async definition => {
  const [invalid, widget] = normalizeWidget(definition);

  if(invalid){
    return [invalid, null];
  }

  if(widget.owner === CORE_OWNER){
    return [{ code: 400, msg: `Owner "${CORE_OWNER}" is reserved for Kempo's own widgets` }, null];
  }

  try {
    const now = new Date();
    const { id, ...changes } = widget;
    const [saved] = await db
      .insert(dashboardWidget)
      .values({ ...widget, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: dashboardWidget.id, set: { ...changes, updatedAt: now } })
      .returning();

    return [null, saved];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to register dashboard widget' }, null];
  }
};
