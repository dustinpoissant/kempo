import { html } from '/kempo-ui/lit-all.min.js';
import WidgetSettings from './WidgetSettings.js';

/*
  The Content slider's settings: its arrows and loop, and its slides listed with a button that adds one. A slide is one
  widget, so a new slide is a Group, which holds as many widgets as the slide needs.
*/
export default class ContentSliderSettings extends WidgetSettings {
  render(){
    return html`
      ${this.renderFields()}
      ${this.renderChildren('default', { label: 'Slides', hint: 'Each widget inside the slider is a slide. A new slide is a Group you can put other widgets in.', addType: 'group', addLabel: 'Add slide' })}
    `;
  }
}

customElements.define('k-content-slider-settings', ContentSliderSettings);
