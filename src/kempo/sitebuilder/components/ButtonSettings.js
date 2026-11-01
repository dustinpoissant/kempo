import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';

/* The Button's settings: its type, URL or ID and text as declared, and its colour chosen by looking at it. */
export default class ButtonSettings extends WidgetSettings {
  render(){
    const colors = [{ value: '', label: 'Default' }, ...['primary', 'secondary', 'success', 'warning', 'danger'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))];
    return html`
      ${this.renderFields(['color'])}
      ${this.renderChoice('color', 'Color', colors, { swatch: true })}
    `;
  }
}

customElements.define('k-button-settings', ButtonSettings);
