import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { driveFolderId, DrivePublishError } from "../src/lib/instagram-drive.ts";
import { createDriveReader, verifyDriveVideoStream } from "../src/lib/instagram-drive.server.ts";
import { runInstagramPublishStep } from "../src/lib/instagram-publish-step.ts";
import {
  cleanupDriveStaging,
  stageDriveReel,
} from "../src/lib/instagram-drive-publishing.server.ts";

const folder = "TestDriveFolderId";
const marker = "MOUSEHOT-" + "a".repeat(32);
const sample = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from("ftypisomreel")]);
const file = {
  id: "MockPrivateFile1",
  name: "reel.mp4",
  mimeType: "video/mp4",
  size: String(sample.length),
  parents: [folder],
  md5Checksum: createHash("md5").update(sample).digest("hex"),
  headRevisionId: "0B_test_revision",
  capabilities: { canDownload: true },
};
const expected = {
  file_id: file.id,
  revision: file.headRevisionId,
  checksum: file.md5Checksum,
  size_bytes: sample.length,
  filename: file.name,
  mime: file.mimeType,
};
const folderResource = {
  id: folder,
  name: "Reels privados",
  mimeType: "application/vnd.google-apps.folder",
};

test("Drive folder IDs only come from the official folder URL", () => {
  const tail = "/drive/u/0/folders/" + folder;
  assert.equal(driveFolderId("https://drive.google.com" + tail + "?usp=sharing"), folder);
  assert.equal(driveFolderId("https://drive.google.com.evil.test" + tail), null);
  assert.equal(driveFolderId("https://user@drive.google.com" + tail), null);
  assert.equal(driveFolderId("https://drive.google.com/file/d/SomeVideoId/view"), null);
});

test("folder proof gates listing and sync reads all pages without copying binaries", async () => {
  const calls = [];
  const reader = createDriveReader(
    async () => "fixture-token",
    async (url, options) => {
      assert.equal(url.hostname, "www.googleapis.com");
      assert.equal(options.headers.Authorization, "Bearer fixture-token");
      calls.push(url);
      if (url.pathname.endsWith("/" + folder)) return Response.json(folderResource);
      if (url.searchParams.get("q").includes("name = "))
        return Response.json({ files: [{ name: marker }] });
      if (!url.searchParams.has("pageToken"))
        return Response.json({ files: [file], nextPageToken: "next" });
      return Response.json({
        files: [
          { ...file, id: "AnotherReelFile", parents: ["OtherFolder"] },
          { ...file, id: "CannotDownload", capabilities: { canDownload: false } },
          { ...file, id: "ValidSecondReel", name: "reel2.mp4" },
        ],
      });
    },
  );
  const result = await reader.scan(folder, marker);
  assert.deepEqual(result, {
    name: "Reels privados",
    skipped: 2,
    files: [expected, { ...expected, file_id: "ValidSecondReel", filename: "reel2.mp4" }],
  });
  assert.equal(calls.length, 4);
  assert.ok(calls.every((url) => !url.searchParams.has("alt")));

  const denied = createDriveReader(
    async () => "fixture-token",
    async (url) => {
      if (url.pathname.endsWith("/" + folder)) return Response.json(folderResource);
      assert.ok(url.searchParams.get("q").includes("name = "));
      return Response.json({ files: [] });
    },
  );
  await assert.rejects(denied.scan(folder, marker), /Crie a subpasta/);
});

test("the scheduled file must still be in the linked folder and match its saved revision", async () => {
  let metadata = file;
  let mediaCalls = 0;
  const reader = createDriveReader(
    async () => "fixture-token",
    async (url) => {
      if (url.searchParams.get("alt") === "media") {
        mediaCalls++;
        return new Response(sample);
      }
      return metadata ? Response.json(metadata) : new Response(null, { status: 404 });
    },
  );
  const signal = AbortSignal.timeout(5000);
  const received = await reader.download(folder, expected, signal);
  assert.deepEqual(Buffer.from(await new Response(received).arrayBuffer()), sample);
  metadata = { ...file, headRevisionId: "replacement" };
  await assert.rejects(reader.download(folder, expected, signal), { code: "drive_changed" });
  metadata = { ...file, parents: ["SomeOtherFolder"] };
  await assert.rejects(reader.download(folder, expected, signal), { code: "drive_unavailable" });
  metadata = undefined;
  await assert.rejects(reader.download(folder, expected, signal), { code: "drive_unavailable" });
  assert.equal(mediaCalls, 1);
});

