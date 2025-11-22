import { describe, expect, mock, test } from "bun:test";

describe("mock.module availability", () => {
	test("mock module function exists", () => {
		expect(typeof mock.module).toBe("function");
		expect(() => {
			mock.module("path", () => ({}));
		}).not.toThrow();
	});
});
