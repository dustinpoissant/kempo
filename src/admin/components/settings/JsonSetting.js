import { html } from '/kempo-ui/lit-all.min.js';
import SettingEditor from './SettingEditor.js';

/*
  A JSON setting: the formatted JSON in a box. Text that is not JSON is reported as a problem and is not saved. What is typed is
  kept as typed (it is only formatted again when the value is set from outside), so the cursor does not jump while editing.
*/
export default class JsonSetting extends SettingEditor {
  text = '';

  willUpdate(changed){
    if(!changed.has('value')) return;
    let typed;
    try { typed = JSON.parse(this.text); } catch { typed = undefined; }
    if(typed === undefined || JSON.stringify(typed) !== JSON.stringify(this.value)) this.text = JSON.stringify(this.value ?? null, null, 2);
  }

  change = event => {
    this.text = event.target.value;
    try {
      this.announce(JSON.parse(this.text));
    } catch {
      this.announce(this.value, 'That is not valid JSON');
    }
  };

  renderControl(){
    return html`<textarea class="ff-mono" rows="8" ?disabled=${this.disabled} .value=${this.text} @input=${this.change}></textarea>`;
  }
}

customElements.define('k-setting-json', JsonSetting);
