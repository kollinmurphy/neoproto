import assert from "node:assert";
import { describe, it } from "node:test";
import {
  getDeserializerFunctionName,
  getSerializerFunctionName,
} from "../../src/generators/serialization";

describe("serialization.ts", () => {
  describe("getSerializerFunctionName", () => {
    it("should generate the correct serializer function name for a given message name", () =>
      assert.strictEqual(
        getSerializerFunctionName("MyMessage"),
        "serializeMyMessage",
      ));
    it("should capitalize the first letter of the message name in the generated function name", () =>
      assert.strictEqual(
        getSerializerFunctionName("anotherMessage"),
        "serializeAnotherMessage",
      ));
  });
  describe("getDeserializerFunctionName", () => {
    it("should generate the correct deserializer function name for a given message name", () =>
      assert.strictEqual(
        getDeserializerFunctionName("MyMessage"),
        "deserializeMyMessage",
      ));
    it("should capitalize the first letter of the message name in the generated function name", () =>
      assert.strictEqual(
        getDeserializerFunctionName("anotherMessage"),
        "deserializeAnotherMessage",
      ));
  });
});
