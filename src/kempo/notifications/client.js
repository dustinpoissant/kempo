/*
  The notification client: what turns a notification created on the server into something a person sees on whatever
  page they land on next. A template loads it once per page,

    <script type="module" src="/kempo/notifications/client.js"></script>

  and it asks the server what to show, immediately and then every `system:notification_poll_seconds`, and again when
  the window is focused or the tab becomes visible. Nothing else is needed on a page for these types:

  - `toast`   an overlay that stays up for the toast time and then counts as viewed. X dismisses it, its first action
              (or an "Okay" when it must be acknowledged) acknowledges it. Leaving the page early does not view it.
  - `banner`  at the top of the page, one at a time. Viewed once it has been on screen for the banner time.
  - `modal`   a blocking dialog with no way out but its buttons, which acknowledge it.

  Any other type is handed to whatever subscribed to it (`subscribe`), and one nobody has subscribed to is left alone
  until a page that has a subscriber loads. That is how `inline` works (see NotificationInline.js) and how an
  extension's own type (a chat message, say) is handled by the extension's own component.

  A notification's text is always put on the page as text, never as HTML.
*/

const API = '/kempo/api/notifications';

const FAILURE_WAIT_MS = 30000;

const state = {
  config: { pollSeconds: 10, cooldownSeconds: 180, toastSeconds: 10, bannerSeconds: 10 },
  handlers: new Map(),
  known: new Map(),
  dispatched: new Set(),
  noticeCount: null,
  noticeListeners: new Set(),
  banners: { queue: [], current: null, host: null },
  modals: { queue: [], current: null },
  timer: null,
  polling: false,
  lastPoll: 0,
};

/*
  Helpers
*/

