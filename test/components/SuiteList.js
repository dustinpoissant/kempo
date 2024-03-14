import Component from '../kempo/components/Component.js';
import Card from '../kempo/components/Card.js';

export default class SuiteList extends Component {
  async render(force){
    if(await super.render(force)){
      this.innerHTML = '';
      const tests = await (await fetch('/api/tests')).json();
      Object.keys(tests).forEach( category => {
        const $category = new Card(category[0].toUpperCase() + category.slice(1));
        $category.className = 'my';
        tests[category].forEach( suite => {
          const $link = document.createElement('a');
          $link.href = `/suite.html?name=${category}/${suite}`;
          $link.innerHTML = suite;
          $link.className = 'd-b pq';
          $category.appendChild($link);
        });
        this.appendChild($category);
      });
      return true;
    }
    return false;
  }
}
window.customElements.define('k-suite-list', SuiteList);
