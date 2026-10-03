<?php

namespace ErnestDefoe\SeamlessRefresh;

use Flarum\User\User;

/**
 * A short fingerprint of what a member may do: their groups and permissions.
 * When it changes under an open tab (promoted, demoted, a permission granted),
 * that tab is showing a forum the member no longer has.
 */
final class Signature
{
    public static function of(User $actor): string
    {
        $groups = $actor->isGuest() ? [] : $actor->groups->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $permissions = $actor->getPermissions();
        sort($permissions);

        return substr(sha1(json_encode([$groups, $permissions, $actor->isAdmin()])), 0, 16);
    }
}
