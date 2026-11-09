/*
  kempo's change to kempo-ui's HTML widget. On a page the widget writes what was typed in it exactly as it is, with no
  element around it, so a file the builder takes over as it is (one HTML widget per location) is written back as it was
  and keeps working with the page's own CSS. The widget draws no element, so it has no box, colours or classes to set:
  put it in a Group to give it those. In the builder it keeps the element the builder needs to select and edit it.

  Like serverWidgets.js this imports nothing, so the server and the admin apply the same change.
*/
export default {
  display: '',
  hideStyles: ['box', 'background', 'textColour', 'align', 'id', 'classes'],
  render: (node, ctx, info) => (ctx.editor ? ctx.standard(node, info) : String(node.attrs?.html ?? ''))
};
