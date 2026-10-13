import { isLocalPath } from '../notifications/helpers.js';

export const MAX_WIDTH = 4;
export const MAX_HEIGHT = 3;
export const CORE_OWNER = 'kempo';
export const MAX_ACTIONS = 3;

const ELEMENT_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const isBlocks = (value, max) => Number.isInteger(value) && value >= 1 && value <= max;

/*
  Reduces a widget definition to the stored fields and fills in the defaults, so nothing a caller
  passes beyond them is kept. Returns an error tuple for anything that would leave the dashboard
  unable to render the widget: a size outside the grid, bounds that contradict each other, an element
  name that is not a valid custom element, or a module that is not a path on this site.
*/
export const normalizeWidget = ({
  owner,
  key,
  title,
  description = null,
  icon = null,
  element,
  module,
  defaultWidth = 2,
  defaultHeight = 1,
  minWidth = 1,
  maxWidth = MAX_WIDTH,
  minHeight = 1,
  maxHeight = MAX_HEIGHT,
  permission = null,
  actions = [],
  priority = 100,
  defaultVisible = true
} = {}) => {
  if(!isText(owner, 100)){
    return [{ code: 400, msg: 'Owner is required' }, null];
  }

  if(typeof key !== 'string' || !KEY_PATTERN.test(key) || key.length > 100){
    return [{ code: 400, msg: 'Key is required and may only contain letters, numbers, ".", "_" and "-"' }, null];
  }

  if(!isText(title, 100)){
    return [{ code: 400, msg: 'Title is required and must be at most 100 characters' }, null];
  }

  if(description !== null && !(typeof description === 'string' && description.length <= 300)){
    return [{ code: 400, msg: 'Description must be a string of at most 300 characters' }, null];
  }

  if(icon !== null && !isText(icon, 60)){
    return [{ code: 400, msg: 'Icon must be an icon name' }, null];
  }

  if(typeof element !== 'string' || !ELEMENT_PATTERN.test(element)){
    return [{ code: 400, msg: 'Element must be a custom element tag name such as "my-ext-widget"' }, null];
  }

  if(!isLocalPath(module)){
    return [{ code: 400, msg: 'Module must be a path on this site, beginning with a single "/"' }, null];
  }

  if(!isBlocks(minWidth, MAX_WIDTH) || !isBlocks(maxWidth, MAX_WIDTH) || minWidth > maxWidth){
    return [{ code: 400, msg: `minWidth and maxWidth must be whole numbers from 1 to ${MAX_WIDTH}, minWidth no greater than maxWidth` }, null];
  }

  if(!isBlocks(minHeight, MAX_HEIGHT) || !isBlocks(maxHeight, MAX_HEIGHT) || minHeight > maxHeight){
    return [{ code: 400, msg: `minHeight and maxHeight must be whole numbers from 1 to ${MAX_HEIGHT}, minHeight no greater than maxHeight` }, null];
  }

  if(!Number.isInteger(defaultWidth) || defaultWidth < minWidth || defaultWidth > maxWidth){
    return [{ code: 400, msg: 'defaultWidth must be a whole number between minWidth and maxWidth' }, null];
  }

  if(!Number.isInteger(defaultHeight) || defaultHeight < minHeight || defaultHeight > maxHeight){
    return [{ code: 400, msg: 'defaultHeight must be a whole number between minHeight and maxHeight' }, null];
  }

  if(permission !== null && !isText(permission, 200)){
    return [{ code: 400, msg: 'Permission must be a permission name' }, null];
  }

  if(!Array.isArray(actions) || actions.length > MAX_ACTIONS){
    return [{ code: 400, msg: `actions must be an array of at most ${MAX_ACTIONS} items` }, null];
  }

  const cleanActions = [];

  for(const action of actions){
    if(!action || typeof action !== 'object' || Array.isArray(action)){
      return [{ code: 400, msg: 'Each action must be an object' }, null];
    }

    const { label, href, icon: actionIcon = null, permission: actionPermission = null } = action;

    if(!isText(label, 40)){
      return [{ code: 400, msg: 'Each action needs a label of at most 40 characters' }, null];
    }

    if(!isLocalPath(href)){
      return [{ code: 400, msg: 'An action href must be a path on this site, beginning with a single "/"' }, null];
    }

    if(actionIcon !== null && !isText(actionIcon, 60)){
      return [{ code: 400, msg: 'An action icon must be an icon name' }, null];
    }

    if(actionPermission !== null && !isText(actionPermission, 200)){
      return [{ code: 400, msg: 'An action permission must be a permission name' }, null];
    }

    cleanActions.push({ label: label.trim(), href, icon: actionIcon, permission: actionPermission });
  }

  if(!Number.isInteger(priority)){
    return [{ code: 400, msg: 'Priority must be a whole number' }, null];
  }

  return [null, {
    id: `${owner}:${key}`,
    owner,
    key,
    title: title.trim(),
    description,
    icon,
    element,
    module,
    defaultWidth,
    defaultHeight,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    permission,
    actions: cleanActions,
    priority,
    defaultVisible: defaultVisible !== false
  }];
};
