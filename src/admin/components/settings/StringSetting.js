import { html } from '/kempo-ui/lit-all.min.js';
import SettingEditor from './SettingEditor.js';

/* A string setting: a text field, or a larger box for one that is long or has several lines. */
export default class StringSetting extends SettingEditor {
  renderControl(){
    const text = String(this.value ?? '');
    if(text.length > 120 || text.includes('\n')) return html`<textarea rows="4" ?disabled=${this.disabled} .value=${text} @input=${event => this.announce(event.target.value)}></textarea>`;
    return html`<input type="text" ?disabled=${this.disabled} .value=${text} @input=${event => this.announce(event.target.value)}>`;
  }
}

customElements.define('k-setting-string', StringSetting);
