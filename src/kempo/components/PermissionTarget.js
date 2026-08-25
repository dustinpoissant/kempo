import LightComponent from '/kempo-ui/components/LightComponent.js';
import { currentUserHasPermission, currentUserHasAllPermissions, currentUserHasSomePermissions } from '../sdk.js';

/*
	Same permission check as k-permission, aimed at other elements instead of its own children.

	k-permission works by wrapping content and toggling its own display — which only works when
	wrapping is harmless. Some elements are load-bearing about their position in the DOM: kempo-ui's
	<k-tabs> finds its <k-tab>/<k-tab-content> children with a direct-child query, so introducing a
	wrapper between them breaks tab selection entirely, not just the permission check. This targets
	arbitrary elements elsewhere in the document by selector, so the gated elements can stay exactly
	where their own component expects them.

	Renders nothing itself and never appears in the layout — it is pure wiring, placed wherever is
	convenient (its target does not need to be a descendant, or even nearby).
*/
export default class PermissionTarget extends LightComponent {
	static properties = {
		has: { type: String },
		all: { type: String },
		some: { type: String },
		target: { type: String }
	};

	constructor() {
		super();
		this.has = '';
		this.all = '';
		this.some = '';
		this.target = '';
	}

	async connectedCallback() {
		super.connectedCallback();
		this.style.display = 'none';
		await this.applyPermission();
	}

	async applyPermission() {
		const attributeCount = [this.has, this.all, this.some].filter(Boolean).length;

		let hasPermission = false;
		if(attributeCount === 1) {
			try {
				if(this.has) {
					const [error, data] = await currentUserHasPermission({ permission: this.has });
					hasPermission = error ? false : data.hasPermission;
				} else if(this.all) {
					const permissions = this.all.split(',').map(p => p.trim());
					const [error, data] = await currentUserHasAllPermissions({ permissions });
					hasPermission = error ? false : data.hasPermission;
				} else {
					const permissions = this.some.split(',').map(p => p.trim());
					const [error, data] = await currentUserHasSomePermissions({ permissions });
					hasPermission = error ? false : data.hasPermission;
				}
			} catch(error) {
				hasPermission = false;
			}
		}

		this.setTargetsVisible(hasPermission);
	}

	setTargetsVisible(visible) {
		if(!this.target) return;
		for(const element of document.querySelectorAll(this.target)) {
			element.style.display = visible ? '' : 'none';
		}
	}
}

window.customElements.define('k-permission-target', PermissionTarget);
