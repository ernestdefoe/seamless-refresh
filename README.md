# Seamless Refresh

Stop Flarum telling your members to reload. When the forum's assets change,
the next page they open quietly picks up the new version, and nothing
interrupts them while they read or type. When a session ends under an open
page, it recovers instead of throwing errors at every click.

![Without Seamless Refresh: Flarum core's yellow "A newer version of this page is available. Reload" alert across the page](screenshots/without.png)

*Without Seamless Refresh. This is the alert it replaces.*

When Flarum's assets are rebuilt (a deploy, an extension switched on or off),
every API response carries a new `X-Flarum-Assets-Revision` header. Core
notices it differs from the one the page loaded with and shows that alert
straight away, in the middle of whatever you were doing. On a busy forum whose
assets change often, it feels like it's always asking you to reload.

Seamless Refresh takes the gentler approach
[luceos](https://github.com/luceos) proposed on the Flarum tracker:

- **Never interrupts.** When newer assets are detected, nothing appears. It just remembers.
- **Up to date on the next click.** The next time you navigate (follow a link, open a discussion, go back or forward), the browser does a normal full page load of where you were going, so the new assets come with it.
- **Leaves drafts alone.** Only a real navigation triggers the refresh, and the browser's own "unsaved changes" guard still protects an open composer.

## When a session ends under an open page

Leave a tab open long enough and the session behind it expires. Flarum doesn't notice until the member does something: their reply, like or edit fails with an error, and so does every action after it, until they reload by hand. Asked for on discuss.flarum.org in [Forcing page reloads/refreshes](https://discuss.flarum.org/d/39061).

Seamless Refresh handles it:

- **Signed back in without noticing.** With "remember me", the server signs the member straight back in, but the page still holds the old security token. Seamless Refresh fetches the new one and sends the failed action again. The reply posts; nothing appears.
- **Actually signed out.** One calm notice, *"Your session has ended. Sign in again to keep posting; this page stays as it is"*, with a **Sign in** button, instead of an error for every click.
- **A real "no".** If the member genuinely isn't allowed to do something, Flarum's usual message shows as before.

## Coming back to an old tab

A tab left in the background for five minutes or more, or a page a phone restores from memory, checks in once when it's looked at again:

- **Signed out meanwhile:** the same notice.
- **Groups or permissions changed** (promoted, demoted, granted something), **signed in from another tab**, or **the forum updated**: the next click loads its destination fresh, the same quiet way as new assets.
- **Nothing changed:** nothing happens.

## Settings

There are none. Enable it and you're done.

## Good to know

- **How it works.** It overrides core's `checkAssetsRevision` to set a flag instead of showing the alert, and adds a capture-phase click listener. While the flag is set, a click on an internal, same-origin link becomes a full page load (`window.location.assign`). Back and forward (`popstate`) reload too.
- **What it leaves alone.** Clicks with a modifier key or a middle button ("open in new tab"), `target="_blank"` and `download` links, in-page anchors (`#…`), `javascript:`, `mailto:` and `tel:` links, and external links all behave exactly as normal.
- **Forum only.** The admin panel keeps core's behaviour.
- **One tiny endpoint.** `GET /api/seamless-refresh/session` answers who the browser is signed in as, plus a fingerprint of their groups and permissions. It's only called after a failed action or when an old tab comes back, never on a timer.

## Installation

```bash
composer require ernestdefoe/seamless-refresh
php flarum cache:clear
```

Then enable **Seamless Refresh** in the admin panel.

## Updating

```bash
composer update ernestdefoe/seamless-refresh
php flarum cache:clear
```

## Credit

The behaviour is a direct implementation of the "refresh on the next natural
interaction" idea [luceos](https://github.com/luceos) proposed as a middle
ground between always interrupting and never warning. It's also being proposed
for Flarum core.

## Discuss

Questions, ideas and release notes: [Seamless Refresh on discuss.flarum.org](https://discuss.flarum.org/d/39533-seemless-refresh-created-with-ai).

## Licence

[MIT](LICENSE.md).
