import test from "node:test";
import assert from "node:assert/strict";
import { instagramOAuthResult } from "../src/lib/instagram-oauth-result.ts";
test("isolated OAuth success is readable without a MauseHot session",async()=>{
 const result=instagramOAuthResult("connected");const html=await result.text();
 assert.equal(result.status,200);assert.equal(result.headers.get("location"),null);
 assert.match(html,/conectada/);assert.match(html,/aba original/);assert.doesNotMatch(html,/Google|<script/);
 assert.equal(result.headers.get("cache-control"),"no-store");assert.match(result.headers.get("content-security-policy"),/default-src 'none'/);
});
test("isolated OAuth failure and missing insights explain recovery, never reflect provider inputs",async()=>{
 const result=await instagramOAuthResult("connection_failed","state_validation").text();
 assert.match(result,/expirou/);assert.match(result,/Conectar Conta/);
 const warning=await instagramOAuthResult("insights_not_granted").text();assert.match(warning,/conectada/);assert.match(warning,/m.tricas/);
 const malicious=await instagramOAuthResult("<script>","<script>alert(1)</script>").text();assert.doesNotMatch(malicious,/<script|alert\(1\)/);
});
