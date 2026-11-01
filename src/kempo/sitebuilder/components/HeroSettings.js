import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';

/* The Hero's settings: the background picture, its height as a choice, and how dark the overlay is as a slider. */
export default class HeroSettings extends WidgetSettings {
  render(){
    const overlay = Number(this.node.attrs?.overlay ?? 40);
    return html`
      ${this.renderFields(['height', 'overlay'])}
      ${this.renderChoice('height', 'Height', [{ value: 'medium', label: 'Medium' }, { value: 'tall', label: 'Tall' }, { value: 'full', label: 'Full screen' }])}
      <div class="mb">
        <label class="d-b mbq" for="sb-hero-overlay">Overlay darkness: ${overlay}<small class="d-b tc-muted">Darkens the picture so the text on it can be read.</small></label>
        <input id="sb-hero-overlay" type="range" class="full" min="0" max="90" .value="${String(overlay)}" @input="${event => this.set('overlay', Number(event.target.value))}">
      </div>
    `;
  }
}

customElements.define('k-hero-settings', HeroSettings);
