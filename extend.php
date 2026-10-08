<?php

namespace ErnestDefoe\SeamlessRefresh;

use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js'),

    new Extend\Locales(__DIR__.'/locale'),

    // The fingerprint the page booted with, to compare against later.
    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Str::make('seamlessRefreshSignature')
                ->get(fn ($model, Context $context) => Signature::of($context->getActor())),
        ]),

    (new Extend\Routes('api'))
        ->get('/seamless-refresh/session', 'seamless-refresh.session', Api\SessionController::class),
];
