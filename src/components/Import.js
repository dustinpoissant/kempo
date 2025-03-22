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
      const temp = document.createElement('template');
      temp.innerHTML = contents;
      const scripts = Array.from(temp.content.querySelectorAll('script[src]'));
      scripts.forEach(script => script.remove());
      this.innerHTML = temp.innerHTML;
      for (const script of scripts) {
        const newScript = document.createElement('script');
        Array.from(script.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        await new Promise((resolve, reject) => {
          newScript.onload = resolve;
          newScript.onerror = reject;
          this.appendChild(newScript);
        });
      }
      return true;
    }
    return false;
  }
  get shadowStyles(){
    return /*css*/`:host{display:contents;}`;
  }
  static replacements = {root: './'};
  static addReplacement(name, value){
    this.replacements = {...this.replacements,[name]: value};
  }
  static observedAttributes = [...super.observedAttributes, 'src'];
}
window.customElements.define('k-import', Import);
