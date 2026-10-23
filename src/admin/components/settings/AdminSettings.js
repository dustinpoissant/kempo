import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Tabs.js';
import './SettingsPanel.js';
import humanize from './humanize.js';

/*
  The admin Settings page, served at /admin/components/settings/AdminSettings.js. Tabs: **Custom** (the site's own settings) and **System**
  (kempo's), then a tab for each extension that chooses to add one. An extension that does not add a tab has nothing here: it manages
  its own settings wherever it likes.

  **An extension adds a tab** by filling the `admin-settings-tabs` location of the page with a `k-settings-tab` (and loads what the tab
  uses from the `admin-settings-scripts` location). `position` orders the tabs (Custom is 100, System 200, a tab with none 500):

    <k-settings-tab name="shipping" label="Shipping" position="500">
      <k-settings-panel owner="kempo-shipping"></k-settings-panel>
    </k-settings-tab>

  The tab holds anything: the generic panel above, a few of the extension's settings with their editors, or a screen of its own.
*/
const DEFAULT_TAB_POSITION = 500;

export default class AdminSettings extends ShadowComponent {
  static properties = {
    extensionTabs: { state: true },
  };

  constructor(){
    super();
    this.extensionTabs = [];
  }

  /*
    Lifecycle
  */
  connectedCallback(){
    super.connectedCallback();
    this.extensionTabs = [...this.querySelectorAll(':scope > k-settings-tab')].map(($tab, index) => {
      const name = $tab.getAttribute('name') || $tab.getAttribute('label') || `tab-${index}`;
      $tab.slot = `tab-${name}`;
      $tab.style.display = 'block';
      return {
        id: name,
        slotName: `tab-${name}`,
        label: $tab.getAttribute('label') || humanize(name),
        position: Number($tab.getAttribute('position')) || DEFAULT_TAB_POSITION,
        extension: true,
      };
    });
  }

  /*
    Rendering
  */
  render(){
    const tabs = [
      { id: 'custom', label: 'Custom', position: 100, content: () => html`<k-settings-panel owner="custom"></k-settings-panel>` },
      { id: 'system', label: 'System', position: 200, content: () => html`<k-settings-panel owner="system"></k-settings-panel>` },
      ...this.extensionTabs,
    ].sort((a, b) => a.position - b.position);

    return html`
      <k-tabs>
        ${tabs.map(tab => html`<k-tab for=${tab.id}>${tab.label}</k-tab>`)}
        ${tabs.map(tab => html`<k-tab-content name=${tab.id} class="pt">${tab.extension ? html`<slot name=${tab.slotName}></slot>` : tab.content()}</k-tab-content>`)}
      </k-tabs>
    `;
  }
}

customElements.define('k-admin-settings', AdminSettings);
