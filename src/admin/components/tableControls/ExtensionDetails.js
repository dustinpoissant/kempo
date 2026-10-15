import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Markdown.js';

/*
  Shows what the extension catalogue knows about a row's extension: who wrote it, what it needs and
  what it adds, and its README. An extension that is in node_modules but not in the catalogue has no
  entry, and the dialog says so rather than failing.
*/
export default class ExtensionDetails extends AdminTableControl {
  show = async () => {
    if(!this.record) return;
    const { name } = this.record;

    const { getKnownExtension } = await import('/kempo/sdk.js');
    const [error, data] = await getKnownExtension(name);
    const item = data?.item;

    if(error && error.code !== 404){
      Toast.error(error.msg || 'Failed to load the extension details');
      return;
    }

    const contents = document.createElement('div');
    contents.className = 'p';

    const list = (label, values) => values.length
      ? `<p class="mb0"><strong>${label}</strong></p><ul>${values.map(value => `<li>${value}</li>`).join('')}</ul>`
      : '';

    const escape = value => String(value ?? '').replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);

    contents.innerHTML = item
      ? `
        <p>${escape(item.description)}</p>
        <p class="tc-muted">${[item.author && `By ${escape(item.author)}`, item.license && escape(item.license), item.version && `Version ${escape(item.version)}`, item.source === 'first-party' && 'First-party'].filter(Boolean).join(' · ')}</p>
        ${list('Requires these extensions', item.requires.extensions.map(escape))}
        ${list('Adds these permissions', item.provides.permissions.map(permission => escape(permission.name)))}
        ${list('Adds these settings', item.provides.settings.map(setting => escape(setting.name)))}
        ${item.homepage ? `<p><a href="${escape(item.homepage)}" target="_blank" rel="noopener noreferrer">${escape(item.homepage)}</a></p>` : ''}
        <hr />
        <k-markdown></k-markdown>
      `
      : `<p>${escape(this.record.description) || 'No description.'}</p><p class="tc-muted">This extension is not in the extension catalogue, so there is no more to show.</p>`;

    const markdown = contents.querySelector('k-markdown');
    if(markdown) markdown.value = item.readme || '*This extension has no README.*';

    Dialog.create(contents, {
      title: name,
      closeBtn: true,
      cancelText: 'Close',
    });
  };

  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Extension Details';
  }

  handleAction(){ this.show(); }

  render(){ return html`<k-icon name="info"></k-icon>`; }
}

customElements.define('admin-extension-details', ExtensionDetails);
