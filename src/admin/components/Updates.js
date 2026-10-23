import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Spinner.js';
import '/kempo-ui/components/Dialog.js';
import '/kempo-ui/components/Icon.js';
import Toast from '/kempo-ui/components/Toast.js';
import { getUpdateStatus, checkForUpdate, prepareUpdate, applyUpdate, rollbackUpdate, discardUpdate } from '/kempo/sdk.js';

/*
  The update screen, served at /admin/components/Updates.js:

    <k-admin-updates></k-admin-updates>

  Lists what is newer on npm than what the site runs: Kempo itself and each installed extension, which the server looks up
  every 12 hours (and when "Check now" is pressed). Each has a box; what is ticked is updated together.

  A site that runs from a Docker volume updates in two steps. "Get ready" downloads the new versions next to the running site,
  which keeps working, and shows what switching to them would change: starter files that will update, files you edited that
  stay, files that must be replaced anyway, what each extension adds, and any change to your data. "Switch" asks for your word
  where that is needed, then the server restarts on the new versions. A version that does not work puts the old ones back by
  itself, and "Go back" does it by hand. Any other site installs the update in place and restarts.

  While the server is gone this screen asks it, every couple of seconds, whether it is back, then reloads the page and says how
  it went. A server that does not come back in ten minutes is reported rather than waited on forever.
*/
const POLL_MS = 2000;
const GIVE_UP_MS = 10 * 60 * 1000;
const AFTER_RELOAD_KEY = 'kempo-after-update';

const when = value => (value ? new Date(value).toLocaleString() : 'never');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const older = (a, b) => a.split('.').map(Number).reduce((result, part, index) => result || (part - Number(b.split('.')[index])), 0) < 0;

export default class Updates extends ShadowComponent {
  static properties = {
    status: { state: true },
    error: { state: true },
    checking: { state: true },
    phase: { state: true },
    stalled: { state: true },
    action: { state: true },
    chosen: { state: true },
  };

  constructor(){
    super();
    this.status = null;
    this.error = '';
    this.checking = false;
    this.phase = 'idle';
    this.stalled = false;
    this.action = 'update';
    this.chosen = null;
  }

  /*
    Lifecycle
  */
  connectedCallback(){
    super.connectedCallback();
    this.load();
  }

  /*
    Loading
  */
  load = async () => {
    const [error, status] = await getUpdateStatus();
    if(error){
      this.error = error.msg || 'The update status could not be loaded';
      return;
    }
    this.error = '';
    this.status = status;
    this.selectNew(status);
    this.reportOutcome();
  };

  /* Everything that can be updated, as { key, name, from, to, major, needs }: Kempo first, then the extensions. */
  updatable = status => [
    ...(status.updateAvailable ? [{ key: 'kempo', name: 'Kempo', from: status.runningVersion, to: status.latestVersion, major: status.major }] : []),
    ...(status.extensionUpdates?.updates ?? []).map(update => ({ key: update.name, name: update.name, from: update.installedVersion, to: update.latestVersion, major: update.major, needs: update.kempoRequired })),
  ];

  /* Everything that has just become available is ticked, once; what the person unticks stays unticked. */
  selectNew = status => {
    this.seen ??= new Set();
    const chosen = new Set(this.chosen ?? []);
    for(const { key } of this.updatable(status)){
      if(!this.seen.has(key)){
        this.seen.add(key);
        chosen.add(key);
      }
    }
    this.chosen = chosen;
  };

  /* An extension that needs a newer Kempo than the one running can only be chosen together with the Kempo update that provides it. */
  blocked = (item, status) => Boolean(item.needs) && older(status.runningVersion, item.needs) && !(this.chosen.has('kempo') && status.updateAvailable && !older(status.latestVersion, item.needs));

  chosenItems = () => this.updatable(this.status).filter(item => this.chosen.has(item.key) && !this.blocked(item, this.status));

  toggle = key => {
    const next = new Set(this.chosen);
    if(next.has(key)) next.delete(key);
    else next.add(key);
    this.chosen = next;
  };

