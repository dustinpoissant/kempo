import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import humanize from './humanize.js';

/*
  The base of the editors, one per setting type (StringSetting, NumberSetting, BooleanSetting, JsonSetting, SecretSetting). It draws
  the readable name, the description as a hint under it, and the problem if the value cannot be saved, and leaves the control itself
  to `renderControl()`.

    <k-setting-string name="site_name" description="The name of the website" .value=${'My Site'}></k-setting-string>

  A change is announced as a bubbling `setting-change` event with `{ name, value, valid }`; `value` is already the right type (a number
  is a Number, JSON is parsed). Use <k-setting> to get the editor for a type without choosing one.
*/
export default class SettingEditor extends ShadowComponent {
  static properties = {
    name: { type: String },
    label: { type: String },
    description: { type: String },
    value: { attribute: false },
    disabled: { type: Boolean },
    problem: { state: true },
  };

  constructor(){
    super();
    this.name = '';
    this.label = '';
    this.description = '';
    this.value = '';
    this.disabled = false;
    this.problem = '';
  }

  /*
    Public
  */
  get heading(){
    return this.label || humanize(this.name);
  }

  /* Tell whoever is listening what the value is now. A `problem` sentence means it cannot be saved yet. */
  announce = (value, problem = '') => {
    this.problem = problem;
    this.dispatchEvent(new CustomEvent('setting-change', { detail: { name: this.name, value, valid: !problem }, bubbles: true, composed: true }));
  };

  /*
    Rendering
  */
  renderControl(){
    return nothing;
  }

  renderHint(){
    return this.description ? html`<small class="tc-muted d-b">${this.description}</small>` : nothing;
  }

  renderProblem(){
    return this.problem ? html`<small class="tc-danger d-b" role="alert">${this.problem}</small>` : nothing;
  }

  render(){
    return html`<label class="mb d-b">${this.heading}${this.renderHint()}${this.renderControl()}</label>${this.renderProblem()}`;
  }
}
