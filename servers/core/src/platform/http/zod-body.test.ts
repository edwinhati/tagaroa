import { describe, expect, test } from "bun:test";

import { BadRequestException } from "@nestjs/common";
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
});
