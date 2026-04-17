import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class ClearExpiredSessionsControl extends TableControl {
  render() {
    return html`
      <button class="no-btn icon-btn" title="Clear Expired Sessions">
        <k-icon name="timer_off"></k-icon>
      </button>
    `;
  }
}

customElements.define('admin-clear-expired-sessions', ClearExpiredSessionsControl);
