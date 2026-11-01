import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';

/* The Tabs' settings: the tabs listed, each one a click from its settings, with a button to add one. */
export default class TabsSettings extends WidgetSettings {
  render(){
    return html`
      ${this.renderFields()}
      ${this.renderChildren('default', { label: 'Tabs', addType: 'tab-item', addLabel: 'Add tab' })}
    `;
  }
}

customElements.define('k-tabs-settings', TabsSettings);
