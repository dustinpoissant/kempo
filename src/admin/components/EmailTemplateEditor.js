import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Spinner.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/CodeEditor.js';
import Toast from '/kempo-ui/components/Toast.js';
import { previewEmailTemplate } from '/admin/components/emailPreview.js';
import { getEmailTemplate, saveEmailTemplate, resetEmailTemplate, listEmailStylesheets, setEmailTemplateStylesheet } from '/kempo/sdk.js';

/*
  One email template's page: its variables, the stylesheet it is drawn with, and its body in a code editor. The frontmatter that
  declares the variables is kept out of sight and put back when the body is saved.

    <script type="module" src="/admin/components/EmailTemplateEditor.js"></script>
    <k-email-template-editor></k-email-template-editor>

  The template is named by `?template=` in the address (`verify-email`, `kempo-forms/submission-notification`).
*/
export default class EmailTemplateEditor extends ShadowComponent {
  static properties = {
    template: { state: true },
    error: { state: true },
    saving: { state: true },
    stylesheets: { state: true },
  };

  constructor(){
    super();
    this.template = null;
    this.error = '';
    this.saving = false;
    this.stylesheets = [];
  }

  connectedCallback(){
    super.connectedCallback();
    this.load();
  }

  load = async () => {
    const name = new URLSearchParams(location.search).get('template') ?? '';
    const [[error, found], [, styles]] = await Promise.all([getEmailTemplate(name), listEmailStylesheets()]);
    if(error){
      this.error = error.msg;
      return;
    }
    this.stylesheets = styles?.stylesheets ?? [];
    this.template = found;
    document.title = `${found.title || found.template} - Admin`;
  };

  chooseStyle = async event => {
    const select = event.target;
    const [error] = await setEmailTemplateStylesheet({ template: this.template.template, stylesheet: select.value });
    if(error){
      Toast.error(error.msg);
      await this.load();
      return;
    }
    Toast.success('Email style chosen');
    this.template = { ...this.template, stylesheet: select.value };
  };

  save = async () => {
    this.saving = true;
    const [error] = await saveEmailTemplate({ template: this.template.template, source: this.renderRoot.querySelector('#emailEditor').value });
    this.saving = false;
    if(error){
      Toast.error(error.msg);
      return;
    }
    Toast.success('Email template saved');
    await this.load();
  };

  reset = async () => {
    this.saving = true;
    const [error] = await resetEmailTemplate(this.template.template);
    this.saving = false;
    if(error){
      Toast.error(error.msg);
      return;
    }
    Toast.success('Email template reset to the default');
    await this.load();
  };

  renderVariables(){
    const variables = this.template.variables ?? [];
    if(!variables.length) return html`<p class="tc-muted mb">This email declares no variables.</p>`;
    return html`
      <table class="mb">
        <tr><th>Variable</th><th>What it holds</th></tr>
        ${variables.map(variable => html`<tr><td><code>{{${variable.name}}}</code></td><td>${variable.description}</td></tr>`)}
      </table>
    `;
  }

  render(){
    if(this.error) return html`<p class="tc-danger" role="alert">${this.error}</p>`;
    if(!this.template) return html`<k-spinner></k-spinner>`;
    const template = this.template;
    return html`
      <p class="mb"><a href="/admin/emails#templates">Back to the templates</a></p>
      <h1 class="mb0">${template.title || template.template}</h1>
      <p class="tc-muted mb"><code>${template.template}</code>${template.owner ? html` · from ${template.owner}` : nothing}${template.overridden ? html` · customized` : nothing}</p>

      <label class="d-b mbq" for="styleSelect">Style<small class="d-b tc-muted">The stylesheet this email is drawn with. It is saved when you change it.</small></label>
      <select id="styleSelect" class="mb" ?disabled=${this.saving} @change=${this.chooseStyle}>
        ${this.stylesheets.map(sheet => html`<option value=${sheet.name} ?selected=${sheet.name === template.stylesheet}>${sheet.name}${sheet.description ? ` – ${sheet.description}` : ''}</option>`)}
      </select>

      <h3>Variables</h3>
      <p class="tc-muted">Put a variable in the email as <code>{{name}}</code>. Show a part only when a variable has a value with <code>&lt;if condition="name"&gt;…&lt;/if&gt;</code>.</p>
      ${this.renderVariables()}

      <h3>Email</h3>
      <k-code-editor id="emailEditor" class="r b mb" language="html" .value=${template.source} style="height: 55vh; min-height: 300px;"></k-code-editor>
      <p class="d-f mb" style="gap: var(--spacer_h); flex-wrap: wrap;">
        <button class="primary" ?disabled=${this.saving} @click=${this.save}>${this.saving ? 'Saving…' : 'Save'}</button>
        <button type="button" @click=${() => previewEmailTemplate(template.template, template.title)}><k-icon name="visibility"></k-icon> Preview</button>
        ${template.overridden ? html`<button class="danger" ?disabled=${this.saving} @click=${this.reset}>Reset to default</button>` : nothing}
      </p>
    `;
  }
}

customElements.define('k-email-template-editor', EmailTemplateEditor);
