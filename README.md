# Seamless Refresh

Stop Flarum telling your members to reload. When the forum's assets change,
the next page they open quietly picks up the new version, and nothing
interrupts them while they read or type.

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
- **No backend.** It only changes how the forum reacts to the header Flarum already sends.

## Settings

There are none. Enable it and you're done.

## Good to know

- **How it works.** It overrides core's `checkAssetsRevision` to set a flag instead of showing the alert, and adds a capture-phase click listener. While the flag is set, a click on an internal, same-origin link becomes a full page load (`window.location.assign`). Back and forward (`popstate`) reload too.
- **What it leaves alone.** Clicks with a modifier key or a middle button ("open in new tab"), `target="_blank"` and `download` links, in-page anchors (`#…`), `javascript:`, `mailto:` and `tel:` links, and external links all behave exactly as normal.
- **Forum only.** The admin panel keeps core's behaviour.

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

## Licence

[MIT](LICENSE.md).