  /* After the page reloads from an update: say whether the version that was asked for is the one now running. */
  reportOutcome = () => {
    try {
      const expected = JSON.parse(sessionStorage.getItem(AFTER_RELOAD_KEY) || 'null');
      if(!expected) return;
      sessionStorage.removeItem(AFTER_RELOAD_KEY);
      const failed = this.status.lastUpdate && !this.status.lastUpdate.ok && this.status.lastUpdate.at > expected.at;
      if(failed) Toast.error(`The update did not work, so the site went back to how it was`);
      else Toast.success(expected.message);
    } catch {
      /* storage can be blocked; the page has still reloaded */
    }
  };

  check = async () => {
    this.checking = true;
    const [error, status] = await checkForUpdate();
    this.checking = false;
    if(error){
      Toast.error(error.msg);
      return;
    }
    this.status = status;
    this.selectNew(status);
    const problem = status.checkError || status.extensionUpdates?.checkError;
    if(problem) Toast.error(problem);
    else if(!this.updatable(status).length && !status.staged) Toast.success('Everything is up to date');
  };

  /*
    Getting an update ready (Docker volume sites), or throwing it away
  */
  selection = () => {
    const items = this.chosenItems();
    return { version: items.some(item => item.key === 'kempo') ? this.status.latestVersion : null, extensions: items.filter(item => item.key !== 'kempo').map(item => item.key) };
  };

  prepare = async () => {
    this.phase = 'preparing';
    const [error] = await prepareUpdate(this.selection());
    this.phase = 'idle';
    if(error){
      Toast.error(error.msg);
      return;
    }
    await this.load();
  };

  discard = async () => {
    const [error] = await discardUpdate();
    if(error){
      Toast.error(error.msg);
      return;
    }
    await this.load();
  };

  /*
    Switching, updating in place and going back
  */
  openConfirm = action => {
    this.action = action;
    this.renderRoot.querySelector('#confirmDialog').open();
  };

  confirmed = async () => {
    const { staged, bootId, mode, lastUpdate } = this.status;
    this.stalled = false;
    let error;
    let result;
    let message;

    if(this.action === 'back'){
      this.phase = 'going-back';
      [error, result] = await rollbackUpdate({ data: Boolean(lastUpdate?.breaking) });
      message = 'The site is back on what it ran before the last update';
    } else if(mode === 'release'){
      this.phase = 'switching';
      [error, result] = await applyUpdate({ confirm: { forced: staged.plan.files.forced.length > 0, breaking: staged.plan.breaking } });
      message = `Updated: ${staged.packages.join(', ')}`;
    } else {
      this.phase = 'installing';
      const { version, extensions } = this.selection();
      [error, result] = await applyUpdate({ version, extensions });
      message = `Updated: ${this.chosenItems().map(item => `${item.name} ${item.to}`).join(', ')}`;
    }

    if(error){
      this.phase = 'idle';
      Toast.error(error.msg);
      return;
    }
    this.phase = 'restarting';
    if(await this.waitForServer(bootId)){
      try {
        sessionStorage.setItem(AFTER_RELOAD_KEY, JSON.stringify({ message, at: new Date(Date.now() - 5000).toISOString(), to: result.to }));
      } catch {
        /* the reload still shows what is running */
      }
      window.location.reload();
      return;
    }
    this.stalled = true;
  };

  /*
    True once a server that is not the one asked about answers. The old one may still answer for a moment after
    the request that restarts it, so a reply only counts if it carries a different boot id, or if the server
    has been seen gone first (any reply short of a server error then comes from the new one, even a sign-in
    redirect that has no boot id).
  */
  waitForServer = async oldBootId => {
    const started = Date.now();
    let wasDown = false;
    while(Date.now() - started < GIVE_UP_MS){
      await sleep(POLL_MS);
      try {
        const res = await fetch('/kempo/api/updates?offline=true', { credentials: 'same-origin', cache: 'no-store' });
        if(res.ok){
          if((await res.json()).bootId !== oldBootId) return true;
        } else if(res.status >= 500){
          wasDown = true;
        } else if(wasDown){
          return true;
        }
      } catch {
        wasDown = true;
      }
    }
    return false;
  };

  /*
    Rendering
  */
  renderBusy(){
    const [title, note] = {
      preparing: ['Downloading the updates…', 'Your site keeps working while this happens. It can take a few minutes.'],
      installing: ['Installing the updates…', 'This can take a minute.'],
      switching: ['Switching to the updates…', 'This can take a minute.'],
      'going-back': ['Going back…', 'This can take a minute.'],
      restarting: ['Restarting the server…', 'This page reloads by itself when the site is back, and updated extensions are brought up to date first.'],
    }[this.phase];
    return html`
      <div class="b r p mb" role="status">
        <p class="d-f mb"><k-spinner class="mr"></k-spinner><strong>${title}</strong></p>
        <p class="tc-muted">${note} Please keep this page open.</p>
      </div>
    `;
  }

