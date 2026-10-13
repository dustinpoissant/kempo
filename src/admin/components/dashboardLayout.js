export const STORAGE_KEY = 'kempo:admin:dashboard';

const clamp = (value, min, max, fallback) => Number.isInteger(value) ? Math.min(Math.max(value, min), max) : fallback;

/*
  A layout is an ordered array of `{ widget, visible, width, height }`, one per widget the server
  offered. What the browser remembers is smaller (see `serializeLayout`) and is reconciled with what the
  server offers on every load, so a widget that is new, gone, or resized in the definition never needs a
  migration.
*/

/*
  Merges the server's widget list with what the browser remembered. Widgets it has not seen before are
  appended in the server's order, shown or not according to `defaultVisible`; remembered ids the server no
  longer offers are dropped; a remembered size is clamped to the widget's current bounds.
*/
export const resolveLayout = (widgets, stored) => {
  const byId = new Map(widgets.map(widget => [widget.id, widget]));
  const remembered = stored && typeof stored === 'object' ? stored : {};
  const order = (Array.isArray(remembered.order) ? remembered.order : [])
    .filter((id, index, all) => byId.has(id) && all.indexOf(id) === index);
  const known = new Set(order);
  const hidden = new Set(Array.isArray(remembered.hidden) ? remembered.hidden : []);
  const sizes = remembered.sizes && typeof remembered.sizes === 'object' ? remembered.sizes : {};

  return [...order, ...widgets.map(widget => widget.id).filter(id => !known.has(id))].map(id => {
    const widget = byId.get(id);
    const size = sizes[id] && typeof sizes[id] === 'object' ? sizes[id] : {};
    return {
      widget,
      visible: known.has(id) ? !hidden.has(id) : widget.defaultVisible !== false,
      width: clamp(size.width, widget.minWidth, widget.maxWidth, widget.defaultWidth),
      height: clamp(size.height, widget.minHeight, widget.maxHeight, widget.defaultHeight)
    };
  });
};

/*
  What gets stored: the full order, the hidden ids, and only the sizes that differ from the widget's
  default, so a user who never resized a widget follows it when its default changes.

  `stored` is what was remembered before and `unavailable` the ids the server says exist but are not on
  offer right now (a disabled extension, a permission the user lost). Their entries are carried over so the
  widget comes back where it was: each is placed straight after the id that preceded it before, and its
  hidden state and size are kept. Anything else not in the layout is dropped, which is how an uninstalled
  extension is cleaned up.
*/
export const serializeLayout = (layout, { stored, unavailable = [] } = {}) => {
  const order = layout.map(({ widget }) => widget.id);
  const hidden = layout.filter(({ visible }) => !visible).map(({ widget }) => widget.id);
  const sizes = Object.fromEntries(layout
    .filter(({ widget, width, height }) => width !== widget.defaultWidth || height !== widget.defaultHeight)
    .map(({ widget, width, height }) => [widget.id, { width, height }]));

  const previous = stored && typeof stored === 'object' ? stored : {};
  const previousOrder = Array.isArray(previous.order) ? previous.order : [];
  const kept = new Set(unavailable);

  previousOrder.forEach((id, index) => {
    if(!kept.has(id) || order.includes(id)) return;
    const before = previousOrder.slice(0, index).reverse().find(other => order.includes(other));
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, id);
    if(Array.isArray(previous.hidden) && previous.hidden.includes(id)) hidden.push(id);
    if(previous.sizes?.[id]) sizes[id] = previous.sizes[id];
  });

  return { order, hidden, sizes };
};

/*
  Puts the layout in the order of `ids`. Entries whose id is not listed keep their relative order after
  the listed ones. Returns a new array.
*/
export const reorder = (layout, ids) => {
  const position = id => ids.indexOf(id) === -1 ? ids.length : ids.indexOf(id);
  return layout.slice().sort((a, b) => position(a.widget.id) - position(b.widget.id));
};

export const readStored = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
};

export const writeStored = value => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {}
};

export const clearStored = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
};
