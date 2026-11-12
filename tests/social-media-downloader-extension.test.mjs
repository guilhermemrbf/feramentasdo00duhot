import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const base = new URL("../apps/social-media-downloader-extension/", import.meta.url);
const read = (name) => readFileSync(new URL(name, base), "utf8");

function helpers() {
  const context = { URL };
  runInNewContext(read("shared.js"), context);
  return context.MediaGrab;
}

test("manifest V3 requests only local action and download privileges", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "downloads"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background.service_worker, "background.js");
});

test("platform detection rejects forged hosts and HTTP", () => {
  const h = helpers();
  assert.equal(h.platform("https://www.instagram.com/reel/a/"), "instagram");
  assert.equal(h.platform("https://www.tiktok.com/@user/video/100"), "tiktok");
  assert.equal(h.platform("https://instagram.com.evil.example/p/a"), null);
  assert.equal(h.platform("http://www.instagram.com/p/a"), null);
});

test("safe media URL rejects blob, data, local files and embedded credentials", () => {
  const h = helpers();
  assert.equal(h.safeUrl("blob:https://www.tiktok.com/a"), null);
  assert.equal(h.safeUrl("data:video/mp4;base64,AAAA"), null);
  assert.equal(h.safeUrl("file:///video.mp4"), null);
  assert.equal(h.safeUrl("javascript:alert(1)"), null);
  assert.equal(h.safeUrl("https://name:pass@example.org/file"), null);
  assert.equal(h.safeUrl("https://cdn.example.org/video.mp4"), "https://cdn.example.org/video.mp4");
});

test("filenames have safe folders, stable IDs and correct formats", () => {
  const h = helpers();
  assert.equal(
    h.filename("https://www.instagram.com/reel/ABC123/", "video", 2, "https://cdn.example.org/video.mp4?token=x"),
    "00-do-hot/instagram/ABC123-video-02.mp4"
  );
  assert.equal(
    h.filename("https://www.tiktok.com/@u/photo/123", "image", 1, "https://cdn.example.org/img.webp"),
    "00-do-hot/tiktok/123-image-01.webp"
  );
  assert.throws(() => h.filename("https://www.tiktok.com/@u/video/123", "video", 0, "https://cdn.example.org/a.mp4"));
});

test("DOM scanner deduplicates images, filters tiny avatars and reports blob videos", () => {
  const h = helpers();
  function img(url, size) {
    return {
      tagName:"IMG",currentSrc:url,src:url,naturalWidth:size,naturalHeight:size,
      getBoundingClientRect:()=>({width:size,height:size}),closest:()=>({})
    };
  }
  const video = {
    tagName:"VIDEO",currentSrc:"blob:https://www.instagram.com/abc",src:"",
    getAttribute:()=>null,querySelectorAll:()=>[],closest:()=>({})
  };
  const dom = {querySelectorAll:()=>[
    img("https://cdn.example.org/photo.jpg",600), img("https://cdn.example.org/photo.jpg",600),
    img("https://cdn.example.org/avatar.jpg",64), video
  ]};
  const result = h.scan(dom,"https://www.instagram.com/p/ABC/");
  assert.equal(result.length,2);
  assert.equal(result[0].kind,"image");
  assert.equal(result[0].available,true);
  assert.equal(result[1].kind,"video");
  assert.equal(result[1].available,false);
  assert.match(result[1].reason,/blob:/);
});

test("background dispatches an authorized download via Chrome API", async () => {
  const h = helpers();
  let listener, received;
  const chrome = {
    runtime:{id:"extension",onMessage:{addListener(fn){listener=fn;}}},
    downloads:{async download(args){received=args;return 42;}}
  };
  runInNewContext(read("background.js"),{URL,chrome,MediaGrab:h,importScripts(){}});
  const reply = await new Promise(resolve => {
    assert.equal(listener({
      type:"MEDIA_GRAB_DOWNLOAD",page:"https://www.tiktok.com/@u/video/123",
      kind:"video",index:1,url:"https://cdn.example.org/123.mp4"
    },{id:"extension"},resolve),true);
  });
  assert.equal(reply.ok,true);
  assert.equal(reply.id,42);
  assert.equal(received.filename,"00-do-hot/tiktok/123-video-01.mp4");
});

test("all JavaScript files parse", () => {
  for (const file of ["shared.js","content.js","background.js","popup.js"]) {
    assert.doesNotThrow(()=>new Function(read(file)),file);
  }
});
