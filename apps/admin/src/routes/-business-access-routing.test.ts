import { describe, expect, test } from "bun:test";

import { Route as IdentityAccessRoute } from "./_shell/identity-access";
import { Route as BusinessAccessRoute } from "./_shell/identity-access/business-access";
import { Route as BusinessAccessIndexRoute } from "./_shell/identity-access/business-access/index";
import { Route as IdentityAccessIndexRoute } from "./_shell/identity-access/index";
import { Route as IdentityAccessPeopleRoute } from "./_shell/identity-access/people";
import { Route as RetiredPolicyRoute } from "./_shell/identity-access/policy";
import { Route as LegacyPeopleRoute } from "./_shell/people";
import { Route as LegacyPersonRoute } from "./_shell/people.$personId";
import { Route as LegacyPeopleIndexRoute } from "./_shell/people/index";
import { Route as LegacyPolicyRoute } from "./_shell/policy";
import { Route as LegacySettingsRoute } from "./_shell/settings";

describe("identity and access routing", () => {
  test.each([RetiredPolicyRoute, LegacyPolicyRoute, LegacySettingsRoute])(
    "redirects retired policy routes to privileged access",
    async (route) => {
      expect.assertions(1);

      try {
        await route.options.beforeLoad?.({} as never);
      } catch (redirect) {
        expect(redirect).toMatchObject({
          options: { to: "/identity-access/privileged-access" },
        });
      }
    },
  );

  test("keeps parent routes as outlets so child pages do not loop", () => {
    expect(IdentityAccessRoute.options.beforeLoad).toBeUndefined();
    expect(BusinessAccessRoute.options.beforeLoad).toBeUndefined();
    expect(IdentityAccessPeopleRoute.options.beforeLoad).toBeUndefined();
    expect(LegacyPeopleRoute.options.beforeLoad).toBeUndefined();
  });

  test("redirects the identity and access index to the work queue", async () => {
    expect.assertions(1);

    try {
      await IdentityAccessIndexRoute.options.beforeLoad?.({} as never);
    } catch (redirect) {
      expect(redirect).toMatchObject({
        options: { to: "/identity-access/work-queue" },
      });
    }
  });

  test("redirects only the business access index to assignments", async () => {
    expect.assertions(1);

    try {
      await BusinessAccessIndexRoute.options.beforeLoad?.({} as never);
    } catch (redirect) {
      expect(redirect).toMatchObject({
        options: {
          to: "/identity-access/business-access/assignments",
        },
      });
    }
  });

  test("preserves a legacy People search during the redirect", async () => {
    expect.assertions(1);

    try {
      await LegacyPeopleIndexRoute.options.beforeLoad?.({
        search: { q: "ada" },
      } as never);
    } catch (redirect) {
      expect(redirect).toMatchObject({
        options: {
          search: { q: "ada" },
          to: "/identity-access/people",
        },
      });
    }
  });

  test("preserves a legacy person link during the redirect", async () => {
    expect.assertions(1);

    try {
      await LegacyPersonRoute.options.beforeLoad?.({
        params: { personId: "person-1" },
        search: { page: 2 },
      } as never);
    } catch (redirect) {
      expect(redirect).toMatchObject({
        options: {
          params: { personId: "person-1" },
          search: { page: 2 },
          to: "/identity-access/people/$personId",
        },
      });
    }
  });
});
