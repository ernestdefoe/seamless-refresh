<?php

namespace ErnestDefoe\SeamlessRefresh\Api;

use ErnestDefoe\SeamlessRefresh\Signature;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET /api/seamless-refresh/session: who the browser is signed in as right now,
 * and a fingerprint of what they may do.
 *
 * Cheap on purpose: no queries beyond the actor's own groups and permissions,
 * which the request has loaded anyway. As a successful response it also
 * carries a fresh X-CSRF-Token header, which core stores, and that is what lets
 * a failed post be retried after the session was renewed behind the scenes.
 */
class SessionController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        return new JsonResponse([
            'userId' => $actor->isGuest() ? null : (int) $actor->id,
            'signature' => Signature::of($actor),
        ], 200, ['Cache-Control' => 'private, no-store']);
    }
}
