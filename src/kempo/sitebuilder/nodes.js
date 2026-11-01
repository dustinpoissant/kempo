/*
  The widget tree. A tree is a list of nodes: { id, type, attrs, slots: { [slotName]: [node, ...] } }.
  Nothing here touches the DOM or Node.
*/

export const MAX_DEPTH = 100;

export const newId = () => {
  const bytes = globalThis.crypto?.getRandomValues?.(new Uint8Array(6));
  if(bytes) return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return Math.random().toString(16).slice(2, 14).padEnd(12, '0');
};

export const createNode = (type, attrs = {}, slots = {}) => ({ id: newId(), type, attrs, slots });

/* Calls fn(node, { parent, slot, list, index, depth }) for every node, parents before children. Return false from fn to skip a node's children. */
export const walk = (nodes, fn) => walkSlot(nodes, '', null, 1, fn);

const walkSlot = (children, slot, parent, depth, fn) => {
  children.forEach((node, index) => {
    const keep = fn(node, { parent, slot, list: children, index, depth });
    if(keep === false) return;
    for(const [slotName, grandchildren] of Object.entries(node.slots || {})){
      walkSlot(grandchildren, slotName, node, depth + 1, fn);
    }
  });
};

export const findNode = (nodes, id) => {
  let found = null;
  walk(nodes, (node, info) => {
    if(node.id === id){
      found = { node, ...info };
      return false;
    }
    return undefined;
  });
  return found;
};

export const findSlot = (nodes, parentId, slot) => {
  if(!parentId) return nodes;
  const found = findNode(nodes, parentId);
  if(!found) return null;
  found.node.slots = found.node.slots || {};
  found.node.slots[slot] = found.node.slots[slot] || [];
  return found.node.slots[slot];
};

export const countNodes = nodes => {
  let count = 0;
  walk(nodes, () => { count++; });
  return count;
};

/* The depth of the deepest node. A list of top-level nodes is depth 1. */
export const maxDepth = nodes => {
  let deepest = 0;
  walk(nodes, (node, { depth }) => { if(depth > deepest) deepest = depth; });
  return deepest;
};

/* A deep copy. With fresh ids it is a copy that can sit next to the original. */
export const cloneNodes = (nodes, freshIds = false) => nodes.map(node => cloneNode(node, freshIds));

export const cloneNode = (node, freshIds = false) => ({
  id: freshIds ? newId() : node.id,
  type: node.type,
  attrs: structuredClone(node.attrs || {}),
  slots: Object.fromEntries(Object.entries(node.slots || {}).map(([slot, children]) => [slot, cloneNodes(children, freshIds)]))
});

/* Removes the node with this id and returns it, or null. */
export const removeNode = (nodes, id) => {
  const found = findNode(nodes, id);
  if(!found) return null;
  found.list.splice(found.index, 1);
  return found.node;
};

/* Puts a node in a slot of a parent (null for the top level) at an index. Returns false when the parent or slot does not exist. */
export const insertNode = (nodes, parentId, slot, index, node) => {
  const list = findSlot(nodes, parentId, slot);
  if(!list) return false;
  list.splice(Math.max(0, Math.min(index, list.length)), 0, node);
  return true;
};

/* True when moving the node under the parent would put a node inside itself. */
export const isInside = (nodes, ancestorId, id) => {
  const ancestor = findNode(nodes, ancestorId);
  if(!ancestor) return false;
  return !!findNode([ancestor.node], id);
};
