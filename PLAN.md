# Plan: page builder widgets for the rest of the extensions

Written 2026-11-09. Nothing here is started. Source of the list: a first look at each extension's `public/components` and
pages (the components were not read, so the **First step** of each item is to read the component and confirm the fit).

## Already done (for reference, all uncommitted when this was written)

- kempo core account widgets: login, register, forgot/reset password, verify email, delete account, logout, change password,
  user name/email/verified/member since, notification bell/list, Show for permission.
- kempo-commerce: Cart (whole + pieces), Checkout (whole + pieces), My orders, Cart button, Add to cart.
- kempo-products: Listing, Product (whole + parts: gallery, title, price, short description, options, description, details).
- kempo-forms: Form. kempo-blog: Recent posts, Post list. kempo-discounts: Sale banner (+ the `/sales/[slug]` pages).
- kempo-ui media widgets using the kempo-media picker.

## Existing per-extension plans (read these first)

Some extensions already have a `WIDGET-PLAN.md` in their repo, written earlier (untracked, `Status: planned, not built` unless
noted). Use each as the starting spec for its item below, and update or delete it when the widget is built:

| Extension | File | Status |
|---|---|---|
| kempo-credits | `kempo-credits/WIDGET-PLAN.md` | planned (items 2, 7) |
| kempo-credit-claims | `kempo-credit-claims/WIDGET-PLAN.md` | planned (item 6) |
| kempo-oauth | `kempo-oauth/WIDGET-PLAN.md` | planned (item 5: one `sign-in-buttons` widget with a `login`/`register` mode) |
| kempo-user-dirs | `kempo-user-dirs/WIDGET-PLAN.md` | planned (item 8) |
| kempo-payouts | `kempo-payouts/WIDGET-PLAN.md` | planned (item 9) |
| kempo-game | `kempo-game/WIDGET-PLAN.md` | planned (item 10) |
| kempo-payments | `kempo-payments/WIDGET-PLAN.md` | planned (not on the list above; I had put it under "not worth it": decide) |
| kempo-blog | `kempo-blog/WIDGET-PLAN.md` | built (Recent posts, Post list) |
| kempo-products | `kempo-products/WIDGET-PLAN.md` | built; the Category list (item 1) is not in it |

No plan file yet: kempo-store-credit (3), kempo-discounts Sales list (4), kempo-products Category list (1), blog post parts (11),
kempo-files Upload (12).

## How to build each one (applies to every item)

Read `docs/sitebuilder-widgets.md` first. In short, for each widget:

1. Declare it in the extension's `kempo-config.json` under `page_widgets` (`key`, `title`, `description`, `iconSrc`,
   `category`, `keywords`, `tag`, `page_component`, and `attributes`). Tag names follow `k-<extension sans kempo->-<component>`.
   See `kempo-discounts/kempo-config.json` (`sale-banner`) for a small complete example.
2. The extension ships its own icon in `public/icons` (see the extension icons rule). Use `iconSrc`, not the core set.
3. Give it an **editor component** when the real one would call the server, sign someone in/out, spend money or send
   anything. The editor copy draws the same thing and never does the action. A widget that only reads can usually use the
   page component as is.
4. Give it a **settings component** only when a setting needs more than the generated field (a picker, a list).
5. Compose, don't inject: slots and `<location>`s, a part finds its parent with `closest()`. `closest()` does not cross a
   shadow root, so a widget that hosts parts must expose the contract itself (see the Product widget).
6. Do not make the builder copy depend on being signed in as a customer: the person editing is an admin.
7. Tests: the extension's own suite (`npm test -- <filter>`; kempo-products and kempo-discounts use
   `node scripts/run-tests.js unit node --test --test-concurrency=1`). Cover: the widget is declared, the component file
   defines its tag, every declared setting is one the component reads, the editor copy never reaches the server.
8. Docs: the extension's README (a "Page builder widgets" section) and CHANGELOG.
9. Verify in the demo at `http://localhost:9876`: add the widget to a page in the builder, save, open the page, and check
   the page and the builder copy. A change to server-side code needs the 9876 server restarted (tell the user, never do it).
