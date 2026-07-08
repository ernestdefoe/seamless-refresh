# Seamless Refresh for Flarum

When Flarum's assets are rebuilt (a deploy, an extension toggle), the running page
notices — every API response carries an `X-Flarum-Assets-Revision` header, and if it
differs from the one the page booted with, Flarum pops up a dismissible

> **A new version of this page is available.** [Reload]

That alert appears **immediately**, right in the middle of whatever you were reading or
typing. On a busy forum whose assets change often, it can feel like it's constantly
nagging you to reload.

**Seamless Refresh** takes a gentler approach, proposed by [luceos on the Flarum
tracker](https://github.com/flarum/framework): when newer assets are detected, it
**doesn't interrupt you at all** — it just quietly remembers. The **next time you
actually navigate** — click a link, open a discussion, use back/forward — the browser
does a normal full page load of that destination, so the fresh assets come along for the
ride. No modal, no timing guesswork, no risk of wiping a draft.

- **Never interrupts** a reading or typing user — nothing appears mid-session.
- **Always up to date** — your very next navigation is already on the new assets.
- **Zero configuration** — enable it and you're done.
- **No backend** — it only changes how the frontend reacts to the revision header Flarum
  already sends.

## How it works

Flarum core detects the new revision in `ForumApplication.checkAssetsRevision` and shows
the alert. This extension overrides that method to set a flag instead of alerting, and
registers a capture-phase click listener: while the flag is set, an internal same-origin
link click is turned into a full page load (`window.location.assign`) so the destination
boots with the new assets. Back/forward (`popstate`) reloads too.

It deliberately does **not** touch: modified clicks (Ctrl/⌘/Shift/middle — "open in new
tab"), `target="_blank"` / `download` links, in-page anchors (`#…`), `javascript:` /
`mailto:` / `tel:` links, or external links. It also never fires while you're just
reading or typing — only a real navigation triggers the refresh, and the browser's own
"unsaved changes" guard still protects an open composer.

## Install

```bash
composer require ernestdefoe/seamless-refresh
```

Then enable **Seamless Refresh** in **Admin → Extensions**. There are no settings.

## Credit

The behaviour is a direct implementation of the "refresh on the next natural interaction"
idea [luceos](https://github.com/luceos) proposed as a middle ground between *always
interrupt* and *never warn*. If you like it, it's also being proposed for Flarum core.

## License

[MIT](LICENSE.md) © ernestdefoe