test("validates the MP4 signature and rejects bytes changed during streaming", async () => {
  const pieces = new ReadableStream({
    start(controller) {
      controller.enqueue(sample.subarray(0, 6));
      controller.enqueue(sample.subarray(6));
      controller.close();
    },
  });
  assert.deepEqual(
    Buffer.from(await new Response(verifyDriveVideoStream(pieces, expected)).arrayBuffer()),
    sample,
  );
  const different = Buffer.from(sample).fill(0, 8, 10);
  await assert.rejects(
    new Response(verifyDriveVideoStream(new Response(different).body, expected)).arrayBuffer(),
    { code: "drive_changed" },
  );
  const notVideo = Buffer.alloc(sample.length);
  await assert.rejects(
    new Response(
      verifyDriveVideoStream(new Response(notVideo).body, {
        ...expected,
        checksum: createHash("md5").update(notVideo).digest("hex"),
      }),
    ).arrayBuffer(),
    { code: "drive_transfer" },
  );
});

test("a missing Drive file records the failure and never calls publication", async () => {
  const checkpoints = [];
  const result = await runInstagramPublishStep(
    { publish_phase: "create", meta_container_id: null },
    {
      createContainer: async () => {
        throw new DrivePublishError("drive_unavailable");
      },
      readStatus: async () => assert.fail("no container was created"),
      publish: async () => assert.fail("no publication can start"),
      checkpoint: async (value) => {
        checkpoints.push(value);
      },
    },
  );
  assert.equal(result, "failed");
  assert.deepEqual(checkpoints, [{ outcome: "failed", errorCode: "drive_unavailable" }]);
});

test("worker copies one scoped Drive video, signs it for Meta and deletes the temporary object", async () => {
  const post = {
    id: "fixture-post",
    workspace_id: "fixture-workspace",
    instagram_account_id: "fixture-account",
    media_asset_id: "fixture-media",
    worker_lease_id: "fixture-lease",
  };
  const path = "fixture-workspace/fixture-post/fixture-lease.mp4";
  const requests = [];
  let linked = true;
  const db = createClient("https://supabase.fixture.test", "fixture-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (target, init) => {
        const url = new URL(target);
        const method = init.method ?? "GET";
        requests.push([method, url.pathname]);
        if (
          url.pathname.endsWith("/instagram_drive_files") ||
          url.pathname.endsWith("/instagram_drive_sources")
        ) {
          assert.equal(url.searchParams.get("workspace_id"), "eq.fixture-workspace");
          assert.equal(url.searchParams.get("account_id"), "eq.fixture-account");
          if (url.pathname.endsWith("/instagram_drive_files")) {
            assert.equal(url.searchParams.get("media_asset_id"), "eq.fixture-media");
            return Response.json([{ ...expected, folder_id: folder }]);
          }
          return Response.json(linked ? [{ folder_id: folder }] : []);
        }
        if (url.pathname.endsWith("/instagram_drive_staging")) {
          if (method === "POST") {
            assert.deepEqual(JSON.parse(init.body), { path, post_id: post.id });
            return new Response(null, { status: 201 });
          }
          if (method === "DELETE") return new Response(null, { status: 204 });
          assert.equal(url.searchParams.get("post_id"), "eq.fixture-post");
          return Response.json([{ path }]);
        }
        if (url.pathname.endsWith("/object/postkit-drive-staging/" + path)) {
          assert.equal(method, "POST");
          assert.equal(init.duplex, "half");
          assert.deepEqual(Buffer.from(await new Response(init.body).arrayBuffer()), sample);
          return Response.json({ Key: "postkit-drive-staging/" + path });
        }
        if (url.pathname.endsWith("/object/sign/postkit-drive-staging/" + path)) {
          assert.equal(JSON.parse(init.body).expiresIn, 3600);
          return Response.json({
            signedURL: "/object/sign/postkit-drive-staging/" + path + "?token=test",
          });
        }
        if (url.pathname.endsWith("/object/postkit-drive-staging")) {
          assert.equal(method, "DELETE");
          assert.deepEqual(JSON.parse(init.body).prefixes, [path]);
          return Response.json([{ name: path }]);
        }
        return Response.json({ message: "Unexpected fixture request" }, { status: 404 });
      },
    },
  });
  const reader = {
    async download(folderId, resource) {
      assert.equal(folderId, folder);
      assert.equal(resource.revision, expected.revision);
      return new Response(sample).body;
    },
  };
  const signed = await stageDriveReel(db, post, "video/mp4", reader);
  assert.match(
    signed,
    /postkit-drive-staging\/fixture-workspace\/fixture-post\/fixture-lease\.mp4\?token=test$/,
  );
  assert.equal(await cleanupDriveStaging(db, post.id), true);
  assert.deepEqual(
    requests.slice(-3).map(([method]) => method),
    ["GET", "DELETE", "DELETE"],
  );
  linked = false;
  await assert.rejects(stageDriveReel(db, post, "video/mp4", reader), {
    code: "drive_unavailable",
  });
});
