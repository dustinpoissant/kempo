import Component from './Component.js';
import debounce from '../utils/debounce.js';

const inputHandler = Symbol('inputHandler'),
      focusHandler = Symbol('focusHandler'),
      blurHandler = Symbol('blurHandler');

export default class Search extends Component {
  static searchDataUrl = '/search.json';

  constructor(){
    super();

    this[inputHandler] = debounce(() => {
      this.search(this.shadowRoot.getElementById('input').value);
    });
    this[focusHandler] = () => {
      this.opened = true;
    }
    this[blurHandler] = () => {
      setTimeout(()=>{
        this.opened = false;
      }, 100);
    }

    this.registerAttribute('opened', false);
    this.registerProp('pages', {});
  }
  async render(force){
    if(await super.render(force)){
      this.pages = await (await fetch(Search.searchDataUrl)).json();
      const $input = this.shadowRoot.getElementById('input')
      $input.addEventListener('input', this[inputHandler]);
      $input.addEventListener('focus', this[focusHandler]);
      $input.addEventListener('blur', this[blurHandler]);
      return true;
    }
    return false;
  }
  search(term){
    const $results = this.shadowRoot.getElementById('results');
    if(term === ''){
      $results.innerHTML =  '';
    } else {
      const t = term.trim().toLowerCase();
      Object.keys(this.pages).forEach( path => {
        const page  = this.pages[path];
        page.score = 0;
        if(page.name.toLowerCase().startsWith(t)){
          page.score += 5;
        } else if(page.name.toLowerCase().includes(t)){
          page.score += 3;
        }
        if(page.terms.includes(t)){
          page.score += 3;
        }
        page.terms.forEach( term => {
          if(term.startsWith(t)){
            page.score += 2;
          } else if(term.includes(t)){
            page.score += 1;
          }
        });
      });
      const results = Object.keys(this.pages)
        .map( path => {
          return {
            path: path,
            ...(this.pages[path])
          }
        })
        .filter(({score})=>score)
        .sort(({score: a}, {score: b})=>b-a)
        .slice(0, 4);
      if(results.length){
        $results.innerHTML = results.map(({
          path,
          name
        }) => `<a href="${path}">${name}</a>`).join('');
      } else {
        $results.innerHTML = `<a>No Results</a>`;
      }
    }
  }


  get shadowTemplate(){
    return /*html*/`
      <div id="wrapper">
        <input
          id="input"
          placeholder="Search"
          type="search"
        />
        <div id="results"></div>
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      :host {
        display: inline-block;
        align-self: center;
      }
      #wrapper {
        position: relative;
      }
      #input {
        width: 100%;
        margin: 0;
      }
      #results {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        max-height: 20rem;
        background-color: var(--c_bg);
        color: var(--tc);
        box-shadow: var(--drop_shadow);
      }
      :host([opened="true"]) #results {
        display: block;
      }
      #results a {
        display: block;
        padding: var(--spacer_h);
        text-decoration: none;
        border-bottom: 1px solid var(--c_border);
        border-radius: 0;
        color: var(--tc_primary);
      }
      #results a:last-child {
        border-bottom: 0;
      }
    `;
  }
}
window.customElements.define('k-search', Search);
