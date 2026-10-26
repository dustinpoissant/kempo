import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import { installExtension, listExtensions } from '/kempo/sdk.js';

/*
  What installing a marketplace extension changes, worked out before anything is offered: the extensions it
  needs that this site does not have yet (downloaded and installed), and the ones it has but has switched
  off (enabled). An extension cannot run without what it requires, so the administrator approves the whole
  list or none of it.
*/
export const installTree = async item => {
  const [, installedData] = await listExtensions({ limit: 200 });
  const installedState = new Map((installedData?.items || []).map(extension => [extension.name, extension.enabled]));
  return {
    missing: item.dependencies.extensions.filter(dependency => !installedState.has(dependency.name)),
    switchedOff: item.dependencies.extensions.filter(dependency => installedState.get(dependency.name) === false),
  };
};

/*
  Shows the chain from `installTree` for approval, then installs it in one go with `withDependencies`.
*/
export const confirmInstall = ({ item, missing, switchedOff, onInstalled }) => {
  const total = missing.length + switchedOff.length + 1;

  const contents = document.createElement('div');
  contents.className = 'p';

  const intro = document.createElement('p');
  intro.textContent = total > 1
    ? `"${item.name}" cannot run without the extensions below, so installing it also changes these, in this order:`
    : `Install "${item.name}"?`;
  contents.append(intro);

  const step = (title, dependencies) => {
    if(!dependencies.length) return;
    const heading = document.createElement('p');
    heading.className = 'mb0';
    const strong = document.createElement('strong');
    strong.textContent = title;
    heading.append(strong);
    const ol = document.createElement('ol');
    for(const dependency of dependencies){
      const li = document.createElement('li');
      li.textContent = `${dependency.name} ${dependency.version}`;
      ol.append(li);
    }
    contents.append(heading, ol);
  };
  step('Downloaded and installed', missing);
  step('Already installed, will be enabled', switchedOff);

  const note = document.createElement('p');
  note.className = 'tc-muted';
  note.textContent = 'Extensions are code that runs on your site with its permissions. Only install what you trust.';
  contents.append(note);

  Dialog.create(contents, {
    title: total > 1 ? `Install ${total} Extensions` : 'Install Extension',
    closeBtn: false,
    overlayClose: false,
    confirmText: total > 1 ? `Install and enable ${total} extensions` : 'Install',
    cancelText: 'Cancel',
    confirmAction: async () => {
      const [installError, result] = await installExtension(item.name, { withDependencies: true });
      if(installError){
        Toast.error(installError.msg || 'Failed to install the extension');
        return;
      }
      const enabled = result.enabled?.length ? `, enabled ${result.enabled.join(', ')}` : '';
      Toast.success(`Installed ${result.installed?.join(', ') || item.name}${enabled}`);
      onInstalled();
    },
  });
};
