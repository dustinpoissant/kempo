import { html } from '/kempo-ui/lit-all.min.js';
import SettingEditor from './SettingEditor.js';

/*
  A secret setting (an API key, a signing secret). It is replace-only: the saved value is never sent to the browser, so the field starts
  empty and an empty field means "keep what is saved". Typing a new value announces it, and clearing the field again takes it back.
*/
export default class SecretSetting extends SettingEditor {
  static properties = { ...SettingEditor.properties, saved: { type: Boolean } };

  constructor(){
    super();
    this.saved = true;
    this.value = '';
  }

  renderHint(){
    return html`${super.renderHint()}<small class="tc-muted d-b">${this.saved ? 'A value is saved. It is stored encrypted and never shown. Type a new one to replace it.' : 'Not set yet. It is stored encrypted and never shown again.'}</small>`;
  }

  renderControl(){
    return html`<input type="password" autocomplete="new-password" ?disabled=${this.disabled} .value=${this.value ?? ''} @input=${event => this.announce(event.target.value)}>`;
  }
}

customElements.define('k-setting-secret', SecretSetting);
