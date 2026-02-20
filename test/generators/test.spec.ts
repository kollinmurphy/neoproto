import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import {
  createTestFieldValue,
  createTestInstance,
  generateMessageTests,
  generateNamespaceTests,
  TEST_VALUES,
} from "../../src/generators/test";
import proto from "protobufjs";
import { clearErrorState, getHasLoggedError } from "../../src/utils/logger";

const dummyMessage = Object.assign(Object.create(proto.Type.prototype), {
  name: "TestMessage",
  comment: "MessageId: 998",
  fields: {
    stringField: Object.assign(Object.create(proto.Field.prototype), {
      name: "stringField",
      rule: "required",
      type: "string",
    }),
    intField: Object.assign(Object.create(proto.Field.prototype), {
      name: "intField",
      rule: "required",
      type: "int32",
    }),
    optField: Object.assign(Object.create(proto.Field.prototype), {
      name: "optField",
      rule: "optional",
      type: "string",
    }),
  },
});
Object.keys(dummyMessage.fields).forEach((field) => {
  dummyMessage.fields[field].resolve = () => dummyMessage.fields[field]; // Mock the resolve method for testing
});

describe("test.ts", () => {
  beforeEach(() => {
    clearErrorState();
  });
  describe("createTestFieldValue", () => {
    it("should return null for optional fields when behavior is 'omit-optional'", () =>
      assert.strictEqual(
        createTestFieldValue(
          {
            rule: "optional",
            name: "testField",
          } as unknown as proto.Field,
          "omit-optional",
        ),
        null,
      ));
    it("should return the value for required fields even when behavior is 'omit-optional'", () =>
      assert.strictEqual(
        createTestFieldValue(
          {
            rule: "required",
            name: "testField",
            resolvedType: { name: "string" },
          } as unknown as proto.Field,
          "omit-optional",
        ),
        TEST_VALUES.string,
      ));
    describe("for repeated fields", () => {
      it("should return an empty array when behavior is not 'all-required'", () =>
        assert.strictEqual(
          createTestFieldValue(
            {
              repeated: true,
              name: "testField",
              resolvedType: { name: "string" },
            } as unknown as proto.Field,
            "omit-optional",
          ),
          TEST_VALUES.repeated_default,
        ));
      it("should return two instances when behavior is 'all-required'", () =>
        assert.strictEqual(
          createTestFieldValue(
            {
              repeated: true,
              name: "testField",
              resolvedType: { name: "string" },
            } as unknown as proto.Field,
            "all-required",
          ),
          `[${TEST_VALUES.string}, ${TEST_VALUES.string}]`,
        ));
      it("should return the correct type", () =>
        assert.strictEqual(
          createTestFieldValue(
            {
              repeated: true,
              name: "testField",
              resolvedType: { name: "int32" },
            } as unknown as proto.Field,
            "all-required",
          ),
          `[${TEST_VALUES.number}, ${TEST_VALUES.number}]`,
        ));
      it("should support an inner message type", () =>
        assert.strictEqual(
          createTestFieldValue(
            Object.assign(Object.create(proto.Field.prototype), {
              repeated: true,
              name: "testField",
              resolvedType: Object.assign(Object.create(proto.Type.prototype), {
                name: "NestedMessage",
                fields: {
                  nestedField: Object.assign(
                    Object.create(proto.Field.prototype),
                    {
                      name: "nestedField",
                      type: "string",
                    },
                  ),
                },
              }),
            }),
            "all-required",
          )?.replace(/\s/g, ""), // Remove whitespace for easier comparison
          `[{nestedField:${TEST_VALUES.string},},{nestedField:${TEST_VALUES.string},}]`,
        ));
      it("should support nested repeated fields", () =>
        assert.strictEqual(
          createTestFieldValue(
            Object.assign(Object.create(proto.Field.prototype), {
              repeated: true,
              name: "testField",
              resolvedType: Object.assign(Object.create(proto.Type.prototype), {
                name: "NestedMessage",
                fields: {
                  nestedField: Object.assign(
                    Object.create(proto.Field.prototype),
                    {
                      repeated: true,
                      name: "nestedField",
                      type: "string",
                    },
                  ),
                },
              }),
            }),
            "all-required",
          )?.replace(/\s/g, ""), // Remove whitespace for easier comparison
          `[{nestedField:[${TEST_VALUES.string},${TEST_VALUES.string}],},{nestedField:[${TEST_VALUES.string},${TEST_VALUES.string}],}]`,
        ));
    });
    describe("for enum fields", () => {
      it("should return the key of the middle enum value", () =>
        assert.strictEqual(
          createTestFieldValue(
            Object.assign(Object.create(proto.Field.prototype), {
              name: "testField",
              rule: "required",
              resolvedType: Object.assign(Object.create(proto.Enum.prototype), {
                name: "TestEnum",
                values: {
                  FIRST: 0,
                  SECOND: 1,
                  THIRD: 2,
                },
              }),
            }),
            "omit-optional",
          ),
          `"SECOND"`,
        ));
    });
    it("should return the correct values for all primitive types", () => {
      const primitiveTypes = [
        ["string", TEST_VALUES.string, TEST_VALUES.string_default],
        ["int32", TEST_VALUES.number, TEST_VALUES.number_default],
        ["uint32", TEST_VALUES.number, TEST_VALUES.number_default],
        ["sint32", TEST_VALUES.number, TEST_VALUES.number_default],
        ["fixed32", TEST_VALUES.number, TEST_VALUES.number_default],
        ["sfixed32", TEST_VALUES.number, TEST_VALUES.number_default],
        ["int64", TEST_VALUES.bigint, TEST_VALUES.bigint_default],
        ["uint64", TEST_VALUES.bigint, TEST_VALUES.bigint_default],
        ["sint64", TEST_VALUES.bigint, TEST_VALUES.bigint_default],
        ["fixed64", TEST_VALUES.bigint, TEST_VALUES.bigint_default],
        ["sfixed64", TEST_VALUES.bigint, TEST_VALUES.bigint_default],
        ["bool", TEST_VALUES.boolean, TEST_VALUES.boolean_default],
        ["bytes", TEST_VALUES.bytes, TEST_VALUES.bytes_default],
      ];
      for (const [type, expectedValue, defaultValue] of primitiveTypes) {
        assert.strictEqual(
          createTestFieldValue(
            {
              name: "testField",
              rule: "required",
              type,
            } as unknown as proto.Field,
            "omit-optional",
          ),
          expectedValue,
        );
        assert.strictEqual(
          createTestFieldValue(
            {
              name: "testField",
              rule: "optional",
              type,
            } as unknown as proto.Field,
            "default-optional",
          ),
          defaultValue,
        );
      }
    });
    it("should return 'UNKNOWN' for unsupported field types", () => {
      assert.strictEqual(
        createTestFieldValue(
          {
            name: "testField",
            rule: "required",
            type: "unsupportedType",
          } as unknown as proto.Field,
          "omit-optional",
        ),
        "UNKNOWN",
      );
      assert.strictEqual(getHasLoggedError(), true);
    });
  });
  describe("createTestInstance", () => {
    it("should create an instance of a message with all required fields", () =>
      assert.strictEqual(
        createTestInstance(dummyMessage, "omit-optional").replace(/\s/g, ""),
        `{intField:${TEST_VALUES.number},stringField:${TEST_VALUES.string},}`,
      ));
    it("should include optional fields when required by the behavior", () =>
      assert.strictEqual(
        createTestInstance(dummyMessage, "default-optional").replace(/\s/g, ""),
        `{intField:${TEST_VALUES.number},optField:${TEST_VALUES.string_default},stringField:${TEST_VALUES.string},}`,
      ));
  });
  describe("generateMessageTests", () => {
    it("should generate test code", () => {
      assert.strictEqual(
        generateMessageTests(dummyMessage),
        `
describe("TestMessage", () => {
  it("should serialize and deserialize correctly", () => {
    const original: ${dummyMessage.name} = {
      intField: ${TEST_VALUES.number},
      optField: ${TEST_VALUES.string},
      stringField: ${TEST_VALUES.string},
    };
    const serialized = serializeTestMessage(original);
    const deserialized = deserializeTestMessage(serialized);
    assert.deepStrictEqual(deserialized, original);
  });
  it("should handle optional fields correctly", () => {
    const original: ${dummyMessage.name} = {
      intField: ${TEST_VALUES.number},
      stringField: ${TEST_VALUES.string},
    };
    const defaulted: ${dummyMessage.name} = {
      intField: ${TEST_VALUES.number},
      optField: ${TEST_VALUES.string_default},
      stringField: ${TEST_VALUES.string},
    };
    const serialized = serializeTestMessage(original);
    const deserialized = deserializeTestMessage(serialized);
    assert.deepStrictEqual(deserialized, defaulted);
  });
});
`,
      );
    });
    it("should omit optional field test if none are present", () => {
      const messageWithoutOptional = Object.assign(
        Object.create(proto.Type.prototype),
        {
          name: "MessageWithoutOptional",
          fields: {
            stringField: Object.assign(Object.create(proto.Field.prototype), {
              name: "stringField",
              rule: "required",
              type: "string",
            }),
            intField: Object.assign(Object.create(proto.Field.prototype), {
              name: "intField",
              rule: "required",
              type: "int32",
            }),
          },
        },
      );
      Object.keys(messageWithoutOptional.fields).forEach((field) => {
        messageWithoutOptional.fields[field].resolve = () =>
          messageWithoutOptional.fields[field]; // Mock the resolve method for testing
      });
      assert.strictEqual(
        generateMessageTests(messageWithoutOptional),
        `
describe("MessageWithoutOptional", () => {
  it("should serialize and deserialize correctly", () => {
    const original: ${messageWithoutOptional.name} = {
      intField: ${TEST_VALUES.number},
      stringField: ${TEST_VALUES.string},
    };
    const serialized = serializeMessageWithoutOptional(original);
    const deserialized = deserializeMessageWithoutOptional(serialized);
    assert.deepStrictEqual(deserialized, original);
  });
});
`,
      );
    });
  });
  describe("generateNamespaceTests", () => {
    it("should generate test code for a namespace with messages", () => {
      const dummyNamespace = Object.assign(
        Object.create(proto.Namespace.prototype),
        {
          name: "TestNamespace",
          nested: {
            TestMessage: dummyMessage,
          },
        },
      );
      Object.keys(dummyMessage.fields).forEach((field) => {
        dummyMessage.fields[field].resolve = () => dummyMessage.fields[field]; // Mock the resolve method for testing
      });
      const messageTests = generateMessageTests(dummyMessage);
      assert.strictEqual(
        generateNamespaceTests(dummyNamespace, "./relative/path"),
        `
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { serializeTestMessage, deserializeTestMessage, type TestMessage } from "./relative/path/index.js";

describe("TestNamespace", () => {
${messageTests}
});

`,
      );
    });
  });
});
