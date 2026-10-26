import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createStore } from "../tools/hot-profiles/storage.mjs";
import {
  discoverRuntime,
  runtimeConfig,
  startLocalAndroid,
} from "../tools/hot-profiles/android-runtime.mjs";

test("owned Android profiles receive distinct disk identities; another profile cannot claim one", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hp-runtime-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = await createStore(directory);
  const input = {
    kind: "android",
    name: "Celular vazio",
    deviceId: "runtime:new",
    notes: "",
    startUrls: [],
  };
  const a = await store.putProfile(input),
    b = await store.putProfile(input);
  assert.equal(a.deviceId, `runtime:${a.id}`);
  assert.equal(b.deviceId, `runtime:${b.id}`);
  assert.notEqual(a.deviceId, b.deviceId);
  await assert.rejects(store.putProfile({ ...input, deviceId: a.deviceId }), /próprio perfil/);
  await assert.rejects(
    store.putProfile({ ...input, deviceId: a.deviceId }, b.id),
    /próprio perfil/,
  );
  const updated = await store.putProfile(
    { ...input, deviceId: a.deviceId, name: "Renomeado" },
    a.id,
  );
  assert.equal(updated.deviceId, a.deviceId);
  const data = JSON.parse(await readFile(path.join(directory, "workspace.json"), "utf8"));
  assert.equal(data.profiles.find((p) => p.id === a.id).deviceId, a.deviceId);
  const configured = await store.putProfile(
    {
      ...input,
      deviceId: a.deviceId,
      androidSettings: { ramMb: 4096, cpuCores: 4, resolution: "360x640", memoryMode: "low" },
    },
    a.id,
  );
  const copied = await store.putProfile({
    ...configured,
    deviceId: "runtime:new",
    proxyId: null,
    name: "Cópia de configuração",
  });
  assert.deepEqual(copied.androidSettings, configured.androidSettings);
  assert.notEqual(copied.deviceId, configured.deviceId);
  assert.equal(copied.androidBinding, undefined);
  assert.equal(copied.proxyId, null);
});

test("SDK discovery reports prerequisites without creating devices or starting ADB", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hp-runtime-sdk-"));
  const previous = process.env.HOT_PROFILES_ANDROID_SDK;
  process.env.HOT_PROFILES_ANDROID_SDK = directory;
  t.after(async () => {
    if (previous === undefined) delete process.env.HOT_PROFILES_ANDROID_SDK;
    else process.env.HOT_PROFILES_ANDROID_SDK = previous;
    await rm(directory, { recursive: true, force: true });
  });
  assert.equal((await discoverRuntime()).available, false);
  const image = path.join(directory, "system-images/android-35/default/x86_64");
  await mkdir(image, { recursive: true });
  await mkdir(path.join(directory, "emulator"));
  await mkdir(path.join(directory, "platform-tools"));
  await writeFile(path.join(directory, "emulator/emulator.exe"), "fixture");
  await writeFile(path.join(directory, "platform-tools/adb.exe"), "fixture");
  await writeFile(path.join(image, "system.img"), "fixture");
  await writeFile(
    path.join(image, "source.properties"),
    "SystemImage.Abi=x86_64\nAndroidVersion.ApiLevel=35\nPkg.Desc=Empty test image\n",
  );
  const discovery = await discoverRuntime();
  assert.equal(discovery.available, true);
  assert.equal(discovery.image.api, "35");
  assert.equal(discovery.image.directory, image);
});

test("untrusted profile IDs cannot select writable runtime directories", async () => {
  for (const id of ["../personal", "C:/outside", "", "not-a-uuid"]) {
    await assert.rejects(
      startLocalAndroid({ id, deviceId: `runtime:${id}` }, ".", null),
      /Identidade/,
    );
  }
  assert.throws(() => runtimeConfig({ directory: "C:/image\nhw.ramSize=999999" }), /inválido/);
});
