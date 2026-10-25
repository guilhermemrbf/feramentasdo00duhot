import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBlueStacks,
  endpointCandidates,
  androidDevices,
  localSerial,
} from "../tools/hot-profiles/android-discovery.mjs";
import { startAndroid } from "../tools/hot-profiles/android.mjs";

const config = (extra = "") =>
  parseBlueStacks(`bst.enable_adb_access="1"
bst.enable_adb_remote_access="0"
bst.instance.Pie64.adb_port="5555"
bst.instance.Pie64.status.adb_port="5555"
bst.instance.Pie64_4.adb_port="5595"
bst.instance.Pie64_4.status.adb_port="5555"
${extra}`);

test("BlueStacks stale status port cannot attach a second profile to the first Android", () => {
  const parsed = config();
  assert.deepEqual(endpointCandidates(parsed, parsed.instances[1]), [5595]);
  const devices = androidDevices(parsed, "List of devices attached\n127.0.0.1:5555\tdevice\n");
  assert.equal(devices.length, 2);
  assert.equal(devices[0].ready, true);
  assert.equal(devices[1].ready, false);
  assert.equal(devices[1].endpoint, null);
  assert.ok(devices[1].warnings.some((w) => w.includes("divergem")));
});

test("configuration and TCP candidates alone do not mean a device is online", () => {
  const devices = androidDevices(config(), "127.0.0.1:5555\toffline\n127.0.0.1:5595\tunauthorized");
  assert.ok(devices.every((d) => !d.ready && !d.endpoint));
  assert.deepEqual(devices[1].candidateEndpoints, ["127.0.0.1:5595"]);
});

test("two responding instances retain independent endpoints and stable instance IDs", () => {
  const devices = androidDevices(config(), "emulator-5554\tdevice\n127.0.0.1:5595\tdevice");
  assert.deepEqual(
    devices.map((d) => [d.id, d.endpoint]),
    [
      ["bluestacks:Pie64", "127.0.0.1:5555"],
      ["bluestacks:Pie64_4", "127.0.0.1:5595"],
    ],
  );
  assert.equal(devices[0].serial, "emulator-5554");
});

test("missing ports never fall back to 5555; config parser excludes secrets and unrelated fields", () => {
  const parsed = parseBlueStacks(
    'bst.instance.Missing.display_name="Android"\nbst.instance.Missing.adb_port="invalid"\nbst.secret="fixture-secret"',
  );
  const [device] = androidDevices(parsed, "127.0.0.1:5555\tdevice");
  assert.equal(device.port, null);
  assert.equal(device.ready, false);
  assert.equal(JSON.stringify(parsed).includes("fixture-secret"), false);
});

test("duplicate configured ports and ambiguous alternate ports are never assigned", () => {
  const parsed = config('bst.instance.Pie64_4.adb_port="5555"');
  assert.ok(androidDevices(parsed, "127.0.0.1:5555\tdevice").every((d) => !d.ready));
  const alternate = config(
    'bst.instance.Pie64.status.adb_port="5601"\nbst.instance.Pie64_4.status.adb_port="5601"',
  );
  assert.ok(androidDevices(alternate, "127.0.0.1:5601\tdevice").every((d) => !d.ready));
});

test("disabled BlueStacks ADB is explicit even when a matching stale device remains registered", () => {
  const parsed = config('bst.enable_adb_access="0"');
  assert.ok(
    androidDevices(parsed, "emulator-5554\tdevice").every((d) => !d.ready && !d.adbEnabled),
  );
});

test("local ADB aliases are deduplicated; network endpoints and invalid ports are rejected", () => {
  assert.equal(localSerial("emulator-5554"), "127.0.0.1:5555");
  for (const serial of [
    "10.0.0.1:5555",
    "127.0.0.1:65536",
    "emulator-65535",
    "127.0.0.1:0",
    "usb-device",
  ])
    assert.equal(localSerial(serial), null);
  const devices = androidDevices(
    { enabled: true, instances: [] },
    "emulator-5554\tdevice\n127.0.0.1:5555\tdevice\n10.0.0.1:5555\tdevice",
  );
  assert.equal(devices.length, 1);
  assert.equal(devices[0].id, "adb:127.0.0.1:5555");
});

