import Component from './Component.js';

export default class Import extends Component {
  constructor(){
    super();
    this.registerAttribute('src');
  }
  attributeChangedCallback(n, oV, nV){
    if(n === 'src' && oV !== nV){
      this.render(true);
    }
  }
  async render(force){
    const src = this.src;
    if(src && await super.render(force)){
      this.innerHTML = await (await fetch(src)).text();
      this.querySelectorAll('script').forEach( $badScript => {
        const $goodScript = document.createElement('script');
        if($badScript.getAttribute('type')) $goodScript.type = $badScript.getAttribute('type');
        if($badScript.getAttribute('src')) $goodScript.src = $badScript.getAttribute('src');
        if($badScript.textContent) $goodScript.textContent = $badScript.textContent;
        $badScript.parentElement.replaceChild($goodScript, $badScript);
      });
      
    }
  }

  get shadowStyles(){
    return /*css*/`
      :host {
        display: inline;
      }
    `;
  }

  static get renderOnAttributes(){
    retur ['src'];
  }
}
window.customElements.define('k-import', Import);