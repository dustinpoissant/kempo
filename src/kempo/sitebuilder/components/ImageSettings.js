import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';

/*
  The Image's settings: the picture, its text and width, then what the page writes as a class and a style so the person
  never sees them: full width, the aspect ratio, how the picture fills it, and the corners.
*/
export default class ImageSettings extends WidgetSettings {
  render(){
    const ratio = this.node.attrs?.ratio || '';
    const options = this.registry.get('image').attributes.find(attribute => attribute.name === 'ratio').options;
    return html`
      ${this.renderFields(['ratio', 'fit', 'rounded'])}
      <div class="mb">
        <label class="d-b mbq" for="sb-image-ratio">Aspect ratio<small class="d-b tc-muted">Crops the picture to this ratio. Original keeps its own.</small></label>
        <select id="sb-image-ratio" class="full" @change="${event => this.set('ratio', event.target.value, false)}">
          ${options.map(option => html`<option value="${option.value}" ?selected="${option.value === ratio}">${option.label}</option>`)}
        </select>
      </div>
      ${ratio ? this.renderChoice('fit', 'Fit', [{ value: '', label: 'Fill and crop' }, { value: 'contain', label: 'Show all' }], { hint: 'How the picture fills the aspect ratio.' }) : ''}
      ${this.renderChoice('rounded', 'Corners', [{ value: '', label: 'Square' }, { value: 'small', label: 'Rounded' }, { value: 'round', label: 'Circle' }])}
    `;
  }
}

customElements.define('k-image-settings', ImageSettings);
