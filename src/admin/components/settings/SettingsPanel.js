import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Spinner.js';
import '/kempo-ui/components/Icon.js';
import Toast from '/kempo-ui/components/Toast.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import { listSettings, setSetting, deleteSetting, getAllCurrentUserPermissions } from '/kempo/sdk.js';
import './Setting.js';
import humanize from './humanize.js';

/*
  The settings of one owner, each with the editor for its type, and a Save button for what was changed. Served at
  /admin/components/settings/SettingsPanel.js:

    <k-settings-panel owner="system"></k-settings-panel>
    <k-settings-panel owner="my-extension" heading="My Extension"></k-settings-panel>

  `owner` is `system`, `custom` or the name of an extension. The Custom panel also creates and deletes settings. An extension drops
  one of these in its own settings tab and needs no editor of its own. Whether the person can change them depends on who owns
  them (`system:settings:update`, `system:custom-settings:manage`, `system:extensions:manage`); without it the fields are read-only.
  Saving sends only what was changed, each as its own setting.
*/
const PERMISSIONS = { system: 'system:settings:update', custom: 'system:custom-settings:manage' };
const EXTENSION_PERMISSION = 'system:extensions:manage';

let permissionsPromise = null;
const myPermissions = () => (permissionsPromise ??= getAllCurrentUserPermissions().then(([, data]) => new Set(data?.permissions ?? [])));

const DEFAULTS = { string: '', number: 0, boolean: false, json: {}, secret: '' };

const coerce = (text, type) => {
  if(type === 'number'){
    const number = Number(text);
    if(String(text).trim() === '' || !Number.isFinite(number)) throw new Error('number');
    return number;
  }
  if(type === 'boolean') return String(text).toLowerCase() === 'true';
  if(type === 'json') return JSON.parse(String(text || '{}'));
  return String(text);
};

/*
  The settings API gives each value as it is stored, as text (`'true'`, `'7'`, a JSON string). The editors take real values, so the value
  is turned into the type the setting has. A secret is left as the mask the API sends: it only says that one is saved.
*/
const typed = record => {
  if(record.value === null || record.value === undefined || record.type === 'secret') return record;
  try {
    if(record.type === 'number') return { ...record, value: Number(record.value) };
    if(record.type === 'boolean') return { ...record, value: record.value === true || record.value === 'true' };
    if(record.type === 'json') return { ...record, value: typeof record.value === 'string' ? JSON.parse(record.value) : record.value };
  } catch {
    return record;
  }
  return record;
};

export default class SettingsPanel extends ShadowComponent {
  static properties = {
    owner: { type: String },
    heading: { type: String },
    settings: { state: true },
    changes: { state: true },
    canEdit: { state: true },
    loading: { state: true },
    busy: { state: true },
    error: { state: true },
  };

  constructor(){
    super();
    this.owner = '';
    this.heading = '';
    this.settings = [];
    this.changes = {};
    this.canEdit = false;
    this.loading = true;
    this.busy = false;
    this.error = '';
  }

  /*
    Lifecycle
  */
  connectedCallback(){
    super.connectedCallback();
    this.load();
  }

  /*
    Loading and saving
  */
  shortName = record => record.name.slice(this.owner.length + 1);

  load = async () => {
    const [[error, data], permissions] = await Promise.all([listSettings({ owner: this.owner, limit: 1000 }), myPermissions()]);
    this.canEdit = permissions.has(PERMISSIONS[this.owner] ?? EXTENSION_PERMISSION);
    this.loading = false;
    if(error){
      this.error = error.msg || 'The settings could not be loaded';
      return;
    }
    this.error = '';
    this.settings = data.settings.map(typed);
    this.changes = {};
  };

  record = event => {
    const { name, value, valid } = event.detail;
    const record = this.settings.find(entry => this.shortName(entry) === name);
    const unchanged = record && (record.type === 'secret' ? value === '' : JSON.stringify(value) === JSON.stringify(record.value));
    const { [name]: removed, ...rest } = this.changes;
    this.changes = unchanged && valid ? rest : { ...rest, [name]: { value, valid } };
  };

  get dirty(){
    return Object.keys(this.changes).length > 0;
  }

  get blocked(){
    return Object.values(this.changes).some(change => !change.valid);
  }

  save = async () => {
    this.busy = true;
    let failed = 0;
    for(const [name, change] of Object.entries(this.changes)){
      const record = this.settings.find(entry => this.shortName(entry) === name);
      const [error] = await setSetting(this.owner, name, { value: change.value, type: record.type, isPublic: record.isPublic, description: record.description });
      if(error){
        failed++;
        Toast.error(`${humanize(name)}: ${error.msg || 'could not be saved'}`);
      }
    }
    this.busy = false;
    if(!failed) Toast.success('Settings saved');
    await this.load();
  };

