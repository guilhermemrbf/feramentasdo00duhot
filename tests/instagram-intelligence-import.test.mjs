import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInstagramProfiles } from "../src/lib/instagram-intelligence-import.ts";
import { findTool, searchTools } from "../src/lib/tool-catalog.ts";

test("the tool is reachable through the shared catalog", () => {
  assert.equal(findTool("/instagram-intelligence")?.id, "intelligence");
  assert.deepEqual(
    searchTools("Instagram Intelligence").map((tool) => tool.path),
    ["/instagram-intelligence"],
  );
});

test("normalizes and deduplicates profile links and handles in entry order", () => {
  assert.deepEqual(
    parseInstagramProfiles(
      "@Pri.Meiro\nHTTPS://www.instagram.com/pri.meiro/?igsh=tag,SEGUNDO; @Terceiro",
    ),
    {
      usernames: ["pri.meiro", "segundo", "terceiro"],
      duplicateCount: 1,
      invalidLines: [],
      error: null,
    },
  );
});

test("rejects publication paths, login URLs, impersonated origins and malformed handles", () => {
  const result = parseInstagramProfiles(
    [
      "https://www.instagram.com/reel/ABC",
      "https://instagram.com/accounts/",
      "https://instagram.com.evil.example/creator",
      "https://instagram.com@evil.example/creator",
      "https://www.instagram.com/abc%2fdef",
      "@abc..def",
      "@permitido",
    ].join("\n"),
  );
  assert.deepEqual(result.invalidLines, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(result.usernames, ["permitido"]);
});

test("accepts 1,000 distinct profiles and rejects an oversized list", () => {
  const profiles = Array.from({ length: 1_000 }, (_, i) => "@perfil_" + i);
  assert.equal(parseInstagramProfiles(profiles.join("\n")).usernames.length, 1_000);
  assert.equal(parseInstagramProfiles([...profiles, "@excedente"].join("\n")).error, "limit");
  assert.equal(parseInstagramProfiles("x".repeat(150_001)).error, "size");
});
