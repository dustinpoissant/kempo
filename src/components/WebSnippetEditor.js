import Component from './Component.js';
import {
  escapeHTML,
  unescapeHTML
} from '../utils/string.js';
import './Split.js';
import './Tabs.js';
import './CodeEditor.js';

const changeHandler = Symbol();
export default class WebSnippetEditor extends Component {
  constructor(){
    super();

    this[changeHandler] = () => {
      this.renderResults();
    }

    this.registerAttributes({
      useKempo: false,
      showHtml: true,
      showCss: true,
      showJs: true,
      scripts: ''
    });
  }

  async render(){
    await super.render();

    const $htmlCode = this.querySelector('pre[for="html"]');
    const $htmlEditor = this.shadowRoot.getElementById('html');
    $htmlEditor.addEventListener('change', this[changeHandler]);
    if($htmlCode){
      $htmlEditor.value = escapeHTML($htmlCode.textContent);
    } else {
      $htmlEditor.value = escapeHTML(`<div>\n  \n</div>`);
    }

    const $cssCode = this.querySelector('pre[for="css"]');
    const $cssEditor = this.shadowRoot.getElementById('css');
    $cssEditor.addEventListener('change', this[changeHandler]);
    if($cssCode){
      $cssEditor.value = $cssCode.textContent;
    } else {
      $cssEditor.value = `div {\n  \n}`;
    }

    const $jsCode = this.querySelector('pre[for="js"]');
    const $jsEditor = this.shadowRoot.getElementById('js');
    $jsEditor.addEventListener('change', this[changeHandler]);
    if($jsCode){
      $jsEditor.value = $jsCode.textContent;
    } else {
      $jsEditor.value = '';
    }
    this.renderResults();
  }

  renderResults(){
    const html = this.shadowRoot.getElementById('html').value;
    const css = this.shadowRoot.getElementById('css').value;
    const js = this.shadowRoot.getElementById('js').value;

    const $results = this.shadowRoot.getElementById('results');
    $results.innerHTML = '';
    const $iframe = document.createElement('iframe');
    $iframe.frameBorder = "0";
    $results.appendChild($iframe);
    const iframeDoc = $iframe.contentDocument || $iframe.contentWindow.document;
    iframeDoc.body.innerHTML = `
      ${this.useKempo?`<link rel="stylesheet" href="../kempo/kempo-vars.css" /><link rel="stylesheet" href="../kempo/kempo-styles.css" />`:''}
      <style>
        body, html {
          background-color: transparent;
        }
        body {
          overflow-y: auto;
          padding: var(--spacer_q, 4px);
        }
        ${css}
      </style>
      ${html}
    `;
    if(this.useKempo && this.scripts){
      this.scripts.split(',').forEach( script => {
        const $script = document.createElement('script');
        $script.type = 'module';
        $script.src = script;
        iframeDoc.head.appendChild($script);
      });
    }
    const $script = document.createElement('script');
    $script.textContent = js;
    iframeDoc.head.appendChild($script);
  }

  get shadowTemplate(){
    return /*html*/`
      <k-split id="split">
        <k-tabs class="ml">
          ${this.showHtml?`<k-tab for="html">HTML</k-tab>`:''}
          ${this.showCss?`<k-tab for="css">CSS</k-tab>`:''}
          ${this.showJs?`<k-tab for="js">JS</k-tab>`:''}
          <k-tab-content name="html">
            <k-code-editor
              id="html"
              language="xml"
              class="my"
            ></k-code-editor>
          </k-tab-content>
          <k-tab-content name="css">
            <k-code-editor
              id="css"
              language="css"
              class="my"
            ></k-code-editor>
          </k-tab-content>
          <k-tab-content name="js">
            <k-code-editor
              id="js"
              language="js"
              class="my"
            ></k-code-editor>
          </k-tab-content>
        </k-tabs>
        <div
          id="results"
          slot="right"
        ></div>
      </k-split>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      :host {
        --min-height: auto;
        --height: auto;
        --max-height: auto;
        display: block;
      }
      k-tab-content {
        min-height: var(--min-height);
        height: var(--height);
        max-height: var(--max-height);
      }
      k-code-editor {
        max-height: calc(100% - (2 * var(--spacer)));
      }
      #results,
      iframe {
        width: 100%;
        height: 100%;
        background-color: transparent;
      }
    `;
  }
}
window.customElements.define('k-web-snippet-editor', WebSnippetEditor);
