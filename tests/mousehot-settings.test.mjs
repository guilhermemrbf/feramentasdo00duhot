import test from "node:test";
import assert from "node:assert/strict";
import { dashboardGreeting } from "../src/lib/dashboard-greeting.ts";
import { readMouseHotSettings } from "../src/lib/mousehot-settings.ts";
import {
  readMouseHotNoticePreferences,
  mouseHotDashboardName,
} from "../src/lib/mousehot-notice-preferences.ts";

test("notification preferences accept supported values and ignore malformed saved data", () => {
  const defaults = readMouseHotNoticePreferences();
  assert.equal(defaults.salesAmount, "net");
  assert.deepEqual(defaults.reportHours, []);
  assert.equal(defaults.metaThreshold, 10);
  assert.deepEqual(
    readMouseHotNoticePreferences({
      mousehot_notice_preferences: {
        reportHours: [23, 8, 12, 8, 24, "18"],
        reportStyle: "detailed",
        metaCurrency: "USD",
        metaThreshold: 12.259,
        showProduct: true,
        pendingSales: "yes",
      },
    }),
    {
      ...defaults,
      reportHours: [8, 12, 23],
      reportStyle: "detailed",
      metaCurrency: "USD",
      metaThreshold: 12.26,
      showProduct: true,
    },
  );
  assert.deepEqual(readMouseHotNoticePreferences({ mousehot_notice_preferences: 42 }), defaults);
  assert.equal(
    mouseHotDashboardName({ mousehot_dashboard_name: "  Minha operação  " }),
    "Minha operação",
  );
  assert.equal(mouseHotDashboardName({ mousehot_dashboard_name: "   " }), "MouseHot");
});

test("personal settings preserve existing defaults and ignore unsupported values", () => {
  assert.deepEqual(readMouseHotSettings(), {
    displayName: "",
    period: null,
    showToolShortcuts: true,
  });
  assert.deepEqual(
    readMouseHotSettings({
      mousehot_display_name: "  Scale Up  ",
      mousehot_dashboard_period: "7d",
      mousehot_show_tool_shortcuts: false,
    }),
    { displayName: "Scale Up", period: "7d", showToolShortcuts: false },
  );
  assert.equal(readMouseHotSettings({ mousehot_dashboard_period: "all" }).period, null);
  assert.equal(
    readMouseHotSettings({ mousehot_show_tool_shortcuts: "false" }).showToolShortcuts,
    true,
  );
});

test("the saved display name takes priority over the login provider and default admin greeting", () => {
  const now = new Date("2026-11-24T14:00:00Z");
  assert.equal(
    dashboardGreeting(
      now,
      {
        email: "scaleupperformance@gmail.com",
        user_metadata: { given_name: "Guilherme", mousehot_display_name: "Gui Rocha" },
      },
      true,
    ),
    "Bom dia, Gui!",
  );
});
