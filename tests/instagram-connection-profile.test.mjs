import test from "node:test";
import assert from "node:assert/strict";
import {
  readInstagramConnectionProfile,
  instagramProfilePicture,
} from "../src/lib/instagram-connection-profile.ts";

const input = {
  instagramUserId: "123",
  accessToken: "fixture-private-token",
  graphBaseUrl: "https://graph.facebook.com/v27.0",
};

test("profile lookup uses the official account ID and a server bearer header, with optional photo", async () => {
  const profile = await readInstagramConnectionProfile(input, async (url, options) => {
    assert.equal(url.origin + url.pathname, input.graphBaseUrl + "/123");
    assert.equal(url.searchParams.has("access_token"), false);
    assert.equal(options.headers.Authorization, "Bearer " + input.accessToken);
    assert.equal(options.cache, "no-store");
    return Response.json({
      id: "123",
      username: "jane.fixture",
      name: "Perfil de teste",
      profile_picture_url: "https://scontent.cdninstagram.com/photo.jpg?oh=public-cdn-signature",
    });
  });
  assert.equal(profile.instagramUserId, "123");
  assert.equal(profile.username, "jane.fixture");
  assert.match(profile.pictureUrl, /^https:/);
  assert.equal(JSON.stringify(profile).includes(input.accessToken), false);
});

test("missing or disallowed photos remain unavailable instead of exposing credentials or foreign hosts", async () => {
  for (const value of [
    undefined,
    "javascript:alert(1)",
    "http://cdninstagram.com/x",
    "https://cdninstagram.com.evil.test/x",
    "https://cdninstagram.com/x?access_token=secret",
    "https://user:pass@cdninstagram.com/x",
    "data:image/png;base64,x",
  ])
    assert.equal(instagramProfilePicture(value), null);
  const profile = await readInstagramConnectionProfile(input, async () =>
    Response.json({ id: "123", username: "fixture" }),
  );
  assert.equal(profile.pictureUrl, null);
  assert.equal(profile.name, null);
});

test("optional fields retry once with identity only and do not invalidate publishing consent", async () => {
  const fields = [];
  const profile = await readInstagramConnectionProfile(input, async (url) => {
    fields.push(url.searchParams.get("fields"));
    return fields.length === 1
      ? Response.json(
          { error: { code: 100, message: "provider message must not escape" } },
          { status: 400 },
        )
      : Response.json({ id: "123", username: "fixture" });
  });
  assert.deepEqual(fields, ["id,username,name,profile_picture_url", "id,username"]);
  assert.equal(profile.pictureUrl, null);
});

test("invalid authorizations are terminal, sanitized, and never retried", async () => {
  let requests = 0;
  await assert.rejects(
    readInstagramConnectionProfile(input, async () => {
      requests++;
      return Response.json({ error: { code: 190, message: input.accessToken } }, { status: 400 });
    }),
    (e) => e.reason === "authorization_invalid" && !e.message.includes(input.accessToken),
  );
  assert.equal(requests, 1);
});

test("transport and rate-limit errors preserve an unknown outcome instead of declaring a revoked account", async () => {
  for (const request of [
    async () => {
      throw new Error(input.accessToken);
    },
    async () => Response.json({}, { status: 429 }),
    async () => Response.json({}, { status: 503 }),
  ])
    await assert.rejects(
      readInstagramConnectionProfile(input, request),
      (e) => e.reason === "network" && !e.message.includes(input.accessToken),
    );
});

test("identity mismatches, malformed responses and untrusted Graph destinations fail closed", async () => {
  for (const body of [
    { id: "999", username: "fixture" },
    { id: "123" },
    { id: "123", username: "<script>" },
    null,
  ])
    await assert.rejects(
      readInstagramConnectionProfile(input, async () => Response.json(body)),
      (e) => e.reason === "invalid_response",
    );
  let requested = false;
  await assert.rejects(
    readInstagramConnectionProfile(
      { ...input, graphBaseUrl: "https://evil.test/v27.0" },
      async () => {
        requested = true;
      },
    ),
    (e) => e.reason === "invalid_response",
  );
  assert.equal(requested, false);
});
