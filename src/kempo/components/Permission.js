import { LitElement, html, css } from '/kempo-ui/lit-all.min.js';
import { getSession, currentUserHasPermission, currentUserHasAllPermissions, currentUserHasSomePermissions } from '../sdk.js';

/*
  A wrapper only: it draws no box of its own (`display: contents`), so what is inside lines up as if it were not there.
  What is inside is slotted, so it is shown only to people who have the permission.

  `logged-in` shows it to anyone who is signed in, and can be combined with one of `has`, `all` or `some`. Nothing is
  shown until the answer is known. This only hides content in the browser: the page's own frontmatter (`require-login`,
  `require-permissions`) is what keeps a page, or the data behind it, from someone who should not have it.
*/
export default class Permission extends LitElement {
	static styles = css`:host{display:contents}`;

	static properties = {
		has: { type: String },
		all: { type: String },
		some: { type: String },
		loggedIn: { type: Boolean, attribute: 'logged-in' },
		loading: { type: Boolean, state: true },
		hasPermission: { type: Boolean, state: true }
	};

	constructor() {
		super();
		this.has = '';
		this.all = '';
		this.some = '';
		this.loggedIn = false;
		this.loading = true;
		this.hasPermission = false;
	}

	async connectedCallback() {
		super.connectedCallback();
		await this.checkPermissions();
	}

	async checkPermissions() {
		const attributeCount = [this.has, this.all, this.some].filter(Boolean).length;

		if(attributeCount > 1) {
			this.hasPermission = false;
			this.loading = false;
			return;
		}

		try {
			if(this.loggedIn) {
				const [sessionError, session] = await getSession();
				if(sessionError || !session?.user) {
					this.hasPermission = false;
					return;
				}
			}

			if(attributeCount === 0) {
				this.hasPermission = true;
			} else if(this.has) {
				const [error, data] = await currentUserHasPermission({ permission: this.has });
				this.hasPermission = error ? false : data.hasPermission;
			} else if(this.all) {
				const permissions = this.all.split(',').map(p => p.trim());
				const [error, data] = await currentUserHasAllPermissions({ permissions });
				this.hasPermission = error ? false : data.hasPermission;
			} else {
				const permissions = this.some.split(',').map(p => p.trim());
				const [error, data] = await currentUserHasSomePermissions({ permissions });
				this.hasPermission = error ? false : data.hasPermission;
			}
		} catch(error) {
			this.hasPermission = false;
		} finally {
			this.loading = false;
		}
	}

	render() {
		if(this.loading || !this.hasPermission) return html``;
		return html`<slot></slot>`;
	}
}

window.customElements.define('k-permission', Permission);
