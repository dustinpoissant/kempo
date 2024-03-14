import Component from '../kempo/components/Component.js';

const html = str => new DOMParser().parseFromString(str, 'text/html').body.childNodes[0];
const runClickHandler = Symbol('runClickHandler'),
      toggleLogsClickHandler = Symbol('toggleLogsClickHandler'),
      testUpdatedHandler = Symbol('testUpdatedHandler');

export default class TestSuite extends Component {
  constructor(){
    super();

    this[runClickHandler] = () => {
      this.runAll();
    }

    this.registerAttribute('name', '');
  }
  async render(force){
    if(await super.render(force)){
      await this.loadTests();
      this.shadowRoot.getElementById('runAll').addEventListener('click', this[runClickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    if(this.rendered){
      this.shadowRoot.getElementById('runAll').removeEventListener('click', this[runClickHandler]);
    }
    super.disconnectedCallback();
  }
  async loadTests(){
    const {
     name,
     description,
     tests 
    } = await import(`../tests/${this.name}.test.js`);
    const testSuiteLink = `/suite.html?name=${this.name}`;
    const currentPath = location.pathname + location.search;
    if(testSuiteLink === currentPath){
      this.shadowRoot.getElementById('name').innerHTML = name;
    } else {
      this.shadowRoot.getElementById('name').innerHTML = `<a href="${testSuiteLink}">${name}</a>`;
    }
    this.shadowRoot.getElementById('description').innerHTML = description;
    tests.forEach( ({name, description, test}) => {
      this.appendChild(new Test(name, description, test));
    });
  }
  async runAll(){
    const $tests = [...this.querySelectorAll('k-test')];
    for(const $test of $tests){
      await $test.run();
    }
  }
  get shadowTemplate(){
    return /*html*/`
      <h3 id="name"></h3>
      <p id="description"></p>
      <button
        id="runAll"
        class="secondary mb"
      >
        Run All Tests in this Suite
      </button>
      <slot name="test"></slot>
      ${super.shadowTemplate}
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
        padding: var(--spacer);
        margin-bottom: var(--spacer);
      }
    `;
  }
}
window.customElements.define('k-test-suite', TestSuite);


class Test extends Component {
  constructor(name, description, test){
    super();

    this[runClickHandler] = () => this.run();
    this[toggleLogsClickHandler] = () => {
      this.showLogs = !this.showLogs;
    }

    this.registerAttribute('status', 'Not Ran');
    this.registerAttribute('name', name);
    this.registerAttribute('description', description);
    this.registerAttribute('showLogs', false);
    this.registerProp('test', test);
    this.registerProp('logs', []);
  }
  async render(force){
    if(super.render(force)){
      this.shadowRoot.getElementById('name').innerHTML = this.name;
      this.shadowRoot.getElementById('description').innerHTML = this.description;
      this.shadowRoot.getElementById('run').addEventListener('click', this[runClickHandler]);
      this.shadowRoot.getElementById('toggleLogs').addEventListener('click', this[toggleLogsClickHandler]);
      return true;
    }
    return false;
  }
  connectedCallback(){
    super.connectedCallback();
    this.dispatchEvent(new CustomEvent('testadded', {
      bubbles: true,
      test: this 
    }));
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    this.shadowRoot.getElementById('run').removeEventListener('click', this[runClickHandler]);
    this.shadowRoot.getElementById('toggleLogs').removeEventListener('click', this[toggleLogsClickHandler]);
  }
  log(...args){
    let type = 'log',
        messages = [...args];
    if(['log', 'error', 'warning', 'success'].includes(args[0])){
      type = args[0];
      messages = [...args].slice(1);
    }
    this.logs.push({ type, messages });
    if(this.rendered){
      this.shadowRoot.getElementById('logs').appendChild(html(/*html*/`
        <div class="log log-${type}">${
          messages.map(message => /*html*/`<div class="log-message">${message}</div>`).join('')
        }</div>
      `));
    }
  }
  logError(...messages){
    this.log('error', messages);
  }
  logWarning(...messages){
    this.log('warning', messages);
  }
  logSuccess(...messages){
    this.log('success', messages);
  }
  renderLogs(){
    return this.logs.reverse().map( ({type, messages}) => /*html*/`
      <div class="log log-${type}">${
        messages.map(message => /*html*/`<div class="log-message">${message}</div>`).join('')
      }</div>
    `).join('');
  }
  async run(){
    if(this.status !== 'Not Ran') this.log('<br />-----<br /><br />');
    this.log('Starting Test');
    const pass = (...messages) => {
      const msg = messages.length?messages.join('<br />'):'No message';
      this.log(`<div class='log-success'>Passed: ${msg}</div>`);
      this.status = 'Passed';
      this.shadowRoot.getElementById('status').innerText = this.status;
      this.dispatchEvent(new CustomEvent('testrun', {
        detail: {
          test: this,
          status: this.status,
          passed: true
        },
        bubbles: true
      }));
    }
    const fail = (...messages) => {
      const msg = messages.length?messages.join('<br />'):'No Message';
      this.log(`<div class='log-error'>Failed: ${msg}</div>`);
      this.status = 'Failed';
      this.shadowRoot.getElementById('status').innerText = this.status;
      this.dispatchEvent(new CustomEvent('testrun', {
        detail: {
          test: this,
          status: this.status,
          passed: false
        },
        bubbles: true
      }));
    }
    await this.test({
      pass,
      fail,
      log: this.log.bind(this),
      logError: this.logError.bind(this),
      logWarning: this.logWarning.bind(this),
      logSuccess: this.logSuccess.bind(this)
    });
  }

  get shadowTemplate(){
    return /*html*/`
      ${super.shadowTemplate}
      <h5>
        <span id="name"></span>
        <small>(
          <span id="status">
            ${this.status}
          </span>
        )</small>
      </h5>
      <p id="description"></p>
      <button
        id="run"
        class="d-b mb"
      >Run Test</button>
      <button
        id="toggleLogs"
        class="link"
      >
        <span class="show-logs-true">Hide</span>
        <span class="show-logs-false">Show</span>
        Logs
      </button>
      <pre class="show-logs-true"><code id="logs"></code></pre>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
        margin-bottom: var(--spacer);
        padding: var(--spacer);
      }
      :host(:not([show-logs="true"])) .show-logs-true,
      :host([show-logs="true"]) .show-logs-false {
        display: none;
      }
      #logs {
        min-height: 6rem;
        max-height: 36rem;
        resize: vertical;
      }
      :host([status="Passed"]) h5,
      .log-success {
        color: var(--tc_success);
      }
      :host([status="Failed"]) h5,
      .log-error {
        color: var(--tc_danger);
      }
      .log-warning {
        color: var(--tc_warning);
      }
      .log-error .log-message::before {
        content: 'Error: ';
      }
      .log-warning .log-message::before {
        content: 'Warning: ';
      }
    `;
  }
}
window.customElements.define('k-test', Test);

class TestSummary extends Component {
  constructor(){
    super();

    this[testUpdatedHandler] = () => {
      this.update();
    }
    this[runClickHandler] = () => {
      this.runAll();
    }

    this.registerAttributes({
      passed: 0,
      failed: 0,
      notRan: 0
    });
  }
  connectedCallback(){
    super.connectedCallback();
    this.update();
    window.addEventListener('testadded', this[testUpdatedHandler]);
    window.addEventListener('testrun', this[testUpdatedHandler]);
  }
  disconnectedCallback(){
    window.removeEventListener('testadded', this[testUpdatedHandler]);
    window.removeEventListener('testrun', this[testUpdatedHandler]);
    if(this.rendered){
      this.shadowRoot.getElementById('runAll').removeEventListener('click', this[runClickHandler]);
    }
    super.disconnectedCallback();
  }
  async render(force){
    if(super.render(force)){
      this.shadowRoot.getElementById('runAll').addEventListener('click', this[runClickHandler]);
      return true;
    }
    return false;
  }
  update(){
    let notRan = 0,
        failed = 0,
        passed = 0;
    const $tests = [...document.querySelectorAll('k-test')];
    $tests.forEach( $test => {
      if($test.status === 'Passed'){
        passed++;
      } else if($test.status === 'Failed'){
        failed++;
      } else {
        notRan++;
      }
    });
    this.passed = passed;
    this.failed = failed;
    this.notRan = notRan;
    if(this.rendered){
      this.shadowRoot.getElementById('notRan').innerText = this.notRan;
      this.shadowRoot.getElementById('passed').innerText = this.passed;
      this.shadowRoot.getElementById('failed').innerText = this.failed;
    }
  }
  async runAll(){
    const $tests = [...document.querySelectorAll('k-test')];
    for(const $test of $tests){
      await $test.run();
    }
  }
  get shadowTemplate(){
    return /*html*/`
      <h3>Test Summary</h3>
      <button
        id="runAll"
        class="primary mb"
      >Run All Tests</button>
      <p>Not Ran: <span id="notRan"></span></p>
      <p>Passed: <span id="passed"></span></p>
      <p>Failed: <span id="failed"></span></p>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
        padding: var(--spacer) var(--spacer) 0;
        margin-bottom: var(--spacer);
      }
    `;
  }
}
window.customElements.define('k-test-summary', TestSummary);