import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import '/kempo-ui/components/CodeEditor.js';
import '/kempo-ui/components/Icon.js';
import WidgetSettings from './WidgetSettings.js';

/*
  The Script widget's settings: the file's address and how it loads, then JavaScript written in a large dialog with a code
  editor, which is used when no file is chosen.
*/
export default class ScriptSettings extends WidgetSettings {
  openEditor(){
    const editor = document.createElement('k-code-editor');
    editor.language = 'javascript';
    editor.value = this.node.attrs?.code ?? '';
    editor.style.cssText = 'height: 70vh; min-height: 24rem;';
    const body = document.createElement('div');
    body.className = 'p';
    body.append(editor);
    Dialog.create(body, {
      title: 'Edit JavaScript',
      width: 'min(90rem, 96vw)',
      confirmText: 'Save',
      cancelText: 'Cancel',
      confirmAction: () => this.set('code', editor.getValue(), false)
    });
  }

  render(){
    const code = String(this.node.attrs?.code ?? '').trim();
    const lines = code ? code.split('\n').length : 0;
    const hasFile = !!this.node.attrs?.src;
    return html`
      ${this.renderFields(['code'])}
      <div class="mb">
        <label class="d-b mbq">JavaScript<small class="d-b tc-muted">Runs on the page where this widget is, when there is no script file above. It runs on the published page, not in this editor.</small></label>
        <p class="tc-muted">${lines ? `${lines} ${lines === 1 ? 'line' : 'lines'}${hasFile ? ', not used while a script file is set' : ''}` : 'Nothing yet.'}</p>
        <button class="primary" @click="${() => this.openEditor()}"><k-icon name="edit"></k-icon> Edit JavaScript</button>
      </div>
    `;
  }
}

customElements.define('k-script-settings', ScriptSettings);
