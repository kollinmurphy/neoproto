import assert from "node:assert";
import { describe, it } from "node:test";
import {
  createMessageSerializers,
  createNamespaceSerializers,
  getDeserializerFunctionName,
  getSerializerFunctionName,
} from "../../src/generators/serialization";
import proto from "protobufjs";
import { getUnwrapperFunctionName } from "../../src/generators/unwrap";
import { getWrapperFunctionName } from "../../src/generators/wrap";

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
  describe("createMessageSerializers", () => {
    it("should generate the correct serializer and deserializer function definitions for a given protobuf message type", () => {
      const message = {
        name: "TestMessage",
      } as proto.Type;
      const result = createMessageSerializers("TestNamespace", message);
      const unwrap = getUnwrapperFunctionName(message.name);
      const wrap = getWrapperFunctionName(message.name);
      assert.strictEqual(
        result.definitions,
        `
/**
 * Serializes a TestMessage message to a Uint8Array.
 * @param input TestMessage message to serialize
 * @returns Uint8Array containing the serialized message
 */
function serializeTestMessage(input: TestMessage): Uint8Array {
  return TestNamespace.TestMessage.encode(${unwrap}(input)).finish();
}

/**
 * Deserializes a TestMessage message from a Uint8Array.
 * @param input Uint8Array containing the serialized message
 * @returns TestMessage message
 */
function deserializeTestMessage(input: Uint8Array): TestMessage {
  return ${wrap}(TestNamespace.TestMessage.decode(input));
}
`,
      );
      assert.deepStrictEqual(result.exports, [
        "serializeTestMessage",
        "deserializeTestMessage",
      ]);
      assert.deepStrictEqual(result.typeImports, ["TestMessage"]);
      assert.deepStrictEqual(result.wrapperImports, [wrap]);
      assert.deepStrictEqual(result.unwrapperImports, [unwrap]);
    });
  });
  describe("createNamespaceSerializers", () => {
    it("should generate the correct serializer and deserializer function definitions for a given protobuf namespace", () => {
      const message1 = Object.assign(Object.create(proto.Type.prototype), {
        name: "TestMessage1",
        comment: "MessageId: 123",
      });
      const message2 = Object.assign(Object.create(proto.Type.prototype), {
        name: "TestMessage2",
        comment: "MessageId: 1234",
      });
      const namespaceName = "TestNamespace";
      const message1Serializers = createMessageSerializers(
        namespaceName,
        message1,
      );
      const message2Serializers = createMessageSerializers(
        namespaceName,
        message2,
      );
      const result = createNamespaceSerializers(namespaceName, [message1, message2]);
      const exports = [
        ...message1Serializers.exports,
        ...message2Serializers.exports,
      ].sort();
      assert.strictEqual(
        result,
        `import type { ${message1.name}, ${message2.name} } from "./types.js";
import { ${namespaceName} } from "./protobuf/${namespaceName}.js";
import { ${message1Serializers.wrapperImports[0]}, ${message2Serializers.wrapperImports[0]} } from "./wrap.js";
import { ${message1Serializers.unwrapperImports[0]}, ${message2Serializers.unwrapperImports[0]} } from "./unwrap.js";
${message1Serializers.definitions}${message2Serializers.definitions}
export {
  ${exports.join(",\n  ")},
};
`,
      );
    });
  });
});