/* The same test the server applies: a path on this site and nothing else. */
const isLocalPath = value => typeof value === 'string' && /^\/(?![/\\])[^\\\s\u0000-\u001f\u007f]*$/.test(value);

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const send = (path, method = 'POST', body = {}) => fetch(`${API}${path}`, {
  method,
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).catch(() => null);

const report = {
  delivered: ids => send('/delivered', 'POST', { ids }),
  shown: id => send(`/${encodeURIComponent(id)}/shown`),
  viewed: id => send(`/${encodeURIComponent(id)}/viewed`),
  acknowledge: id => send(`/${encodeURIComponent(id)}/acknowledge`),
  dismiss: id => send(`/${encodeURIComponent(id)}`, 'DELETE'),
};

/* Calls `callback` once the page has been visible for `seconds`, counting only the time it is. Returns a way to cancel. */
const afterVisible = (seconds, callback) => {
  let elapsed = 0;
  const tick = setInterval(() => {
    if(document.hidden) return;
    elapsed += 1;
    if(elapsed >= seconds){
      clearInterval(tick);
      callback();
    }
  }, 1000);
  return () => clearInterval(tick);
};

const element = (tag, { className, text, attributes } = {}) => {
  const node = document.createElement(tag);
  if(className) node.className = className;
  if(text !== undefined) node.textContent = text;
  for(const [name, value] of Object.entries(attributes ?? {})) node.setAttribute(name, value);
  return node;
};

const icon = name => element('k-icon', { attributes: { name } });

/*
  What happens when a person uses one of a notification's actions. A link acknowledges the notification and goes there.
  A call is made by this browser as the person, and only a response that succeeded acknowledges it; a failure is
  reported through `onError` and leaves the notification open to try again. An action with neither (the "Okay" of
  one that must be acknowledged) just acknowledges. Resolves to true when the notification was acknowledged.
*/
const runAction = async (notification, action, onError) => {
  if(action.href !== undefined){
    if(!isLocalPath(action.href)) return false;
    await report.acknowledge(notification.id);
    window.location.href = action.href;
    return true;
  }

  if(action.api){
    const { method, url, body } = action.api;
    if(!isLocalPath(url)) return false;
    let response = null;
    try {
      response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      response = null;
    }
    if(!response?.ok){
      const detail = response ? await response.json().catch(() => ({})) : {};
      onError(`${action.label} failed: ${detail.error || detail.message || (response ? response.status : 'the request could not be sent')}`);
      return false;
    }
  }

  await report.acknowledge(notification.id);
  return true;
};

const controlsFor = notification => ({
  shown: () => report.shown(notification.id),
  viewed: () => report.viewed(notification.id),
  acknowledge: () => report.acknowledge(notification.id),
  dismiss: () => report.dismiss(notification.id),
  run: (action, onError = () => {}) => runAction(notification, action, onError),
  settings: state.config,
});

/*
  Toast
*/

const presentToast = async (notification, controls) => {
  const { default: Toast } = await import('/kempo-ui/components/Toast.js');
  const action = notification.actions?.[0] ?? (notification.mustAcknowledge ? { label: 'Okay' } : null);
  let outcome = null;

  const close = element('span', { attributes: { 'aria-label': 'Dismiss' } });
  close.append(icon('close'));

  const message = `<strong>${escapeHtml(notification.title)}</strong>${notification.message ? `<div>${escapeHtml(notification.message)}</div>` : ''}`;
  const make = { success: Toast.success, error: Toast.error, warning: Toast.warning }[notification.subtype];
  const options = {
    timeout: notification.mustAcknowledge ? 0 : (notification.displaySeconds ?? state.config.toastSeconds) * 1000,
    close,
    action: action ? escapeHtml(action.label) : false,
    ...(make ? {} : { icon: '<k-icon name="info"></k-icon>' }),
    actionCallback: () => {
      outcome = 'acknowledged';
      controls.run(action, text => Toast.error(escapeHtml(text))).then(done => {
        if(done) toast.close();
        else outcome = null;
      });
      return false;
    },
    closeCallback: () => {
      if(outcome === 'dismissed') controls.dismiss();
      else if(outcome === null) controls.viewed();
    },
  };
  const toast = (make ?? Toast.create).call(Toast, message, options);

  /* The X is a button inside the toast, so a click or a key press on it shows in the event's path, whatever it landed on. */
  toast.addEventListener('click', event => {
    if(event.composedPath().some(node => node.id === 'close')) outcome = 'dismissed';
  });

  if(notification.mustAcknowledge) controls.shown();
};

/*
  Banner
*/

const bannerHost = () => {
  if(state.banners.host?.isConnected) return state.banners.host;
  const host = element('div', { attributes: { 'data-notification-banners': '' } });
  (document.querySelector('main') ?? document.body).prepend(host);
  state.banners.host = host;
  return host;
};

const BANNER_COLORS = { success: 'bg-success', warning: 'bg-warning', error: 'bg-danger' };

const showNextBanner = () => {
  if(state.banners.current || !state.banners.queue.length) return;

  const { notification, controls } = state.banners.queue.shift();
  const card = element('div', { className: `d-f p r ${BANNER_COLORS[notification.subtype] ?? 'bg-primary'}`, attributes: { role: 'status', 'data-notification-id': notification.id } });
  const body = element('div', { className: 'flex' });
  const error = element('div', { attributes: { role: 'alert' } });
  body.append(element('strong', { text: notification.title }));
  if(notification.message) body.append(element('div', { text: notification.message }));

  let cancelView = () => {};
  let finished = false;

  const finish = () => {
    if(finished) return;
    finished = true;
    cancelView();
    card.remove();
    state.banners.current = null;
    showNextBanner();
  };

  const actions = notification.actions?.length ? notification.actions : (notification.mustAcknowledge ? [{ label: 'Okay' }] : []);
  if(actions.length){
    const row = element('div', { className: 'mth' });
    for(const action of actions){
      const button = element('button', { className: 'mr', text: action.label });
      button.addEventListener('click', async () => {
        button.disabled = true;
        error.textContent = '';
        const done = await controls.run(action, text => { error.textContent = text; });
        if(done) finish();
        else button.disabled = false;
      });
      row.append(button);
    }
    body.append(row);
  }
  body.append(error);

  const dismiss = element('button', { className: 'no-btn', attributes: { 'aria-label': 'Dismiss', title: 'Dismiss' } });
  dismiss.append(icon('close'));
  dismiss.addEventListener('click', () => {
    controls.dismiss();
    finish();
  });

  card.append(body, dismiss);
  state.banners.current = card;
  bannerHost().append(card);

  if(notification.mustAcknowledge) controls.shown();
  cancelView = afterVisible(state.config.bannerSeconds, () => {
    controls.viewed();
    if(!notification.mustAcknowledge && state.banners.queue.length) finish();
  });
};

const presentBanner = (notification, controls) => {
  state.banners.queue.push({ notification, controls });
  showNextBanner();
};

/*
  Modal
*/

const showNextModal = async () => {
  if(state.modals.current || !state.modals.queue.length) return;

  const { notification, controls } = state.modals.queue.shift();
  state.modals.current = notification.id;
  const { default: Dialog } = await import('/kempo-ui/components/Dialog.js');

  const content = element('div', { className: 'p' });
  const error = element('p', { className: 'tc-danger', attributes: { role: 'alert' } });
  if(notification.message) content.append(element('p', { text: notification.message }));
  content.append(error);

  const title = element('span', { text: notification.title });
  const actions = notification.actions?.length ? notification.actions : [{ label: 'Okay' }];
  const row = element('div', { className: 'ta-right' });
  let dialog = null;

  for(const action of actions){
    const button = element('button', { className: 'primary ml', text: action.label });
    button.addEventListener('click', async () => {
      button.disabled = true;
      error.textContent = '';
      const done = await controls.run(action, text => { error.textContent = text; });
      if(done){
        dialog.close();
      } else {
        button.disabled = false;
      }
    });
    row.append(button);
  }
  content.append(row);

  dialog = Dialog.create(content, {
    title,
    closeBtn: false,
    overlayClose: false,
    disableKeyboardClose: true,
    closeExisting: false,
    closeCallback: () => {
      state.modals.current = null;
      showNextModal();
    },
  });
  controls.shown();
};

const presentModal = (notification, controls) => {
  state.modals.queue.push({ notification, controls });
  showNextModal();
};

/*
  Handing notifications out
*/

const presenters = { toast: presentToast, banner: presentBanner, modal: presentModal };

/*
  Gives a notification to what shows its type: kempo's own presenter, or whatever subscribed to it. Returns true when
  something took it. One that nobody can show is left alone, so it is not reported as delivered.
*/
const dispatch = notification => {
  const controls = controlsFor(notification);
  const present = Object.hasOwn(presenters, notification.type) ? presenters[notification.type] : null;

  if(present){
    present(notification, controls);
    return true;
  }

  const handlers = state.handlers.get(notification.type);
  if(!handlers?.size) return false;
  handlers.forEach(handler => handler(notification, controls));
  return true;
};

const handOut = () => {
  const taken = [];

  for(const notification of state.known.values()){
    if(state.dispatched.has(notification.id)) continue;
    if(dispatch(notification)){
      state.dispatched.add(notification.id);
      taken.push(notification.id);
    }
  }

  if(taken.length) report.delivered(taken);
};

/*
  Polling
*/

const schedule = () => {
  clearTimeout(state.timer);
  if(state.config.pollSeconds > 0) state.timer = setTimeout(poll, state.config.pollSeconds * 1000);
};

const poll = async () => {
  if(state.polling) return;
  if(document.hidden){
    schedule();
    return;
  }

  state.polling = true;
  state.lastPoll = Date.now();
  let failed = false;

  try {
    const response = await fetch(`${API}/pending`, { credentials: 'same-origin', cache: 'no-store' });
    if(response.status === 401){
      /* No login and no guest any more (signed out in another tab, say): there is nothing to count, so a bell hides. */
      state.noticeCount = null;
      state.noticeListeners.forEach(listener => listener(null));
    }
    if(!response.ok) throw new Error(String(response.status));
    const data = await response.json();

    state.config = data.config;
    state.known = new Map(data.notifications.map(notification => [notification.id, notification]));
    state.noticeCount = data.unreadNotices;
    state.noticeListeners.forEach(listener => listener(state.noticeCount));
    handOut();
  } catch {
    failed = true;
  } finally {
    state.polling = false;
  }

  if(failed){
    clearTimeout(state.timer);
    state.timer = setTimeout(poll, Math.max(state.config.pollSeconds * 1000, FAILURE_WAIT_MS));
  } else {
    schedule();
  }
};

/* A focus or a return to the tab asks at once, but not more than once a second. */
const refreshSoon = () => {
  if(!document.hidden && Date.now() - state.lastPoll > 1000) poll();
};

/*
  Public API
*/

/*
  Asks the server now. Use it after something that may have raised a notification, such as a form that was just saved,
  so the person does not wait for the next poll.
*/
export const refresh = () => poll();

/*
  Receives notifications of one `type` that kempo's own client does not draw. The handler is called with the
  notification and a set of controls: `shown()`, `viewed()`, `acknowledge()`, `dismiss()` to report what the person did
  (they are the only way the server learns it), `run(action, onError)` to carry out one of the notification's
  actions, and `settings`. It is called for what is pending now as well as for what arrives later, and returns a
  function that stops it.
*/
export const subscribe = (type, handler) => {
  if(!state.handlers.has(type)) state.handlers.set(type, new Set());
  state.handlers.get(type).add(handler);
  queueMicrotask(handOut);

  return () => {
    state.handlers.get(type)?.delete(handler);
  };
};

/* Receives how many notices the person has not viewed, now and whenever it changes. Returns a function that stops it. */
export const onNoticeCount = listener => {
  state.noticeListeners.add(listener);
  if(state.noticeCount !== null) listener(state.noticeCount);
  return () => state.noticeListeners.delete(listener);
};

/* The settings the server last gave: poll, cooldown, toast and banner seconds. */
export const getSettings = () => state.config;

/*
  Start
*/

window.addEventListener('focus', refreshSoon);
document.addEventListener('visibilitychange', refreshSoon);
poll();
