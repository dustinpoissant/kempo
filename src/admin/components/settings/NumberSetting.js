import { html } from '/kempo-ui/lit-all.min.js';
import SettingEditor from './SettingEditor.js';

/* A number setting: a number field. An empty or non-numeric entry is reported as a problem instead of being saved as NaN. */
export default class NumberSetting extends SettingEditor {
  change = event => {
    const text = event.target.value;
    const number = Number(text);
    if(text.trim() === '' || !Number.isFinite(number)) this.announce(this.value, 'Enter a number');
    else this.announce(number);
  };

  renderControl(){
    return html`<input type="number" step="any" ?disabled=${this.disabled} .value=${String(this.value ?? 0)} @input=${this.change}>`;
  }
}

customElements.define('k-setting-number', NumberSetting);
