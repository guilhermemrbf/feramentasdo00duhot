import test from "node:test";
import assert from "node:assert/strict";
import { validateInstagramLogin, createInstagramLoginManager } from "../tools/hot-profiles/instagram-login.mjs";
const origin = "https://feramentasdo00duhot.lovable.app";
const state = "signed-test-state";
const request = () => ({ authorizationUrl: `https://www.instagram.com/oauth/authorize?state=${state}&redirect_uri=${encodeURIComponent(origin + "/api/instagram/oauth/callback")}`, cookie: { name: "__Host-instagram-oauth", value: state, url: origin, maxAge: 600 } });
test("only provider OAuth and matching same-origin callback cookie are accepted", () => {
  assert.equal(validateInstagramLogin(request(), origin).cookie.httpOnly, true);
  for (const mutate of [x=>x.authorizationUrl="https://evil.test/", x=>x.cookie.url="https://other.test", x=>x.cookie.name="session", x=>x.cookie.value="other", x=>x.cookie.maxAge=99999]) {
    const input=request(); mutate(input); assert.throws(()=>validateInstagramLogin(input,origin));
  }
  assert.throws(()=>validateInstagramLogin(request(), "https://unrelated.test"));
});
test("each connection has a fresh visible browser and only an OAuth cookie, bounded to one at a time", async () => {
  const launches=[]; let closed;
  const manager=createInstagramLoginManager({directory:"test-dir", start:async (...args)=>{launches.push(args);closed=args[3];return {stop:async()=>closed()};}});
  const first=await manager.open(request(),origin);
  await assert.rejects(manager.open(request(),origin),/Feche/);
  await manager.close();
  const second=await manager.open(request(),origin);
  assert.notEqual(first.sessionId,second.sessionId);
  assert.equal(launches[0][5].visible,true);
  assert.equal(launches[0][5].cookies.length,1);
  assert.equal(launches[0][0].startUrls[0],request().authorizationUrl);
  await manager.close();
});
