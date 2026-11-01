import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import '/kempo-ui/components/CodeEditor.js';
import '/kempo-ui/components/Icon.js';
import WidgetSettings from './WidgetSettings.js';

/*
  The HTML block's settings: its code, edited in a large dialog with a code editor. The page shows the code exactly as it
  is written, so what the dialog saves is what the page gets.
*/
export default class HtmlBlockSettings extends WidgetSettings {
  openEditor(){
    const code = document.createElement('k-code-editor');
    code.language = 'html';
    code.value = this.node.attrs?.html ?? '';
    code.style.cssText = 'height: 70vh; min-height: 24rem;';
    const body = document.createElement('div');
    body.className = 'p';
    body.append(code);
    Dialog.create(body, {
      title: 'Edit HTML',
      width: 'min(90rem, 96vw)',
      confirmText: 'Save',
      cancelText: 'Cancel',
      confirmAction: () => this.set('html', code.getValue(), false)
    });
  }

  render(){
    const value = this.node.attrs?.html ?? '';
    const lines = value.split('\n').length;
    return html`
      <div class="mb">
        <label class="d-b mbq">HTML<small class="d-b tc-muted">Shown on the page as it is written. Scripts and styles in it run on the published page, but not in this editor.</small></label>
        <p class="tc-muted">${value ? `${lines} ${lines === 1 ? 'line' : 'lines'}` : 'Nothing yet.'}</p>
        <button class="primary" @click="${() => this.openEditor()}"><k-icon name="edit"></k-icon> Edit HTML</button>
      </div>
    `;
  }
}

customElements.define('k-html-block-settings', HtmlBlockSettings);
