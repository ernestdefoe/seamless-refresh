<?php

namespace ErnestDefoe\SeamlessRefresh\Tests\integration\api;

use Flarum\Group\Group;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

class SessionTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-seamless-refresh');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'promoted', 'email' => 'promoted@machine.local', 'is_email_confirmed' => 1],
            ],
            'group_user' => [
                ['user_id' => 3, 'group_id' => Group::MODERATOR_ID],
            ],
        ]);
    }

    private function session(?int $actor = null): array
    {
        $response = $this->send($this->request('GET', '/api/seamless-refresh/session', $actor ? ['authenticatedAs' => $actor] : []));

        return [$response, json_decode((string) $response->getBody(), true)];
    }

    private function forumSignature(?int $actor = null): ?string
    {
        $response = $this->send($this->request('GET', '/api', $actor ? ['authenticatedAs' => $actor] : []));

        $this->assertSame(200, $response->getStatusCode());

        return json_decode((string) $response->getBody(), true)['data']['attributes']['seamlessRefreshSignature'] ?? null;
    }

    #[Test]
    public function a_guest_is_reported_as_nobody()
    {
        [$response, $body] = $this->session();

        $this->assertSame(200, $response->getStatusCode());
        $this->assertNull($body['userId']);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{16}$/', $body['signature']);
    }

    #[Test]
    public function a_member_is_reported_as_themselves()
    {
        [$response, $body] = $this->session(2);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(2, $body['userId']);
    }

    #[Test]
    public function the_answer_is_never_cached()
    {
        [$response] = $this->session(2);

        // A cached answer would tell a page it is still signed in as someone
        // else, or that its permissions have not changed.
        $this->assertStringContainsString('no-store', $response->getHeaderLine('Cache-Control'));
        $this->assertStringContainsString('private', $response->getHeaderLine('Cache-Control'));
    }

    #[Test]
    public function the_signature_differs_with_what_the_actor_may_do()
    {
        [, $guest] = $this->session();
        [, $member] = $this->session(2);
        [, $moderator] = $this->session(3);
        [, $admin] = $this->session(1);

        $signatures = [$guest['signature'], $member['signature'], $moderator['signature'], $admin['signature']];

        $this->assertCount(4, array_unique($signatures), 'Guest, member, moderator and admin each have their own fingerprint');
    }

    #[Test]
    public function the_signature_changes_when_a_member_is_promoted()
    {
        [, $before] = $this->session(2);

        $this->database()->table('group_user')->insert(['user_id' => 2, 'group_id' => Group::MODERATOR_ID]);

        [, $after] = $this->session(2);

        $this->assertNotSame($before['signature'], $after['signature']);
    }

    #[Test]
    public function the_signature_is_stable_for_the_same_actor()
    {
        [, $first] = $this->session(2);
        [, $second] = $this->session(2);

        $this->assertSame($first['signature'], $second['signature']);
    }

    #[Test]
    public function the_forum_payload_carries_the_same_signature_the_endpoint_reports()
    {
        foreach ([null, 2, 3, 1] as $actor) {
            [, $session] = $this->session($actor);

            $this->assertSame($session['signature'], $this->forumSignature($actor), 'Actor '.($actor ?? 'guest'));
        }
    }
}
