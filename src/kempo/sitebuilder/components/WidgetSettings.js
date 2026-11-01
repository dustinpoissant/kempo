import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { findNode } from '/kempo/sitebuilder/nodes.js';
import { hintOf, titleOf } from '/admin/components/sitebuilder/labels.js';
import '/admin/components/sitebuilder/SitebuilderFields.js';
import '/kempo-ui/components/Icon.js';

/*
  The base class for a widget's own settings: the component that fills the page builder's right panel for the widget
  instead of the fields built from its declared attributes. Declare it on the widget with `settings_component` (the
  module's URL) and `settings_tag` (the tag it defines), and extend this class. The panel gives it:

    node       the selected widget, { id, type, attrs, slots }
    registry   the widget registry
    host       the page editor (see the methods below)
    version    a number that changes with every change to the page, so a change made elsewhere redraws this too

  Methods:

    set(name, value)                     change one attribute
    edit((node, nodes) => …)             change the page any way you like: the function gets this widget's node (a copy
                                         the editor keeps if it returns true) and the whole tree; it is one undo step
    addChild(type, slot)                 add a widget inside this one, leaving the selection alone
    select(id)                           select another widget, such as one of this one's children

  Drawing:

    renderFields(except)                 the widget's declared attributes, as the default panel draws them, without the
                                         names in `except`, so a settings component adds to them or replaces some
    renderChoice(name, label, choices)   one attribute as a row of buttons: choices are { value, label, icon? }
    renderChildren(slot, options)        a list of the widgets in a slot, each with a button to select it, and a button
                                         that adds one

  Like the rest of the admin it is a ShadowComponent, so kempo-css is in its shadow DOM. Hints sit between a label and
  its control.
*/
export default class WidgetSettings extends ShadowComponent {
  static properties = {
    node: { attribute: false },
    registry: { attribute: false },
    host: { attribute: false },
    version: { type: Number }
  };

  /*
    Changing the page
  */

  set(name, value, coalesce = true){
    this.host.setAttribute(this.node.id, name, value, coalesce);
  }

  edit(change){
    this.host.change(nodes => {
      const found = findNode(nodes, this.node.id);
      return found ? change(found.node, nodes) : 'That widget no longer exists';
    });
  }

  addChild(type, slot = 'default'){
    this.host.addChild(this.node.id, type, slot);
  }

  select(id){
    this.host.select(id);
  }

  /*
    Drawing
  */

  renderFields(except = []){
    return html`<admin-sitebuilder-fields .node="${this.node}" .registry="${this.registry}" .host="${this.host}" .version="${this.version}" .exclude="${except}"></admin-sitebuilder-fields>`;
  }

  /* Choices are { value, label, icon }; with `swatch` each button is drawn in its own colour (a kempo-css colour class). */
  renderChoice(name, label, choices, { hint = '', swatch = false } = {}){
    const current = String(this.node.attrs?.[name] ?? choices[0]?.value ?? '');
    return html`
      <div class="mb">
        <label class="d-b mbq">${label}${hint ? html`<small class="d-b tc-muted">${hint}</small>` : ''}</label>
        <div class="${swatch ? 'd-f' : 'btn-grp'}">
          ${choices.map(choice => html`
            <button class="${swatch ? `${choice.value} mrq mbq` : ''} ${!swatch && current === String(choice.value) ? 'primary' : ''}" title="${choice.label}" aria-pressed="${current === String(choice.value)}" @click="${() => this.set(name, choice.value, false)}">
              ${choice.icon ? html`<k-icon name="${choice.icon}"></k-icon>` : ''}${swatch && current === String(choice.value) ? html`<k-icon name="check"></k-icon>` : ''} ${choice.label}
            </button>`)}
        </div>
      </div>`;
  }

  /*
    options: label (the heading), hint, addType (the widget a new one is), addLabel (the button's words) and, for the
    kind of widget a slot holds, nothing else: each row shows the widget's own name and its text.
  */
  renderChildren(slot, { label = 'Contents', hint = '', addType, addLabel = 'Add' } = {}){
    const children = this.node.slots?.[slot] || [];
    return html`
      <div class="mb">
        <label class="d-b mbq">${label}${hint ? html`<small class="d-b tc-muted">${hint}</small>` : ''}</label>
        ${children.length ? html`
          <div class="mb">
            ${children.map((child, index) => html`
              <div class="d-f mbq">
                <span class="flex">${index + 1}. ${hintOf(child) || titleOf(this.registry, child)}</span>
                <button title="Select it" aria-label="Select ${titleOf(this.registry, child)} ${index + 1}" @click="${() => this.select(child.id)}"><k-icon name="edit"></k-icon></button>
              </div>`)}
          </div>` : html`<p class="tc-muted">Nothing here yet.</p>`}
        ${addType ? html`<button @click="${() => this.addChild(addType, slot)}"><k-icon name="add"></k-icon> ${addLabel}</button>` : ''}
      </div>`;
  }
}
