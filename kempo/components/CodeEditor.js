import Component from './Component.js';
import hljs from 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/es/highlight.min.js';
import {
  escapeHTML
} from '../utils/string.js';

const keyDownHandler = Symbol(),
      lastValue = Symbol();
export default class CodeEditor extends Component {
  constructor(){
    super();

    /* Private Members */
    this[lastValue] = '';

    /* Private Methods */
    this[keyDownHandler] = (event) => {
      const { key } = event;
      if(key == 'Tab'){
        event.preventDefault();
        document.execCommand('insertText', false, '  ');
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        document.execCommand('undo', false, null);
      }
    }

    this.registerAttribute('language', '');
  }

  async connectedCallback(){
    super.connectedCallback();
    const $editor = this.shadowRoot.getElementById('editor');
    $editor.addEventListener('keydown', this[keyDownHandler]);
    this.addEventListener('blur', this.highlight);
    this.value = escapeHTML(this.textContent.trim());
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    this.shadowRoot.getElementById('editor').removeEventListener('keydown', this[keyDownHandler]);
  }

  highlight(){
    if(this.value !== this[lastValue]){
      this.dispatchEvent(new CustomEvent('change'));
    }
    let result;
    if(this.language){
      result = hljs.highlight(
        this.value,
        { language: this.language }
      )
    } else {
      result = hljs.highlightAuto(this.value);
    }
    this.shadowRoot.getElementById('editor').innerHTML = result.value.split('\n').map(p=>`<div class="line">${p}</div>`).join('');
    this[lastValue] = this.value;
  }

  get value(){
    return [...this.shadowRoot.getElementById('editor').querySelectorAll('.line')].map($line=>$line.textContent).join('\n');
  }
  set value(v){
    this.shadowRoot.getElementById('editor').innerHTML = v.split('\n').map(p=>`<div class="line">${p}</div>`).join('');
    this.highlight();
  }

  get shadowTemplate(){
    return /*html*/`
      <link rel="stylesheet" href="../kempo/kempo-hljs.css" />
      <pre id="editor" contenteditable="true"></pre>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :root {
        --d_caret: white;
        --l_caret: black;
        --caret: var(--l_caret);
      }
      @media (prefers-color-scheme: light) { 
        :root:not([theme="dark"]) {
          --caret: var(--l_caret);
        }
      }
      :root[theme="light"] {
        --caret: var(--l_caret);
      }
      @media (prefers-color-scheme: dark) {
        :root:not([theme="light"]) {
          --caret: var(--d_caret);
        }
      }
      :root[theme="dark"] {
        --caret: var(--d_caret);
      }
      :host {
        display: block;
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
        max-height: 20rem;
        overflow: auto;
        caret-color: var(--caret);
      }
      :host(:focus-within){
        box-shadow: var(--focus_shadow);
      }
      #editor {
        min-height: 6rem;
        outline: none;
        font-family: var(--ff_mono);
        resize: vertical;
        padding: var(--spacer);
        margin-bottom: 0;
        resize: vertical;
        counter-reset: line-number;
        white-space: pre-wrap;
        padding-left: 2.5rem;
        position: relative;
      }
      #editor .line::before {
        content: counter(line-number); /* Use the counter value as content */
        counter-increment: line-number; /* Increment the counter */
        display: inline-block;
        width: 2rem;
        text-align: right; /* Align numbers to the right */
        opacity: 0.65;
        position: absolute;
        left: 0;
        user-select: none;
      }
      .line {
        width: 100%;
        overflow-wrap: break-word;
        word-break: break-all;
      }
    `;
  }
}
window.customElements.define('k-code-editor', CodeEditor);