10. Never `git add -A`; commit per repo, pull `--rebase` before pushing, and again after CI bumps the version.

## The work

### Phase 1: small wrappers around a component that already exists (do these first)

| # | Extension | Widget | Component | Notes |
|---|-----------|--------|-----------|-------|
| 1 | kempo-products | **Category list** | `CategoryList.js` | The builder only has the product listing. Settings: which categories (all / a parent), columns, show images and counts, link target (the category page). |
| 2 | kempo-credits | **Credits balance** | `Balance.js` | Same idea as the Cart button: the signed-in person's balance, for a header or the account page. It already has a `compact` mode: make it a setting. Hidden or a sign-in prompt when signed out (decide). |
| 3 | kempo-store-credit | **Store credit balance** | `Balance.js` | Same as 2, in the currency of kempo-products. Keep the credits / store credit distinction in the copy (credits are game currency, store credit is money). |
| 4 | kempo-discounts | **Sales list** | new, with `SaleBanner.js` as the model | An index of every running sale linking to `/sales/[slug]`. Settings: which sales, show end date, show what each takes off. |
| 5 | kempo-oauth | **Sign-in buttons** | `OauthButtons.js` | For a custom login or landing page. Settings: which providers, the redirect. Editor copy draws the buttons and never starts a sign-in. Keep the core Login widget's slot in mind: these should also fit inside it. |

### Phase 2: self-contained boxes for members

| # | Extension | Widget | Component | Notes |
|---|-----------|--------|-----------|-------|
| 6 | kempo-credit-claims | **Claim credits** | `ClaimCredits.js` | A redeem box. Editor copy must not redeem anything. |
| 7 | kempo-credits | **Send credits** | `SendCredits.js` | Moves credits between people. Editor copy never sends. Confirm the only-credits and no-refund-of-spent rules are not bypassed by where it is placed. |
| 8 | kempo-user-dirs | **My files** and **Storage meter** | `FileSpace.js`, `QuotaMeter.js` | Two widgets. Respect the paywall seam and quota accounting; the editor copies show sample content, never the admin's own space. |
| 9 | kempo-payouts | **Get paid** | `GetPaid.js` | Seller onboarding box. Editor copy must not start a Stripe onboarding. Never run against live Stripe while testing. |
| 10 | kempo-game | **Game lobby** | `Lobby.js` | Embeds the lobby on a page. It opens a realtime connection: the editor copy must not connect. |

### Phase 3: maybe (decide when Phase 1 and 2 are done)

| # | Extension | Widget | Notes |
|---|-----------|--------|-------|
| 11 | kempo-blog | **Post parts** (title, author, date, tags, content, comments) | Suits a post page built in the builder, like the product parts. Needs a Post widget that hosts them and exposes the contract (see the Product widget). The largest item here. |
| 12 | kempo-files | **Upload** | Only if public uploads on a page are wanted. Needs a decision on who may upload and where it lands. |

Not worth a widget: kempo-tax, kempo-payments, kempo-thumbs, kempo-inventory (no page of their own; they work behind others).

## Suggested order and size

Phase 1 is five small items and can be done in one sitting each, in the order 2, 3, 1, 4, 5 (the two balances share a pattern, so
the second is nearly free). Phase 2 is five items, the money-moving ones (7, 9) last and with the most care. Phase 3 only on
request.

## Open decisions to put to the owner before starting

- Signed-out behaviour of the balance widgets (render nothing, or a sign-in link).
- Whether the OAuth buttons should also be offered as content of the Login widget by default.
- Whether Sales list (4) should be part of the sales pages' own template or only a widget.
- Whether the blog post parts (11) are wanted at all, since the post page already renders.

## Housekeeping found along the way (not widgets)

- Nothing from the last several sessions is committed in any repo (kempo, kempo-products, kempo-commerce, kempo-forms,
  kempo-media, kempo-discounts, kempo-blog, kempo-files, and others): see `git status` in each.
- The demo server on 9876 needs a restart for server-side changes (widget registry, the system pages, the reset-link default).
- The kempo-ui changes (`ctx.zone`, media settings, the `file` field) need a kempo-ui release before kempo can require them.
