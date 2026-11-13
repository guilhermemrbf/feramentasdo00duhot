import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverInstagramProfile } from "../src/lib/instagram-intelligence-discovery.server.ts";

const options = { version: "v27.0", accountId: "123", token: "fixture", username: "alvo" };

test("Business Discovery only forwards a bounded cursor to Meta and preserves coverage gaps", async () => {
  const calls = [];
  const result = await discoverInstagramProfile(options, async (url, init) => {
    calls.push(new URL(url));
    assert.equal(init.headers.Authorization, "Bearer fixture");
    assert.equal(init.redirect, "error");
    const page = calls.length;
    return Response.json({
      business_discovery: {
        username: "alvo",
        followers_count: 0,
        media: {
          data: [
            {
              permalink: "https://www.instagram.com/reel/clip" + page + "/?tracking=1",
              timestamp: "2026-11-12T12:00:00+0000",
              ...(page === 1
                ? {
                    view_count: 0,
                    like_count: 5,
                    media_url: "https://video.cdninstagram.com/a.mp4",
                  }
                : {}),
            },
            { permalink: "https://example.org/reel/fake/", timestamp: "2026-11-12T12:00:00Z" },
          ],
          paging:
            page === 1
              ? { next: "https://example.org/?access_token=no", cursors: { after: "page2" } }
              : undefined,
        },
      },
    });
  });
  assert.equal(result.status, "available");
  assert.equal(result.followers, 0);
  assert.deepEqual(
    result.reels.map(({ views, likes, videoUrl }) => [views, likes, videoUrl]),
    [
      [0, 5, "https://video.cdninstagram.com/a.mp4"],
      [null, null, null],
    ],
  );
  assert.equal(result.reels[0].url, "https://www.instagram.com/reel/clip1/");
  assert.equal(result.reels[0].publishedAt, "2026-11-12T12:00:00.000Z");
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.origin, "https://graph.facebook.com");
    assert.equal(call.pathname, "/v27.0/123");
    assert.equal(call.searchParams.has("access_token"), false);
  }
  assert.match(calls[1].searchParams.get("fields"), /media\.limit\(30\)\.after\(page2\)/);
});

test("Business Discovery returns safe failure categories and rejects injected usernames", async () => {
  for (const [http, code, status] of [
    [400, 190, "reauthorize"],
    [403, 10, "permission"],
    [400, 100, "unavailable"],
    [429, 4, "retry"],
    [503, 2, "retry"],
  ]) {
    assert.deepEqual(
      await discoverInstagramProfile(options, async () =>
        Response.json({ error: { code, message: "SECRET" } }, { status: http }),
      ),
      { status },
    );
  }
  assert.deepEqual(
    await discoverInstagramProfile(options, async () => Response.json({ id: "123" })),
    { status: "unavailable" },
  );
  await assert.rejects(
    discoverInstagramProfile({ ...options, username: "bad){field" }),
    /configuração/i,
  );
});