  renderStalled(){
    return html`
      <div class="b r p mb" role="alert">
        <p class="tc-danger mb"><strong>The server did not come back within ten minutes.</strong></p>
        <p class="mb">Check that the server process is running; if it is managed by pm2, systemd or Docker, check that it restarts when it exits.</p>
        <button class="primary" @click=${() => window.location.reload()}>Reload this page</button>
      </div>
    `;
  }

  renderRestartNote(status){
    return status.restart === 'respawn'
      ? html`The site is unavailable for a few seconds while the server restarts.`
      : html`The server restarts, which takes a few seconds, and the site is unavailable until it is back.`;
  }

  /* What switching to the prepared versions would change. */
  renderPlan(plan){
    const { update, add, edited, forced } = plan.files;
    const breakingUpgrades = plan.upgrades.filter(upgrade => upgrade.breaking);
    const breakingExtensions = plan.extensions.filter(extension => extension.breaking);
    const noChanges = !update.length && !add.length && !edited.length && !forced.length && !plan.upgrades.length && !plan.extensions.length;
    const labels = { permissions: ['permission', 'permissions'], settings: ['setting', 'settings'], groups: ['group', 'groups'], widgets: ['dashboard widget', 'dashboard widgets'], jobs: ['scheduled job', 'scheduled jobs'] };
    const adds = extension => Object.entries(extension.adds).filter(([, n]) => n).map(([what, n]) => count(n, ...labels[what])).join(', ');
    return html`
      <ul class="mb">
        ${noChanges ? html`<li>Nothing changes except the code.</li>` : nothing}
        ${plan.extensions.map(extension => html`<li>${extension.name} ${extension.from} <k-icon name="arrow" direction="right"></k-icon> ${extension.to}${adds(extension) ? html` <span class="tc-muted">adds ${adds(extension)}</span>` : nothing}</li>`)}
        ${update.length ? html`<li>${count(update.length, 'starter file', 'starter files')} you have not edited will be updated.</li>` : nothing}
        ${add.length ? html`<li>${count(add.length, 'new file', 'new files')} will be added.</li>` : nothing}
        ${edited.length ? html`<li>${count(edited.length, 'file', 'files')} you have edited will stay as you made ${edited.length === 1 ? 'it' : 'them'}, even though Kempo has a newer version: <span class="tc-muted">${edited.join(', ')}</span></li>` : nothing}
        ${forced.length ? html`<li class="tc-warning"><k-icon name="warning"></k-icon> ${count(forced.length, 'file', 'files')} you have edited must be replaced for security reasons. Your version is saved first: <span class="tc-muted">${forced.join(', ')}</span></li>` : nothing}
        ${breakingUpgrades.length ? html`<li class="tc-warning"><k-icon name="warning"></k-icon> Kempo changes your data${breakingUpgrades.some(upgrade => upgrade.description) ? html` (${breakingUpgrades.map(upgrade => upgrade.description).filter(Boolean).join('; ')})` : nothing}.</li>` : nothing}
        ${breakingExtensions.length ? html`<li class="tc-warning"><k-icon name="warning"></k-icon> ${breakingExtensions.map(extension => extension.name).join(', ')} ${breakingExtensions.length === 1 ? 'is a breaking update that' : 'are breaking updates that'} may change your data.</li>` : nothing}
        ${plan.breaking ? html`<li class="tc-warning"><k-icon name="warning"></k-icon> A backup of the database is taken first. Going back later restores it, which loses anything entered after the update.</li>` : nothing}
      </ul>
    `;
  }

  renderStaged(status){
    const { staged } = status;
    return html`
      <div class="b r p mb">
        <h2 class="h4 mb">${count(staged.packages.length, 'update is', 'updates are')} ready</h2>
        <p class="tc-muted mb">${staged.packages.join(', ')}. ${staged.packages.length === 1 ? 'It is' : 'They are'} downloaded next to your running site, which has not changed. Switching will:</p>
        ${this.renderPlan(staged.plan)}
        <p class="tc-muted mb">${this.renderRestartNote(status)}</p>
        <button class="primary mr" @click=${() => this.openConfirm('update')}>Switch now</button>
        <button @click=${this.discard}>Not now</button>
      </div>
    `;
  }

