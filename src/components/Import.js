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
      // Get raw text and process replacements first
      let contents = await (await fetch(src)).text();
      for (const [name, value] of Object.entries(Import.replacements)) {
        contents = contents.replace(new RegExp(`%%${name}%%`, 'g'), value);
      }
      
      // Now parse into template
      const temp = document.createElement('template');
      temp.innerHTML = contents;
      
      // Extract and handle scripts
      const scripts = Array.from(temp.content.querySelectorAll('script[src]'));
      scripts.forEach(script => script.remove());
      
      // Set content
      this.innerHTML = temp.innerHTML;
      
      // Add scripts back
      for (const script of scripts) {
        const newScript = document.createElement('script');
        Array.from(script.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        console.log('Adding script with src:', newScript.src); // Debug
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
