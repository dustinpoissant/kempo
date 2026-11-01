import coreWidgets from './widgets.js';
import { createRegistry } from './render.js';

/*
  The widgets a page can use: the ones kempo ships plus the ones installed extensions declare in `page_widgets`.
  The server and the editor both build their registry with this, so a tree means the same thing in both.
*/
export const buildRegistry = (extensionWidgets = []) => createRegistry([...coreWidgets, ...extensionWidgets]);

/* The key an extension's widget is known by on a page: the extension's name, a colon, and the widget's own key. */
export const widgetKey = (owner, key) => `${owner}:${key}`;
