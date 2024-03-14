import LazyComponent from './LazyComponent.js';

export default class FocusCapture extends LazyComponent {
  constructor(){
    super({
      delegatesFocus: true
    }); 
  }
  render(){
    super.render();
    this.shadowRoot.getElementById('after').addEventListener('focus', () => {
      this.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').focus();
    });
  }
  
  get shadowTemplate(){
    return /*html*/`
      ${super.shadowTemplate}
      <div id="after" tabindex="0"></div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      :host {
        display: inline-block;
      }
    `;
  }
}
window.customElements.define('k-focus-capture', FocusCapture);
