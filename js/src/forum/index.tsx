import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import type ForumApplication from 'flarum/forum/ForumApplication';

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
  const appPrototype: ForumApplication = (app as any).constructor.prototype;

  override(appPrototype, 'checkAssetsRevision', function (this: any, _original: unknown, serverRevision: string | null) {
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

  /*
   * 4. Sessions that end under an open page.
   *
   * Core refreshes the CSRF token from every SUCCESSFUL response, never from a
   * failed one. So once a session lapses, the next post or like fails with
   * "CSRF token mismatch" — and so does every action after it, each with its
   * own error, until the member reloads by hand.
   *
   * Instead, a failure that smells of an ended session (a token mismatch, 401,
   * or 403) first asks the server who this browser is now. That GET is not
   * CSRF-checked, and as a successful response it hands core a fresh token.
   *
   *  - Same member (usually: "remember me" signed them straight back in): the
   *    failed request is sent again, once, with the new token. Nothing shows.
   *  - Signed out: one calm notice with a Sign in button, instead of a stream
   *    of errors.
   *  - Otherwise it was a real refusal, and core's own message is shown.
   */
  /*
   * 🚨 Read lazily. Initializers run BEFORE core creates app.session, so taking
   * these at the top threw, and the whole extension failed to initialise for
   * every visitor. On first use the page has booted, and app.session.user is
   * still who the page booted as: it never changes until the next page load.
   */
  let booted: { userId: number | null; signature: string | null } | null = null;
  const boot = () =>
    (booted ??= {
      userId: app.session?.user ? Number(app.session.user.id()) : null,
      signature: app.forum?.attribute('seamlessRefreshSignature') ?? null,
    });
  const sessionUrl = () => app.forum.attribute('apiUrl') + '/seamless-refresh/session';

  type SessionState = { userId: number | null; signature: string };

  const askServer = (): Promise<SessionState | null> =>
    app
      .request<SessionState>({ method: 'GET', url: sessionUrl(), errorHandler: () => {} })
      .then((state) => state)
      .catch(() => null);

  let endedAlert: unknown = null;

  const showSessionEnded = () => {
    if (endedAlert !== null) return; // once, not once per failed request

    endedAlert = app.alerts.show(
      {
        type: 'warning',
        dismissible: false,
        controls: [
          <Button className="Button Button--link" onclick={() => app.modal.show(() => import('flarum/forum/components/LogInModal'))}>
            {app.translator.trans('ernestdefoe-seamless-refresh.forum.sign_in')}
          </Button>,
        ],
      } as any,
      app.translator.trans('ernestdefoe-seamless-refresh.forum.session_ended')
    );
  };

  /** What the server says now, compared with what this page booted with. */
  const reconcile = (state: SessionState | null) => {
    if (!state) return 'unknown';

    const { userId: bootUserId, signature: bootSignature } = boot();

    if (bootUserId !== null && state.userId !== bootUserId) {
      showSessionEnded();
      return 'ended';
    }

    // Signed in elsewhere, promoted, demoted, granted something: the page is
    // showing a forum this member no longer has. Same quiet rule as new
    // assets: the next click loads the destination fresh.
    if (state.userId !== bootUserId || (bootSignature && state.signature !== bootSignature)) {
      (app as any).assetsRefreshPending = true;
    }

    return 'same';
  };

  const looksLikeEndedSession = (error: any): boolean => {
    if (boot().userId === null) return false; // a guest has no session to lose
    if (String(error?.options?.url || '').includes('/seamless-refresh/session')) return false;

    const code = error?.response?.errors?.[0]?.code;

    return (error?.status === 400 && code === 'csrf_token_mismatch') || error?.status === 401 || error?.status === 403;
  };

  override(
    (app as any).constructor.prototype,
    'requestErrorCatch',
    async function (this: any, original: Function, error: any, customErrorHandler: unknown) {
      if (!looksLikeEndedSession(error) || error.options?.seamlessRefreshRetried) {
        return original(error, customErrorHandler);
      }

      const outcome = reconcile(await askServer());

      if (outcome === 'ended') {
        return Promise.reject(error); // the notice says it once; no error alert on top
      }

      const code = error?.response?.errors?.[0]?.code;

      if (outcome === 'same' && code === 'csrf_token_mismatch') {
        // Same member, new token. Send it again: the config hook reads the
        // token at send time, so the retry carries the fresh one.
        error.options.seamlessRefreshRetried = true;

        return m.request(error.options).catch((again: any) => original(again, customErrorHandler));
      }

      return original(error, customErrorHandler);
    }
  );

  /*
   * 5. Coming back to a tab that sat in the background, or a phone restoring a
   * frozen page from its back/forward cache. Nothing has been asked of the
   * server meanwhile, so nothing knows the session ended or the forum changed.
   * One quiet question on return finds out — and as a side effect its
   * response headers also report newer assets, through step 1.
   */
  const STALE_AFTER_MS = 5 * 60 * 1000;
  let hiddenAt: number | null = null;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (hiddenAt !== null && Date.now() - hiddenAt >= STALE_AFTER_MS) {
      hiddenAt = null;
      askServer().then(reconcile);
    }
  });

  window.addEventListener('pageshow', (e: PageTransitionEvent) => {
    if (e.persisted) askServer().then(reconcile);
  });
});
