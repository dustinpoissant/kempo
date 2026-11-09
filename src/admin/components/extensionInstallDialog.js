import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import { installExtension, enableExtension, listExtensions, getKnownExtension, getSuggestedExtensions, getExtensionRequirements } from '/kempo/sdk.js';

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
  A dialog that asks the administrator to approve a change that reaches more than one extension (a chain of
  requirements), listing it. Resolves true when approved and false when cancelled.
*/
export const confirmChain = ({ title, intro, items, confirmText, danger }) => {
  const contents = document.createElement('div');
  contents.className = 'p';

  const text = document.createElement('p');
  text.textContent = intro;
  contents.append(text);

  if(items.length){
    const list = document.createElement('ul');
    for(const entry of items){
      const item = document.createElement('li');
      item.textContent = entry;
      list.append(item);
    }
    contents.append(list);
  }

  return new Promise(resolve => {
    Dialog.create(contents, {
      title,
      closeBtn: false,
      overlayClose: false,
      confirmText,
      confirmClasses: danger ? 'danger ml' : 'primary ml',
      cancelText: 'Cancel',
      confirmAction: () => resolve(true),
      cancelAction: () => resolve(false),
    });
  });
};

/*
  Enables an installed extension, after showing what else it turns on (what it requires that is switched off, and what
  those require) for approval. Used by the Enable button and by the Works well with offer, so both ask the same way.
  Resolves the result (\`enabledNames\` is everything that was turned on), or null when it was cancelled or failed.
*/
export const enableWithConfirm = async name => {
  const [requirementsError, data] = await getExtensionRequirements(name);
  if(requirementsError){
    Toast.error(requirementsError.msg || 'Failed to check what this extension requires');
    return null;
  }

  if(data.missing.length){
    Toast.error(`"${name}" requires ${data.missing.join(', ')}, which ${data.missing.length === 1 ? 'is' : 'are'} not installed`);
    return null;
  }

  const requirements = data.disabled;
  const agreed = await confirmChain(requirements.length ? {
    title: `Enable ${requirements.length + 1} Extensions`,
    intro: `"${name}" cannot run without these, which are switched off. Enabling it also enables:`,
    items: requirements.map(requirement => requirement.requires.length ? `${requirement.name} (needs ${requirement.requires.join(', ')})` : requirement.name),
    confirmText: `Enable ${requirements.length + 1} extensions`,
    danger: false,
  } : {
    title: 'Enable Extension',
    intro: `Enable "${name}"? Its pages, files, widgets and hooks are used again, with its data and settings as they were.`,
    items: [],
    confirmText: 'Enable',
    danger: false,
  });
  if(!agreed) return null;

  const [error, result] = await enableExtension(name, { cascade: true });
  if(error){
    Toast.error(error.msg || 'Failed to enable extension');
    return null;
  }

  Toast.success(result.enabledNames.length > 1 ? `Enabled ${result.enabledNames.join(', ')}` : `"${name}" enabled`);
  return result;
};

