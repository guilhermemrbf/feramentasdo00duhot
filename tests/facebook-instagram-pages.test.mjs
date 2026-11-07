import assert from "node:assert/strict";
import { test } from "node:test";
import { linkedFacebookInstagramPages } from "../src/lib/facebook-instagram-pages.ts";

test("Facebook Login keeps the Page token for each linked professional account", () => {
  const linked = linkedFacebookInstagramPages([
    {
      id: "page-1",
      name: "Brand Page",
      access_token: "page-token-1",
      instagram_business_account: { id: "ig-1", username: "brand", name: "Brand" },
    },
    {
      id: "page-2",
      access_token: "page-token-2",
      instagram_business_account: { id: "ig-2", username: "creator" },
    },
  ]);

  assert.deepEqual(
    linked.map((entry) => ({
      pageName: entry.pageName,
      pageAccessToken: entry.pageAccessToken,
      instagramUserId: entry.ig.id,
    })),
    [
      { pageName: "Brand Page", pageAccessToken: "page-token-1", instagramUserId: "ig-1" },
      { pageName: null, pageAccessToken: "page-token-2", instagramUserId: "ig-2" },
    ],
  );
});

test("Facebook Login ignores pages missing a Page token or complete professional profile", () => {
  const linked = linkedFacebookInstagramPages([
    { id: "page-no-token", instagram_business_account: { id: "ig-1", username: "brand" } },
    {
      id: "page-no-username",
      access_token: "page-token",
      instagram_business_account: { id: "ig-2" },
    },
    { id: "page-no-instagram", access_token: "page-token" },
  ]);

  assert.deepEqual(linked, []);
});