  /*
    Custom settings: create and delete
  */
  create = () => {
    const dialog = Dialog.create(html`
      <div class="p">
        <label class="mb d-b">Name<input type="text" id="newName" placeholder="my_setting" required></label>
        <label class="mb d-b">Type
          <select id="newType">
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean (true or false)</option>
            <option value="json">JSON</option>
            <option value="secret">Secret</option>
          </select>
        </label>
        <label class="mb d-b">Value<input type="text" id="newValue"></label>
        <label class="mb d-b">Description<input type="text" id="newDescription"></label>
        <label class="mb d-b"><input type="checkbox" id="newPublic"> Public (anyone can read it, without signing in)</label>
      </div>
    `, {
      title: 'Create a setting',
      confirmText: 'Create',
      cancelText: 'Cancel',
      confirmAction: async () => {
        const read = id => dialog.querySelector(id);
        const name = read('#newName').value.trim();
        const type = read('#newType').value;
        if(!name){ Toast.error('Give the setting a name'); return; }
        if(name.includes(':')){ Toast.error('The name cannot contain ":"'); return; }
        let value;
        try {
          value = read('#newValue').value === '' ? DEFAULTS[type] : coerce(read('#newValue').value, type);
        } catch {
          Toast.error(`That is not a valid ${type} value`);
          return;
        }
        const [error] = await setSetting('custom', name, { value, type, isPublic: type !== 'secret' && read('#newPublic').checked, description: read('#newDescription').value.trim() });
        if(error){ Toast.error(error.msg || 'The setting could not be created'); return; }
        Toast.success('Setting created');
        await this.load();
      },
    });
    dialog.querySelector('#newType').addEventListener('change', event => {
      dialog.querySelector('#newValue').type = event.target.value === 'secret' ? 'password' : 'text';
    });
  };

  remove = record => {
    Dialog.confirm(`Delete ${humanize(this.shortName(record))}? This cannot be undone.`, async confirmed => {
      if(!confirmed) return;
      const [error] = await deleteSetting(this.owner, this.shortName(record));
      if(error){ Toast.error(error.msg || 'The setting could not be deleted'); return; }
      Toast.success('Setting deleted');
      await this.load();
    }, { title: 'Delete setting', confirmText: 'Delete', confirmClasses: 'danger ml', cancelText: 'Cancel', cancelClasses: '' });
  };

  /*
    Rendering
  */
  renderSetting(record){
    const name = this.shortName(record);
    const value = Object.hasOwn(this.changes, name) && this.changes[name].valid ? this.changes[name].value : record.value;
    const editor = html`<k-setting .setting=${{ name, value, type: record.type, description: record.description }} ?disabled=${!this.canEdit}></k-setting>`;
    if(this.owner !== 'custom' || !this.canEdit) return editor;
    return html`<div class="d-f"><div class="flex">${editor}</div><div><button class="danger" aria-label=${`Delete ${humanize(name)}`} title="Delete" @click=${() => this.remove(record)}><k-icon name="delete"></k-icon></button></div></div>`;
  }

  render(){
    if(this.loading) return html`<k-spinner></k-spinner>`;
    if(this.error) return html`<p class="tc-danger" role="alert">${this.error}</p>`;
    return html`
      ${this.heading ? html`<h2 class="h4">${this.heading}</h2>` : nothing}
      ${this.owner === 'custom' && this.canEdit ? html`<p class="mb"><button @click=${this.create}><k-icon name="add"></k-icon> Create a setting</button></p>` : nothing}
      ${this.canEdit ? nothing : html`<p class="tc-muted mb">You can see these settings but not change them.</p>`}
      ${this.settings.length ? this.settings.map(record => this.renderSetting(record)) : html`<p class="tc-muted mb">${this.owner === 'custom' ? 'There are no custom settings yet.' : 'There are no settings here.'}</p>`}
      ${this.canEdit && this.settings.length ? html`<button class="primary" ?disabled=${!this.dirty || this.blocked || this.busy} @click=${this.save}>${this.busy ? 'Saving…' : 'Save settings'}</button>` : nothing}
    `;
  }

  firstUpdated(){
    this.renderRoot.addEventListener('setting-change', this.record);
  }
}

customElements.define('k-settings-panel', SettingsPanel);
