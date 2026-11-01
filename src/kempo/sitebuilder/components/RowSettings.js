import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';
import { setColumnLayout } from '/kempo/sitebuilder/ops.js';

/* [label, the width of each column]: '' is a column that takes the space the others leave. */
const LAYOUTS = [
  ['1 column', ['']],
  ['2 columns', ['', '']],
  ['3 columns', ['', '', '']],
  ['4 columns', ['', '', '', '']],
  ['1/3 + 2/3', ['4', '8']],
  ['2/3 + 1/3', ['8', '4']],
  ['1/4 + 3/4', ['3', '9']],
  ['3/4 + 1/4', ['9', '3']]
];

/*
  The Row's settings: a layout picked from common ones (which adds or removes columns to match), the columns listed, and
  a button to add one. A column's own width is set when the column is selected.
*/
export default class RowSettings extends WidgetSettings {
  render(){
    return html`
      ${this.renderFields()}
      <div class="mb">
        <label class="d-b mbq">Layout<small class="d-b tc-muted">Sets how many columns there are and how wide. Anything in a column that goes is moved into the last one.</small></label>
        <div class="d-f">
          ${LAYOUTS.map(([label, sizes]) => html`<button class="mrq mbq" @click="${() => this.edit(node => setColumnLayout(this.registry, node, sizes))}">${label}</button>`)}
        </div>
      </div>
      ${this.renderChildren('default', { label: 'Columns', hint: 'Select a column to set its width.', addType: 'column', addLabel: 'Add column' })}
    `;
  }
}

customElements.define('k-row-settings', RowSettings);
