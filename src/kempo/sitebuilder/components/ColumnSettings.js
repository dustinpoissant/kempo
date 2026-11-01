import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';

const WIDTHS = [
  { value: '', label: 'Fill' },
  { value: '3', label: '1/4' },
  { value: '4', label: '1/3' },
  { value: '6', label: '1/2' },
  { value: '8', label: '2/3' },
  { value: '9', label: '3/4' },
  { value: '12', label: 'Full' }
];

/* The Column's settings: its width in fractions, with an exact width (of 12) for one that is not a common fraction. */
export default class ColumnSettings extends WidgetSettings {
  render(){
    const size = String(this.node.attrs?.size ?? '');
    const custom = !WIDTHS.some(width => width.value === size);
    return html`
      ${this.renderChoice('size', 'Width', WIDTHS, { hint: 'Fill shares the space the other columns leave.' })}
      ${custom ? html`
        <div class="mb">
          <label class="d-b mbq" for="sb-column-size">Exact width<small class="d-b tc-muted">Out of 12.</small></label>
          <select id="sb-column-size" class="full" @change="${event => this.set('size', event.target.value, false)}">
            ${Array.from({ length: 12 }, (_, index) => String(index + 1)).map(value => html`<option value="${value}" ?selected="${value === size}">${value} of 12</option>`)}
          </select>
        </div>` : ''}
      ${this.renderFields(['size'])}
    `;
  }
}

customElements.define('k-column-settings', ColumnSettings);
