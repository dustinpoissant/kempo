import DashboardWidget from '/kempo/components/DashboardWidget.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { getUsers, createUser } from '/kempo/sdk.js';

/*
  The number of accounts on the site.
*/
export default class UsersWidget extends DashboardWidget {
  static properties = {
    ...DashboardWidget.properties,
    total: { state: true }
  };

  constructor(){
    super();
    this.total = 0;
    this.cta = { label: 'Add user', icon: 'person_add', permission: 'system:user:create', onClick: () => this.addUser() };
  }

  /*
    Public Methods
  */

  load = async () => {
    this.total = (await this.unwrap(getUsers({ limit: 1 }))).total;
  };

  /*
    Event Handlers
  */

  addUser = () => this.openForm({
    title: 'Add user',
    confirmText: 'Create',
    fields: [
      { name: 'name', label: 'Name' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'password', label: 'Password', type: 'password' }
    ],
    submit: async ({ name, email, password }) => {
      const [error] = await createUser({ name, email, password, emailVerified: true });
      if(error) return error.msg || 'Could not create the user.';
      await this.refresh();
    }
  });

  /*
    Rendering
  */

  renderContent(){
    return html`
      <div class="h1 m0">${this.total}</div>
      <div class="tc-muted">${this.total === 1 ? 'User' : 'Users'}</div>
    `;
  }
}

customElements.define('k-widget-users', UsersWidget);
