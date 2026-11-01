import Widget from './Widget.js';

/*
  The base class for the editor side of a widget: what the admin shows in the page editor in place of the page
  component, when a widget needs to edit itself in a way the generic editor cannot (its own text editor, a canvas).
  A widget that only needs its settings edited does not need one: the generic editor shows the real page component
  and edits the declared attributes.

  The editor side should look the same as the page side. It adds three things:

    - it takes part in focus: the page editor selects the widget when it is clicked once, and the widget is
      focusable so the keyboard can reach it;
    - `emitChange(changes)` tells the page editor that settings changed (`{ attributeName: newValue }`), and the
      editor updates the widget's data and its attribute panel, and records an undo step;
    - the page editor sets `selected` on the widget that is selected, so the widget can open its own editing
      controls only then (the first click selects, the next ones edit).
*/
export default class WidgetEditor extends Widget {
  static properties = {
    ...Widget.properties,
    selected: { type: Boolean, reflect: true }
  };

  constructor(){
    super();
    this.selected = false;
  }

  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('tabindex')) this.tabIndex = 0;
  }

  emitChange(changes){
    this.dispatchEvent(new CustomEvent('widget-change', {
      bubbles: true,
      composed: true,
      detail: { id: this.dataset.sbId, changes }
    }));
  }
}