/*
  What the extensions that were just installed or enabled suggest to go with them (their \`suggestedPeers\`, the extensions they
  needed included, merged), as a list to pick from. It is advice: nothing is added unless it is ticked and confirmed, each is
  left unticked because installing runs someone's code on the site, and each one ticked is then added the normal way, with the
  same confirmation as adding it from the Extensions page (\`enableWithConfirm\`, \`installWithConfirm\`). \`done\` runs when it is all
  over, with whether anything was added, or at once when there is nothing to suggest.
*/
export const offerSuggested = async (names, done = () => {}) => {
  const [error, data] = await getSuggestedExtensions(names);
  const suggestions = error ? [] : data.suggestions;
  if(!suggestions.length){
    done(false);
    return;
  }

  /* A switched off suggestion may need others that are switched off too, which enabling it turns on: say so, before it is ticked. */
  await Promise.all(suggestions.filter(suggestion => suggestion.status === 'disabled').map(async suggestion => {
    const [requirementsError, requirements] = await getExtensionRequirements(suggestion.name);
    suggestion.alsoEnables = requirementsError ? [] : requirements.disabled.map(requirement => requirement.name);
    suggestion.cannotEnable = requirementsError ? [] : requirements.missing;
  }));

  const chosen = new Set();
  const contents = document.createElement('div');
  contents.className = 'p';

  const intro = document.createElement('p');
  const sources = [...new Set(suggestions.flatMap(suggestion => suggestion.suggestedBy))];
  intro.textContent = sources.length === 1
    ? `"${sources[0]}" does more with the extensions below. None of them is required.`
    : 'What was just added does more with the extensions below. None of them is required.';
  contents.append(intro);

  for(const suggestion of suggestions){
    const label = document.createElement('label');
    label.className = 'checkbox d-b mbq';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.disabled = !!suggestion.cannotEnable?.length;
    input.addEventListener('change', () => (input.checked ? chosen.add(suggestion.name) : chosen.delete(suggestion.name)));
    const strong = document.createElement('strong');
    strong.textContent = suggestion.name;
    label.append(input, ' ', strong, suggestion.status === 'disabled' ? ' (installed, switched off)' : '');
    if(sources.length > 1){
      const by = document.createElement('span');
      by.className = 'd-b tc-muted';
      by.textContent = `Suggested by ${suggestion.suggestedBy.join(', ')}`;
      label.append(by);
    }
    if(suggestion.reason){
      const reason = document.createElement('span');
      reason.className = 'd-b tc-muted';
      reason.textContent = suggestion.reason;
      label.append(reason);
    }
    if(suggestion.alsoEnables?.length || suggestion.cannotEnable?.length){
      const needs = document.createElement('span');
      needs.className = suggestion.cannotEnable.length ? 'd-b tc-danger' : 'd-b tc-muted';
      needs.textContent = suggestion.cannotEnable.length
        ? `Needs ${suggestion.cannotEnable.join(', ')}, which ${suggestion.cannotEnable.length === 1 ? 'is' : 'are'} not installed.`
        : `Needs ${suggestion.alsoEnables.join(', ')}, which will be enabled with it (you confirm that next).`;
      label.append(needs);
    }
    contents.append(label);
  }

  const note = document.createElement('p');
  note.className = 'tc-muted';
  note.textContent = 'Extensions are code that runs on your site with its permissions. Only install what you trust.';
  contents.append(note);

  const added = await new Promise(resolve => {
    let acting = false;
    Dialog.create(contents, {
      title: 'Works well with',
      closeBtn: false,
      overlayClose: false,
      confirmText: 'Add selected',
      cancelText: 'Not now',
      confirmAction: async () => {
        acting = true;
        let any = false;
        for(const suggestion of suggestions.filter(other => chosen.has(other.name))){
          const result = suggestion.status === 'disabled' ? await enableWithConfirm(suggestion.name) : await installWithConfirm(suggestion.name);
          if(result) any = true;
        }
        resolve(any);
      },
      closeCallback: () => {
        if(!acting) resolve(false);
      },
    });
  });
  done(added);
};

/*
  Shows the chain from \`installTree\` for approval, then installs it in one go with \`withDependencies\`. Resolves true once it
  is installed (and the Works well with offer that follows is over), or false when it was cancelled or failed.
*/
export const confirmInstall = ({ item, missing, switchedOff, onInstalled = () => {} }) => {
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

  return new Promise(resolve => {
    Dialog.create(contents, {
      title: total > 1 ? `Install ${total} Extensions` : 'Install Extension',
      closeBtn: false,
      overlayClose: false,
      confirmText: total > 1 ? `Install and enable ${total} extensions` : 'Install',
      cancelText: 'Cancel',
      cancelAction: () => resolve(false),
      confirmAction: async () => {
        const [installError, result] = await installExtension(item.name, { withDependencies: true });
        if(installError){
          Toast.error(installError.msg || 'Failed to install the extension');
          resolve(false);
          return;
        }
        const enabled = result.enabled?.length ? `, enabled ${result.enabled.join(', ')}` : '';
        Toast.success(`Installed ${result.installed?.join(', ') || item.name}${enabled}`);
        offerSuggested(result.installed?.length ? result.installed : [item.name], () => {
          onInstalled();
          resolve(true);
        });
      },
    });
  });
};

/*
  Installs an extension the way the Extensions page does: from the marketplace's details, with the chain it needs shown for
  approval, or, for a package that is in node_modules the marketplace does not list, after a plain confirmation. Resolves true
  once installed, false when cancelled or failed. \`onInstalled\` runs after, when the page should refresh.
*/
export const installWithConfirm = async (name, onInstalled = () => {}) => {
  const [detailsError, details] = await getKnownExtension(name);
  if(!detailsError){
    const tree = await installTree(details.item);
    return confirmInstall({ item: details.item, ...tree, onInstalled });
  }

  return new Promise(resolve => {
    Dialog.confirm(`Install "${name}"?`, async confirmed => {
      if(!confirmed){
        resolve(false);
        return;
      }

      const [error] = await installExtension(name);
      if(error){
        Toast.error(error.msg || 'Failed to install extension');
        resolve(false);
        return;
      }

      Toast.success(`"${name}" installed successfully`);
      offerSuggested(name, () => {
        onInstalled();
        resolve(true);
      });
    });
  });
};