  renderRow(item, status){
    const blocked = this.blocked(item, status);
    return html`
      <label class="d-f mb">
        <input type="checkbox" class="mr" ?checked=${this.chosen.has(item.key) && !blocked} ?disabled=${blocked || this.phase !== 'idle'} @change=${() => this.toggle(item.key)}>
        <span><strong>${item.name}</strong> ${item.from} <k-icon name="arrow" direction="right"></k-icon> ${item.to}${item.major ? html` <span class="tc-warning">breaking release</span>` : nothing}
          ${blocked ? html`<small class="d-b tc-muted">Needs Kempo ${item.needs} or newer: tick Kempo as well.</small>` : nothing}</span>
      </label>
    `;
  }

  renderAvailable(status){
    const items = this.updatable(status);
    const selected = this.chosenItems();
    const majors = selected.filter(item => item.major);
    return html`
      <div class="b r p mb">
        <h2 class="h4 mb">${count(items.length, 'update is', 'updates are')} available</h2>
        <div class="mb">${items.map(item => this.renderRow(item, status))}</div>
        ${majors.length ? html`<p class="tc-warning mb" role="alert"><k-icon name="warning"></k-icon> ${majors.map(item => item.name).join(', ')} ${majors.length === 1 ? 'is a breaking release' : 'are breaking releases'} and may change how things work. Read ${majors.length === 1 ? 'its' : 'their'} release notes before updating.</p>` : nothing}
        ${status.canUpdate ? (status.mode === 'release' ? html`
          <p class="tc-muted mb">Getting them ready downloads them without touching your site. You choose when to switch.</p>
          <button class="primary" ?disabled=${!selected.length} @click=${this.prepare}>Get ${count(selected.length, 'update', 'updates')} ready</button>
        ` : html`
          <p class="tc-muted mb">${this.renderRestartNote(status)}</p>
          <button class="primary" ?disabled=${!selected.length} @click=${() => this.openConfirm('update')}>Update ${count(selected.length, 'item', 'items')}</button>
        `) : html`<p class="mb">${status.reason} Update where it is installed, then restart the server.</p>`}
      </div>
    `;
  }

  renderCurrent(){
    return html`
      <div class="b r p mb">
        <h2 class="h4 mb"><k-icon name="check" class="tc-success"></k-icon> Everything is up to date</h2>
        <p class="tc-muted">This site runs Kempo ${this.status.runningVersion}${this.status.latestVersion ? ', the newest version' : ''}, and its extensions are on their newest versions.</p>
      </div>
    `;
  }

  renderLast(status){
    const last = status.lastUpdate;
    if(!last || last.ok) return nothing;
    return html`
      <div class="b r p mb" role="alert">
        <h2 class="h5 mb tc-danger">The last update did not work</h2>
        <p>The update of ${last.packages?.length ? last.packages.join(', ') : 'Kempo'} on ${when(last.at)} did not stay running (${last.reason}), so the site went back to how it was.${last.breaking ? ' Your data was restored from the backup taken before it.' : ''}</p>
      </div>
    `;
  }

  renderGoBack(status){
    if(!status.canGoBack) return nothing;
    const last = status.lastUpdate;
    return html`<p class="mb"><button @click=${() => this.openConfirm('back')}>Go back</button> <span class="tc-muted">Puts the site back on what it ran before the last update${last?.ok && last.packages?.length ? ` (${last.packages.join(', ')})` : ''}.</span></p>`;
  }

