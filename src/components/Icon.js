import Component from './Component.js';

const cache = {};

const getIconByPath = async (path) => {
  if(!cache[path]){
    cache[path] = new Promise(async (resolve, reject)=>{
      try {
        const response = await fetch(path);
        if(response.status === 200) resolve(await (response).text());
      } catch(e){ }
      return reject();
    });
  } 
  return await cache[path];
}
const getIconByName = (name) => {
  const tryDir = async (dir) => getIconByPath(`${dir}/${name}.svg`);

  return new Promise( async (resolve, reject) => {
    let svg;
    for(let i=0; i < Icon.pathToIcons.length && !svg; i++){
      svg = await tryDir(Icon.pathToIcons[i]);
    }
    if(svg){
      resolve(svg);
    } else {
      reject('Icon not found');
    }
  });
}

export default class Icon extends Component {
  constructor(name = ''){
    super();
    this.registerAttributes({
      src: '',
      name: name
    });
  }
  connectedCallback(){
    // super.connectedCallback();
    // do not call super.connectedCallback because it will attempt to render and then again on attribute change
    // so we are overwriting the parent method and not calling it
  }
  async render(force){
    if(await super.render(force)){
      if(this.src){
        const svg = await getIconByPath(this.src);
        if(svg){
          this.innerHTML = svg;
          this.fixSVG();
        } else if(!this.innerHTML.length) this.innerHTML = Icon.fallback;
      } else if(this.name){
        const svg = await getIconByName(this.name);
        if(svg){
          this.innerHTML = svg;
          this.fixSVG();
        } else if(!this.innerHTML.length) this.innerHTML = Icon.fallback;
      } else {
        this.rendered = false;
        if(!this.innerHTML.length) this.innerHTML = Icon.fallback;
      }
      return true;
    }
    return false;
  }
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(['src', 'name'].includes(n) && nV){
      this.render(true);
    }
  }
  fixSVG(){
    const $svg = this.querySelector('svg');
    $svg.removeAttribute('width');
    $svg.removeAttribute('height');
    $svg.querySelectorAll('path, rect, circle').forEach( $path => {
      $path.setAttribute('fill', 'currentColor');
    });
  }
  get shadowStyles(){
    return /*css*/`
      :host {
        display: inline-block;
        vertical-align: bottom;
      }
      ::slotted(svg){
        height: 1.35em;
        vertical-align: middle;
      }
    `;
  }

  static observedAttributes = [
    'name',
    'src'
  ];

  static pathToIcons = [
    '/icons'
  ];
  static fallback = /*html*/`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path fill="currnetColor" d="M480-79q-16 0-30.5-6T423-102L102-423q-11-12-17-26.5T79-480q0-16 6-31t17-26l321-321q12-12 26.5-17.5T480-881q16 0 31 5.5t26 17.5l321 321q12 11 17.5 26t5.5 31q0 16-5.5 30.5T858-423L537-102q-11 11-26 17t-31 6Zm0-80 321-321-321-321-321 321 321 321Zm-40-281h80v-240h-80v240Zm40 120q17 0 28.5-11.5T520-360q0-17-11.5-28.5T480-400q-17 0-28.5 11.5T440-360q0 17 11.5 28.5T480-320Zm0-160Z"/></svg>
  `;
}
window.customElements.define('k-icon', Icon);
