import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { type INestApplication, Module } from "@nestjs/common";
import { APP_PIPE, NestFactory } from "@nestjs/core";

import { schemaValidation } from "../../../platform/http/schema-validation";
import { AssembleAdminDashboardUseCase } from "../application/use-cases/assemble-admin-dashboard.use-case";
import { GetGroupDirectoryUseCase } from "../application/use-cases/get-group-directory.use-case";
import { GetMyDirectoryProfileUseCase } from "../application/use-cases/get-my-directory-profile.use-case";
import { ListLinkedAccountsUseCase } from "../application/use-cases/list-linked-accounts.use-case";
import { ManagePositionUseCase } from "../application/use-cases/manage-position.use-case";
import { ReadPersonalEmailUseCase } from "../application/use-cases/read-personal-email.use-case";
import { RecordAccessReviewUseCase } from "../application/use-cases/record-access-review.use-case";
import { DirectoryController } from "./directory.controller";

const saved: unknown[] = [];

// Roles and the session guard are not mounted: this checks body parsing only,
// so the global schema pipe `AppModule` binds is bound here the same way.
@Module({
  controllers: [DirectoryController],
  providers: [
    { provide: APP_PIPE, useValue: schemaValidation },
    {
      provide: ManagePositionUseCase,
      useValue: { save: async (input: unknown) => (saved.push(input), input) },
    },
    ...[
      AssembleAdminDashboardUseCase,
      GetGroupDirectoryUseCase,
      GetMyDirectoryProfileUseCase,
      ListLinkedAccountsUseCase,
      ReadPersonalEmailUseCase,
      RecordAccessReviewUseCase,
    ].map((provide) => ({ provide, useValue: {} })),
  ],
})
class DirectoryHttpModule {}

describe("DirectoryController position bodies over HTTP", () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(DirectoryHttpModule, { logger: false });
    app.use((request: { session?: unknown }, _: unknown, next: () => void) => {
      request.session = { user: { id: "operator" } };
      next();
    });
    await app.listen(0);
    base = `${await app.getUrl()}/directory/positions`;
  });

  afterAll(() => app.close());

  const put = (path: string, body: unknown) =>
    fetch(`${base}/${path}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

  test("a bad body is a 400 with message and field details", async () => {
    for (const path of ["group/ada", "subsidiaries/org-1/ada"]) {
      const response = await put(path, { managerUserId: 5, title: " " });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        details: [
          { field: "title", message: "Title is required." },
          { field: "managerUserId", message: "Manager must be a person ID." },
        ],
        error: "Bad Request",
        message: "Title is required.",
        statusCode: 400,
      });
    }
    expect(saved).toEqual([]);
  });

  test("a valid body reaches the use case parsed", async () => {
    expect(
      (await put("group/ada", { managerUserId: "", title: " Engineer " }))
        .status,
    ).toBe(200);
    expect(
      (
        await put("subsidiaries/org-1/ada", {
          managerUserId: "grace",
          title: "Lead",
        })
      ).status,
    ).toBe(200);
    expect(saved).toEqual([
      {
        actorId: "operator",
        managerUserId: null,
        organizationId: null,
        title: "Engineer",
        userId: "ada",
      },
      {
        actorId: "operator",
        managerUserId: "grace",
        organizationId: "org-1",
        title: "Lead",
        userId: "ada",
      },
    ]);
  });
});
