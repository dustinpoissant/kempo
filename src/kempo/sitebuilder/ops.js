import { MAX_DEPTH, cloneNode, createNode, findNode, findSlot, insertNode, isInside, maxDepth, removeNode } from './nodes.js';
import { attributeDefault } from './attributes.js';
import { canContain, slotsOf } from './render.js';

/*
  What the editor does to a tree. Each function changes the nodes it is given (the editor works on a copy and keeps
  the history) and returns true when it did something, or a string saying why it could not. Nothing here touches the DOM.
*/

/* A new widget with its settings at their defaults, and the children a widget needs to be usable at once. */
export const defaultNode = (registry, type) => {
  const definition = registry.get(type);
  const attrs = {};
  for(const attribute of definition.attributes){
    if(attribute.virtual) continue;
    const value = attributeDefault(attribute);
    if(value !== '' && value !== false) attrs[attribute.name] = value;
  }
  const node = createNode(type, attrs);
  if(type === 'row') node.slots.default = [defaultNode(registry, 'column'), defaultNode(registry, 'column')];
  if(type === 'accordion') node.slots.default = [defaultNode(registry, 'accordion-item')];
  if(type === 'tabs') node.slots.default = [defaultNode(registry, 'tab-item'), defaultNode(registry, 'tab-item')];
  if(type === 'table') node.attrs.rows = [['', ''], ['', '']];
  if(type === 'markup') node.attrs.html = '';
  if(type === 'unknown') node.attrs.html = '';
  return node;
};

/*
  Sets the columns of a Row to these widths ('' is a column that takes the space the others leave): columns are added or
  removed to match, and what was in a column that goes is moved into the last one that stays, so nothing is lost.
*/
export const setColumnLayout = (registry, row, sizes) => {
  const columns = row.slots.default = row.slots.default || [];
  while(columns.length < sizes.length) columns.push(defaultNode(registry, 'column'));
  while(columns.length > sizes.length){
    const removed = columns.pop();
    const keeper = columns[columns.length - 1];
    keeper.slots.default = [...(keeper.slots.default || []), ...(removed.slots.default || [])];
  }
  columns.forEach((column, index) => {
    if(sizes[index]) column.attrs.size = sizes[index];
    else delete column.attrs.size;
  });
  return true;
};

const where = (nodes, id) => {
  const found = findNode(nodes, id);
  if(!found) return null;
  return found;
};

/* The first slot of a node that accepts a widget of this type, or null. */
export const acceptingSlot = (registry, node, childType) => {
  const definition = registry.get(node.type);
  return slotsOf(definition).find(slot => canContain(registry, node, slot.name, childType))?.name ?? null;
};

/*
  Puts a node at a place: the slot of a parent (null for the top level) at an index. Returns true, or the reason it
  was refused.
*/
export const place = (nodes, registry, node, parentId, slot, index) => {
  const parent = parentId ? where(nodes, parentId)?.node : null;
  if(parentId && !parent) return 'That place no longer exists';
  if(!canContain(registry, parent, slot, node.type)) return `${registry.get(node.type)?.title ?? 'That widget'} cannot go there`;
  const depth = (parentId ? where(nodes, parentId).depth : 0) + maxDepth([node]);
  if(depth > MAX_DEPTH) return `Widgets cannot be nested more than ${MAX_DEPTH} levels deep`;
  return insertNode(nodes, parentId, slot, index, node) ? true : 'That place no longer exists';
};

/*
  Puts an existing node near a target: after it, or into its first slot that takes it when `inside` is set (the target
  is a container the person is adding to). Without a target it goes at the end. If the target's own list will not
  take it, it goes after the target's parent, and so on up. A target with nothing in it that takes the widget gets it
  inside; so does a target the widget goes nowhere beside (a column added to a row, a section to an accordion).
*/
const placeNode = (nodes, registry, node, { targetId = null, inside = false, slot = null } = {}) => {
  const target = targetId ? where(nodes, targetId) : null;
  if(target && inside){
    const name = slot || acceptingSlot(registry, target.node, node.type);
    if(!name) return { error: `${registry.get(node.type).title} cannot go inside ${registry.get(target.node.type).title}` };
    const children = findSlot(nodes, target.node.id, name);
    const result = place(nodes, registry, node, target.node.id, name, children.length);
    return result === true ? {} : { error: result };
  }
  if(target){
    const inner = acceptingSlot(registry, target.node, node.type);
    const placeInside = () => {
      const result = place(nodes, registry, node, target.node.id, inner, findSlot(nodes, target.node.id, inner).length);
      return result === true ? {} : { error: result };
    };
    if(inner && !Object.values(target.node.slots || {}).some(children => children.length)) return placeInside();
    let current = target;
    let failure = '';
    while(current){
      const parentNode = current.parent;
      const result = place(nodes, registry, node, parentNode?.id ?? null, current.slot, current.index + 1);
      if(result === true) return {};
      failure = result;
      current = parentNode ? where(nodes, parentNode.id) : null;
    }
    return inner ? placeInside() : { error: failure };
  }
  const result = place(nodes, registry, node, null, '', nodes.length);
  return result === true ? {} : { error: result };
};

