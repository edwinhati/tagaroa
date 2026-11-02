import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  BadRequestException,
  Body,
  Controller,
  Module,
  Post,
  type INestApplication,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as z from "zod";

import { ZodBody } from "./zod-body";

const pipe = new ZodBody(
  z.object({
    name: z.string({ error: "Name is required." }).min(1, "Name is required."),
    age: z.number({ error: "Age must be a number." }),
  }),
);

describe("ZodBody", () => {
  test("returns the parsed value", () => {
    expect(pipe.transform({ age: 3, name: "a" })).toEqual({
      age: 3,
      name: "a",
    });
  });

  test("a failure is a 400 with the first sentence as message and every issue as details", () => {
    let error: unknown;
    try {
      pipe.transform({ age: "x", name: "" });
    } catch (thrown) {
      error = thrown;
    }

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

  test("a symbol in an issue path does not crash the 400", () => {
    const key = Symbol("key");
    const symbolPipe = new ZodBody(
      z.unknown().superRefine((_, ctx) => {
        ctx.addIssue({ code: "custom", message: "Bad.", path: [key, 0] });
      }),
    );

    expect(() => symbolPipe.transform({})).toThrow(BadRequestException);
    try {
      symbolPipe.transform({});
    } catch (thrown) {
      expect(
        ((thrown as BadRequestException).getResponse() as { details: unknown })
          .details,
      ).toEqual([{ field: "Symbol(key).0", message: "Bad." }]);
    }
  });
});

@Controller("people")
class PeopleController {
  @Post()
  create(@Body(pipe) body: unknown) {
    return { data: body };
  }
}

@Module({ controllers: [PeopleController] })
class PeopleModule {}

describe("ZodBody over HTTP", () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    app = await NestFactory.create(PeopleModule, { logger: false });
    await app.listen(0);
    url = `${await app.getUrl()}/people`;
  });

  afterAll(() => app.close());

  const post = (body: string) =>
    fetch(url, {
      body,
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  test("a bad body is a 400 with message and field details", async () => {
    const response = await post(JSON.stringify({ name: "" }));

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
    const response = await post(JSON.stringify({ age: 3, name: "a" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { age: 3, name: "a" } });
  });
});
