import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Post,
  Query,
  type INestApplication,
} from "@nestjs/common";
import { APP_PIPE, NestFactory } from "@nestjs/core";
import * as z from "zod";

import { parseWith, schemaValidation } from "./schema-validation";

const person = z.object({
  name: z.string({ error: "Name is required." }).min(1, "Name is required."),
  age: z.number({ error: "Age must be a number." }),
});

const rejection = async (pending: Promise<unknown>) => {
  try {
    await pending;
  } catch (thrown) {
    return thrown;
  }
  throw new Error("Expected a rejection");
};

describe("parseWith", () => {
  test("returns the parsed value", async () => {
    expect(await parseWith(person, { age: 3, name: "a" })).toEqual({
      age: 3,
      name: "a",
    });
  });

  test("a failure is a 400 with the first sentence as message and every issue as details", async () => {
    const error = await rejection(parseWith(person, { age: "x", name: "" }));

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({
      details: [
        { field: "name", message: "Name is required." },
        { field: "age", message: "Age must be a number." },
      ],
      error: "Bad Request",
      message: "Name is required.",
      statusCode: 400,
    });
  });

  test("a symbol in an issue path does not crash the 400", async () => {
    const key = Symbol("key");
    const error = await rejection(
      parseWith(
        z.unknown().superRefine((_, ctx) => {
          ctx.addIssue({ code: "custom", message: "Bad.", path: [key, 0] });
        }),
        {},
      ),
    );

    expect(
      ((error as BadRequestException).getResponse() as { details: unknown })
        .details,
    ).toEqual([{ field: "Symbol(key).0", message: "Bad." }]);
  });
});

@Controller("people")
class PeopleController {
  @Post()
  create(@Body({ schema: person }) body: z.output<typeof person>) {
    return { data: body };
  }

  @Post("loose")
  loose(@Body({ schema: z.looseObject({}) }) body: object) {
    return { data: Object.keys(body) };
  }

  @Get()
  find(
    @Query({ schema: z.object({ limit: z.coerce.number().int() }) })
    query: { limit: number },
  ) {
    return { data: query };
  }

  @Post("raw")
  raw(@Body() body: unknown) {
    return { data: body };
  }
}

@Module({
  controllers: [PeopleController],
  providers: [{ provide: APP_PIPE, useValue: schemaValidation }],
})
class PeopleModule {}

describe("schemaValidation over HTTP", () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    app = await NestFactory.create(PeopleModule, { logger: false });
    await app.listen(0);
    url = `${await app.getUrl()}/people`;
  });

  afterAll(() => app.close());

  const post = (path: string, body: string) =>
    fetch(`${url}${path}`, {
      body,
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  test("a bad body is a 400 with message and field details", async () => {
    const response = await post("", JSON.stringify({ name: "" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      details: [
        { field: "name", message: "Name is required." },
        { field: "age", message: "Age must be a number." },
      ],
      error: "Bad Request",
      message: "Name is required.",
      statusCode: 400,
    });
  });

  test("a valid body reaches the handler parsed", async () => {
    const response = await post("", JSON.stringify({ age: 3, name: "a" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { age: 3, name: "a" } });
  });

  test("a query is parsed by its schema too", async () => {
    expect(await (await fetch(`${url}?limit=7`)).json()).toEqual({
      data: { limit: 7 },
    });
    expect((await fetch(`${url}?limit=many`)).status).toBe(400);
  });

  test("prototype keys are stripped before even a loose schema sees them", async () => {
    const response = await post(
      "/loose",
      '{"name":"a","__proto__":{"admin":true},"constructor":{"prototype":{}}}',
    );

    expect(await response.json()).toEqual({ data: ["name"] });
  });

  test("a parameter with no schema passes through untouched", async () => {
    const response = await post("/raw", JSON.stringify({ any: ["thing"] }));

    expect(await response.json()).toEqual({ data: { any: ["thing"] } });
  });
});
