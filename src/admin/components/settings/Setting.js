import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import './StringSetting.js';
import './NumberSetting.js';
import './BooleanSetting.js';
import './JsonSetting.js';
import './SecretSetting.js';

/*
  The editor for a setting, chosen by its type, served at /admin/components/settings/Setting.js:

    <k-setting .setting=${{ name: 'site_name', value: 'My Site', type: 'string', description: 'The name of the website' }}></k-setting>

  `name` is the setting's own name without its owner (`site_name`, not `system:site_name`); the readable title is made from it. An
  unknown type is edited as a string. The editor's `setting-change` event bubbles out of this element unchanged.
*/
export default class Setting extends ShadowComponent {
  static properties = {
    setting: { attribute: false },
    disabled: { type: Boolean },
  };

  constructor(){
    super();
    this.setting = null;
    this.disabled = false;
  }

  render(){
    const { name, value, type, description } = this.setting ?? {};
    if(!name) return null;
    switch(type){
      case 'number': return html`<k-setting-number name=${name} description=${description ?? ''} ?disabled=${this.disabled} .value=${value}></k-setting-number>`;
      case 'boolean': return html`<k-setting-boolean name=${name} description=${description ?? ''} ?disabled=${this.disabled} .value=${value}></k-setting-boolean>`;
      case 'json': return html`<k-setting-json name=${name} description=${description ?? ''} ?disabled=${this.disabled} .value=${value}></k-setting-json>`;
      case 'secret': return html`<k-setting-secret name=${name} description=${description ?? ''} ?disabled=${this.disabled} .saved=${value !== null && value !== undefined} .value=${''}></k-setting-secret>`;
      default: return html`<k-setting-string name=${name} description=${description ?? ''} ?disabled=${this.disabled} .value=${value ?? ''}></k-setting-string>`;
    }
  }
}

customElements.define('k-setting', Setting);