  renderDatabase(status){
    const { applied = [], failed = [] } = status.database ?? {};
    const { upgraded = [], failed: extensionFailed = [] } = status.extensionsRun ?? {};
    return html`
      ${failed.length ? html`
        <div class="b r p mb" role="alert">
          <h2 class="h5 mb tc-danger">The database needs attention</h2>
          <p class="mb">Kempo started, but these changes to its tables were not applied. Anything that depends on them may not work until they are.</p>
          <ul class="mb">
            ${failed.map(({ change, reason }) => html`<li>${change}: <span class="tc-danger">${reason}</span></li>`)}
          </ul>
          <p class="tc-muted">Kempo only ever adds to its tables on its own. It never drops or changes anything that holds data, so these need someone who can look at the database.</p>
        </div>
      ` : nothing}
      ${extensionFailed.length ? html`
        <div class="b r p mb" role="alert">
          <h2 class="h5 mb tc-danger">An extension could not be brought up to date</h2>
          <ul class="mb">${extensionFailed.map(({ name, from, to, reason }) => html`<li>${name} ${from} <k-icon name="arrow" direction="right"></k-icon> ${to}: <span class="tc-danger">${reason}</span></li>`)}</ul>
          <p class="tc-muted">It is tried again the next time the server starts.</p>
        </div>
      ` : nothing}
      ${applied.length || upgraded.length ? html`
        <div class="b r p mb">
          <h2 class="h5 mb">Brought up to date when the server last started</h2>
          <ul>
            ${upgraded.map(({ name, from, to }) => html`<li>${name} ${from} <k-icon name="arrow" direction="right"></k-icon> ${to}</li>`)}
            ${applied.map(change => html`<li>${change}</li>`)}
          </ul>
        </div>
      ` : nothing}
    `;
  }

  renderDialog(status){
    const back = this.action === 'back';
    const forced = status.staged?.plan.files.forced ?? [];
    const breaking = !back && (status.staged?.plan.breaking ?? false);
    const items = status.mode === 'release' ? (status.staged?.packages ?? []) : this.chosen ? this.chosenItems().map(item => `${item.name} ${item.to}`) : [];
    return html`
      <k-dialog id="confirmDialog" confirm-text=${back ? 'Go back and restart' : 'Update and restart'} confirm-classes="primary ml" cancel-text="Cancel" .confirmAction=${this.confirmed}>
        <h2 slot="title" class="h5 pyh px m0">${back ? 'Go back' : 'Update'}</h2>
        <div class="p">
          <p class="mb">${back ? 'This puts the site back on what it ran before the last update.' : `This updates ${items.join(', ')}.`} ${this.renderRestartNote(status)}</p>
          ${forced.length ? html`<p class="tc-warning mb"><k-icon name="warning"></k-icon> Your edits to ${forced.join(', ')} will be replaced. Your version is saved first.</p>` : nothing}
          ${breaking ? html`<p class="tc-warning mb"><k-icon name="warning"></k-icon> This update changes your data. A backup is taken first, and going back later restores it, which loses anything entered after the update.</p>` : nothing}
          ${back && status.lastUpdate?.breaking ? html`<p class="tc-warning mb"><k-icon name="warning"></k-icon> The update changed your data, so going back restores the database from before it. Anything entered since is lost.</p>` : nothing}
          <p class="tc-muted">Anyone using the site meanwhile will not be able to reach it. This page reloads when the server is back.</p>
        </div>
      </k-dialog>
    `;
  }

  render(){
    const status = this.status;
    if(this.error) return html`<p class="tc-danger" role="alert">${this.error}</p>`;
    if(!status) return html`<k-spinner></k-spinner>`;
    const items = this.updatable(status);
    return html`
      ${this.phase !== 'idle' ? this.renderBusy() : nothing}
      ${this.stalled ? this.renderStalled() : nothing}
      ${this.phase === 'idle' ? html`
        ${this.renderLast(status)}
        ${this.renderDatabase(status)}
        ${status.staged ? this.renderStaged(status) : (items.length ? this.renderAvailable(status) : this.renderCurrent())}
        ${status.checkError || status.extensionUpdates?.checkError ? html`<p class="tc-danger mb" role="alert">The last check failed: ${status.checkError || status.extensionUpdates.checkError}</p>` : nothing}
        <p class="d-f mb">
          <button ?disabled=${this.checking} @click=${this.check}>${this.checking ? 'Checking…' : 'Check now'}</button>
          <span class="tc-muted ph">Last checked ${when(status.checkedAt)}</span>
        </p>
        ${this.renderGoBack(status)}
        <p class="tc-muted">Automatic checks can be turned off with <strong>update_check_enabled</strong> on the System tab of <a href="/admin/settings">Settings</a>. Installing or removing an extension is done from <a href="/admin/extensions">Extensions</a>.</p>
      ` : nothing}
      ${this.renderDialog(status)}
    `;
  }
}

customElements.define('k-admin-updates', Updates);
