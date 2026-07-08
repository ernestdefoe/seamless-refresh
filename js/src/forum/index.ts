import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';

/**
 * Seamless Refresh
 * ----------------
 * Flarum warns you with a dismissible "a new version of this page is available —
 * reload" alert the moment the forum's JS/CSS is rebuilt (it compares the
 * `X-Flarum-Assets-Revision` header on every API response with the one the page
 * booted with). That interrupts whatever you were reading or typing.
 *
 * Instead, we do what luceos proposed on the Flarum tracker: when newer assets
 * are detected, we DON'T surface anything — we just remember it. The next time
 * the user actually navigates (clicks a link, opens a discussion, hits
 * back/forward), we let the browser do a full page load of that destination, so
 * fresh assets are picked up naturally. An actively reading or typing user is
 * never interrupted, no modal, no timing guesswork, no risk of wiping a draft.
 */
app.initializers.add('ernestdefoe-seamless-refresh', () => {
  // 1. Detect newer assets exactly like core does, but only raise a flag — never
  //    show the alert. (Patch the running app's class prototype — `flarum/forum/
  //    ForumApplication` isn't exposed as an importable module in Flarum 2.)
  override((app as any).constructor.prototype, 'checkAssetsRevision', function (this: any, _original: unknown, serverRevision: string | null) {
    const bootedRevision = this.data?.assetsRevision;

    if (!serverRevision || !bootedRevision || serverRevision === bootedRevision) {
      return;
    }

    this.assetsRefreshPending = true;
  });

  const pending = () => (app as any).assetsRefreshPending === true;

  // 2. Intercept the next real navigation and turn it into a full page load, so
  //    the destination boots with the fresh assets. Capture phase + stop-immediate
  //    so this runs before Mithril's own <Link>/router click handling.
  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (!pending() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return;
      }

      const raw = anchor.getAttribute('href') || '';
      // In-page anchors, dropdown toggles (href="#"), and non-http schemes are not
      // navigations — leave them to their normal handlers.
      if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel):/i.test(raw)) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // Same-origin only; an external link already leaves the app.
      if (url.origin !== window.location.origin) {
        return;
      }

      // A pure hash change on the current page isn't a navigation either.
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();
      window.location.assign(url.href);
    },
    true
  );

  // 3. Back/forward after an update: reload so it boots fresh too.
  window.addEventListener('popstate', () => {
    if (pending()) {
      window.location.reload();
    }
  });
});
