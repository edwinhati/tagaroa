import { describe, expect, test } from "bun:test";

import {
  validateDeliverySearch,
  validateSuppressionSearch,
} from "../components/notifications/notification-console";
import { Route as NotificationsRoute } from "./_shell/notifications";
import { Route as NotificationsIndexRoute } from "./_shell/notifications/index";

describe("notification routing", () => {
  test("keeps the section route as an outlet", () => {
    expect(NotificationsRoute.options.beforeLoad).toBeUndefined();
  });

  test("redirects the section index to its overview", async () => {
    expect.assertions(1);

    try {
      await NotificationsIndexRoute.options.beforeLoad?.({
        search: {},
      } as never);
    } catch (redirect) {
      expect(redirect).toMatchObject({
        options: { to: "/notifications/overview" },
      });
    }
  });

  test("keeps old tab links useful", async () => {
    expect.assertions(1);

    try {
      await NotificationsIndexRoute.options.beforeLoad?.({
        search: { tab: "wording" },
      } as never);
    } catch (redirect) {
      expect(redirect).toMatchObject({
        options: { to: "/notifications/templates" },
      });
    }
  });

  test("validates delivery filters and URL pagination", () => {
    expect(
      validateDeliverySearch({
        channel: ["email", "pigeon"],
        page: "3",
        q: "ada@example.com",
        size: "50",
        status: ["failed"],
      }),
    ).toEqual({
      channel: ["email"],
      page: 3,
      q: "ada@example.com",
      size: 50,
      status: ["failed"],
    });
  });

  test("keeps suppression reasons separate from delivery statuses", () => {
    expect(
      validateSuppressionSearch({
        page: -2,
        reason: ["hard_bounce"],
        size: 17,
        status: ["failed"],
      }),
    ).toEqual({ reason: ["hard_bounce"] });
  });
});