test("two responding candidate ports require intervention instead of selecting the first", () => {
  const parsed = config('bst.instance.Pie64.status.adb_port="5601"');
  const devices = androidDevices(parsed, "127.0.0.1:5555\tdevice\n127.0.0.1:5601\tdevice");
  assert.equal(devices[0].ready, false);
  assert.ok(devices[0].warnings.some((w) => w.includes("ambíguo")));
});

function fakeAndroid(initial = "null") {
  let setting = initial;
  const calls = [];
  const dependencies = {
    findAdb: async () => "fixture-adb",
    discoverAndroid: async () => ({
      devices: [
        {
          id: "adb:127.0.0.1:5555",
          provider: "adb",
          serial: "emulator-5554",
          ready: true,
          adbEnabled: true,
        },
      ],
    }),
    adb: async (_binary, args) => {
      assert.deepEqual(args.slice(0, 2), ["-s", "emulator-5554"]);
      const command = args.slice(2);
      calls.push(command);
      if (command.join(" ") === "shell settings get global http_proxy") return setting;
      if (command.slice(0, 5).join(" ") === "shell settings put global http_proxy")
        setting = command[5];
      if (command.join(" ") === "shell settings delete global http_proxy") setting = "null";
      return "";
    },
  };
  return {
    dependencies,
    calls,
    read: () => setting,
    change: (value) => {
      setting = value;
    },
  };
}
const androidProfile = { deviceId: "adb:127.0.0.1:5555", hostAddress: "127.0.0.1", startUrls: [] };

test("Android reserves its actual endpoint before changing proxy; reports configuration without claiming device isolation", async () => {
  const fake = fakeAndroid();
  let binding;
  const runtime = await startAndroid(
    androidProfile,
    { port: 42001 },
    null,
    async (value) => {
      assert.equal(fake.calls.length, 0);
      binding = value;
    },
    fake.dependencies,
  );
  assert.equal(binding.endpoint, "127.0.0.1:5555");
  assert.equal(fake.read(), "127.0.0.1:42001");
  const network = await runtime.network();
  assert.equal(network.systemProxyMatches, true);
  assert.equal(network.deviceWideVerified, false);
  assert.equal(network.dnsVerified, false);
  assert.equal(network.failClosed, false);
  assert.equal(network.egressIp, null);
  await runtime.stop();
  assert.equal(fake.read(), "null");
  assert.ok(fake.calls.some((call) => call.join(" ") === "reverse --remove tcp:42001"));
});

test("a conflicting Android reservation prevents all proxy and reverse mutations", async () => {
  const fake = fakeAndroid();
  await assert.rejects(
    startAndroid(
      androidProfile,
      { port: 42001 },
      null,
      async () => {
        throw new Error("endpoint already reserved");
      },
      fake.dependencies,
    ),
    /already reserved/,
  );
  assert.equal(fake.calls.length, 0);
});

test("invalid ADB alias never resolves to an unconnected BlueStacks instance", async () => {
  const fake = fakeAndroid();
  fake.dependencies.discoverAndroid = async () => ({
    devices: [{ id: "bluestacks:Pie64", endpoint: null, ready: false, adbEnabled: true }],
  });
  await assert.rejects(
    startAndroid(
      { ...androidProfile, deviceId: "adb:invalid" },
      null,
      null,
      undefined,
      fake.dependencies,
    ),
    /não foi encontrada/,
  );
  assert.equal(fake.calls.length, 0);
});

test("Android restoration preserves earlier settings and respects a subsequent manual change", async () => {
  for (const changed of [false, true]) {
    const fake = fakeAndroid("10.0.2.2:8888");
    const runtime = await startAndroid(
      androidProfile,
      { port: 42001 },
      null,
      undefined,
      fake.dependencies,
    );
    if (changed) fake.change("10.0.2.2:9999");
    assert.equal((await runtime.network()).systemProxyMatches, !changed);
    await runtime.stop();
    assert.equal(fake.read(), changed ? "10.0.2.2:9999" : "10.0.2.2:8888");
  }
});

test("starting Android without a managed proxy leaves existing instance networking untouched", async () => {
  const fake = fakeAndroid("10.0.2.2:8888");
  const runtime = await startAndroid(androidProfile, null, null, undefined, fake.dependencies);
  await runtime.stop();
  assert.equal(fake.calls.length, 0);
  const report = await runtime.network();
  assert.equal(report.mode, "unmanaged");
  assert.equal(report.systemProxyMatches, null);
  assert.equal(JSON.stringify(report).includes("10.0.2.2"), false);
});
