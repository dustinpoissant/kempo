import Component from './Component.js';

export default class Import extends Component {
  constructor(src = ''){
    super();
    this.registerAttribute('src', src);
  }
  attributeChangedCallback(n, oV, nV){
    if(n === 'src' && oV !== nV){
      this.render(true);
    }
  }
  async render(force){
    const src = this.src;
    if(src && await super.render(force)){
      let contents = await (await fetch(src)).text();
      for (const [name, value] of Object.entries(Import.replacements)) {
        contents = contents.replace(new RegExp(`%%${name}%%`, 'g'), value);
      }
      this.innerHTML = contents;
      this.querySelectorAll('script').forEach( $badScript => {
        const $goodScript = document.createElement('script');
        if($badScript.getAttribute('type')) $goodScript.type = $badScript.getAttribute('type');
        if($badScript.getAttribute('src')) $goodScript.src = $badScript.getAttribute('src');
        if($badScript.textContent) $goodScript.textContent = $badScript.textContent;
        $badScript.parentElement.replaceChild($goodScript, $badScript);
      });
      return true;
    }
    return false;
  }

  get shadowStyles(){
    return /*css*/`
      :host {
        display: contents;
      }
    `;
  }

  /* Static Members */
  static replacements = {
    root: './' 
  };
  static addReplacement(name, value){
    this.replacements = {
      ...this.replacements,
      [name]: value,
    };
  }
  static observedAttributes = [...super.observedAttributes, 'src'];
}
window.customElements.define('k-import', Import);