/* Adds a new widget at its defaults. Returns { id } or { error }. */
export const addWidget = (nodes, registry, type, options = {}) => {
  const node = defaultNode(registry, type);
  const result = placeNode(nodes, registry, node, options);
  return result.error ? result : { id: node.id };
};

/* Adds nodes that already exist (a saved template's copies), one after the other. Returns { ids } or { error }. */
export const insertNodes = (nodes, registry, list, options = {}) => {
  const ids = [];
  let anchor = options;
  for(const node of list){
    const result = placeNode(nodes, registry, node, anchor);
    if(result.error){
      for(const id of ids) removeNode(nodes, id);
      return { error: result.error };
    }
    ids.push(node.id);
    anchor = { targetId: node.id };
  }
  return { ids };
};

export const removeWidgets = (nodes, ids) => {
  for(const id of ids) removeNode(nodes, id);
  return true;
};

/* Moves one node to a place. Refuses to put a node inside itself. */
export const moveWidget = (nodes, registry, id, parentId, slot, index) => {
  const found = where(nodes, id);
  if(!found) return 'That widget no longer exists';
  if(parentId && (parentId === id || isInside(nodes, id, parentId))) return 'A widget cannot go inside itself';
  const backup = { list: found.list, index: found.index };
  const [node] = found.list.splice(found.index, 1);
  let target = index;
  if(backup.list === findSlot(nodes, parentId, slot) && backup.index < index) target = index - 1;
  const result = place(nodes, registry, node, parentId, slot, target);
  if(result !== true){
    backup.list.splice(backup.index, 0, node);
    return result;
  }
  return true;
};

/* Several nodes that share a list, moved together by one step. */
export const moveBy = (nodes, registry, ids, step) => {
  const found = ids.map(id => where(nodes, id)).filter(Boolean);
  if(!found.length) return 'Nothing is selected';
  const { list } = found[0];
  const indexes = found.map(item => item.index).sort((a, b) => a - b);
  const first = indexes[0];
  const last = indexes[indexes.length - 1];
  if(step < 0 && first === 0) return 'Already first';
  if(step > 0 && last === list.length - 1) return 'Already last';
  const moving = list.splice(first, last - first + 1);
  list.splice(first + step, 0, ...moving);
  return true;
};

/* Moves a node out of its parent, to sit just after it. */
export const moveOut = (nodes, registry, id) => {
  const found = where(nodes, id);
  if(!found?.parent) return 'Already at the top';
  const parent = where(nodes, found.parent.id);
  return moveWidget(nodes, registry, id, parent.parent?.id ?? null, parent.slot, parent.index + 1);
};

/* Moves a node into the widget just before it, at the end of the first slot that takes it. */
export const moveIn = (nodes, registry, id) => {
  const found = where(nodes, id);
  if(!found) return 'That widget no longer exists';
  for(let index = found.index - 1; index >= 0; index--){
    const sibling = found.list[index];
    const slot = acceptingSlot(registry, sibling, found.node.type);
    if(slot) return moveWidget(nodes, registry, id, sibling.id, slot, findSlot(nodes, sibling.id, slot).length);
  }
  return 'There is nothing before it to move into';
};

/* Copies nodes (with their children) to sit just after the last of them. Returns the ids of the copies. */
export const duplicateWidgets = (nodes, ids) => {
  const found = ids.map(id => where(nodes, id)).filter(Boolean);
  if(!found.length) return { error: 'Nothing is selected' };
  const { list } = found[0];
  const sorted = [...found].sort((a, b) => a.index - b.index);
  const copies = sorted.map(item => cloneNode(item.node, true));
  list.splice(sorted[sorted.length - 1].index + 1, 0, ...copies);
  return { ids: copies.map(copy => copy.id) };
};

/* Whether every node in the set shares one parent and slot (what multi-select allows). */
export const sharePlace = (nodes, ids) => {
  const found = ids.map(id => where(nodes, id));
  if(found.some(item => !item)) return false;
  return found.every(item => item.list === found[0].list);
};

/* The selection after a node is removed: its next sibling, else the previous, else its parent. */
export const neighbour = (nodes, id) => {
  const found = where(nodes, id);
  if(!found) return null;
  return found.list[found.index + 1]?.id ?? found.list[found.index - 1]?.id ?? found.parent?.id ?? null;
};

/* A copy of nodes with fresh ids, for inserting a saved template. */
export const freshCopies = nodes => nodes.map(node => cloneNode(node, true));
