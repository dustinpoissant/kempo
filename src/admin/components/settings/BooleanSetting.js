import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Toggle.js';
import SettingEditor from './SettingEditor.js';

/* A boolean setting: a toggle with the name beside it and the description under it. */
export default class BooleanSetting extends SettingEditor {
  render(){
    return html`<div class="mb"><k-toggle ?disabled=${this.disabled} .value=${this.value === true || this.value === 'true'} @change=${event => this.announce(event.target.value === true)}>${this.heading}</k-toggle>${this.renderHint()}</div>`;
  }
}

customElements.define('k-setting-boolean', BooleanSetting);
