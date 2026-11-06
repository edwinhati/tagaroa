import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  Controller,
  Get,
  Module,
  Query,
  UnauthorizedException,
  type INestApplication,
} from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";

import { ACCESS_CONTROL } from "../../modules/access-control/application/access-control.facade";
import { AccessControlGuard } from "../../modules/access-control/presentation/access-control.guard";
import { parseCollectionQuery, type QueryRecord } from "./collection";
import { SessionOnly } from "./session-only.decorator";

/**
 * The bodies a client sees when a request fails. There is no exception filter,
 * so this pins Nest's defaults for the exceptions core actually throws. The
 * schema 400 (with `details`) is covered in `schema-validation.test.ts`.
 */
@Controller("items")
class ItemsController {
  @Get()
  @SessionOnly()
  list(@Query() query: QueryRecord) {
    return parseCollectionQuery(query, { sortable: ["name"] });
  }

  // What the Better Auth guard throws when a request carries no session.
  @Get("signed-out")
  @SessionOnly()
  signedOut() {
    throw new UnauthorizedException();
  }

  @Get("broken")
  @SessionOnly()
  broken() {
    throw new Error("connection to postgres://user:secret@db failed");
  }
}

@Module({
  controllers: [ItemsController],
  providers: [
    { provide: ACCESS_CONTROL, useValue: { can: async () => false } },
    { provide: APP_GUARD, useClass: AccessControlGuard },
  ],
})
class ItemsModule {}

describe("error envelope over HTTP", () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    app = await NestFactory.create(ItemsModule, { logger: false });
    // Stands in for Better Auth, which puts the session on the request.
    app.use(
      (
        request: { headers: Record<string, string>; session?: unknown },
        _: unknown,
        next: () => void,
      ) => {
        if (request.headers["x-person"]) {
          request.session = { user: { id: request.headers["x-person"] } };
        }
        next();
      },
    );
    await app.listen(0);
    url = await app.getUrl();
  });

  afterAll(() => app.close());

  const get = async (path: string, person?: string) => {
    const response = await fetch(`${url}${path}`, {
      headers: person ? { "x-person": person } : {},
    });
    return { body: await response.json(), status: response.status };
  };

  test("a bad collection query is a 400 with Nest's default body", async () => {
    expect(await get("/items?sort=passwordHash", "ada")).toEqual({
      body: {
        error: "Bad Request",
        message: "Cannot sort by passwordHash.",
        statusCode: 400,
      },
      status: 400,
    });
  });

  test("bad paging falls back instead of failing", async () => {
    expect(await get("/items?page=-1&limit=1000", "ada")).toMatchObject({
      body: { limit: 100, page: 1 },
      status: 200,
    });
  });

  test("a missing session is a 401 without an error name", async () => {
    expect(await get("/items/signed-out", "ada")).toEqual({
      body: { message: "Unauthorized", statusCode: 401 },
      status: 401,
    });
  });

  test("a denied route is a 403 carrying a code instead of statusCode", async () => {
    expect(await get("/items")).toEqual({
      body: {
        code: "ACCESS_DENIED",
        message: "You do not have access to this resource.",
      },
      status: 403,
    });
  });

  test("an unknown error is a 500 that leaks nothing", async () => {
    expect(await get("/items/broken", "ada")).toEqual({
      body: { message: "Internal server error", statusCode: 500 },
      status: 500,
    });
  });
});
