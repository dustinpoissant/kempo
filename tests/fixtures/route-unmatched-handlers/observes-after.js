/*
  Runs regardless of whether an earlier handler already claimed the request — the logging-extension
  case. Registered second, so the header it sets proves both that it ran after a handler that set
  `handled`, and that it could see that decision.
*/
export default async ({ draft }) => {
  draft.headers['X-Observed-Handled'] = String(draft.handled);
};
