import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import {
  createMaybeOneOfTestFieldValue,
  createTestFieldValue,
  createTestInstance,
  generateMessageTests,
  generateNamespaceTests,
  TEST_VALUES,
} from "../../src/generators/test";
import proto from "protobufjs";
import { clearErrorState, getHasLoggedError } from "../../src/utils/logger";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getFields, OneOfField } from "../../src/utils/protobuf";

function getTestFieldName(): string {
  return randomUUID();
}

async function loadProto(protoPath: string): Promise<proto.Namespace> {
  const root = await proto.load(protoPath);
  const namespaceStr = Object.keys(root.nested ?? {})[0];
  if (!namespaceStr) throw new Error(`No namespace key found in ${protoPath}`);
  const namespace = root.nested?.[namespaceStr] as proto.Namespace;
  if (!namespace)
    throw new Error(`Namespace ${namespaceStr} not found in ${protoPath}`);
  return namespace.resolveAll();
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, p1) => p1.toUpperCase());
}

const primitiveTypes: [string, string, string][] = [
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
            fullName: getTestFieldName(),
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
            fullName: getTestFieldName(),
            resolvedType: { name: "string" },
          } as unknown as proto.Field,
          "omit-optional",
        ),
        TEST_VALUES.string,
      ));
    describe("for repeated fields", () => {
      it("should return an empty array when behavior is not 'all-required'", async () => {
        const ns = await loadProto(join(__dirname, "../data/repeated.proto"));
        const field =
          ns.lookupType("SomeMessage")!.fields[toCamelCase("some_repeated")]!;
        assert.strictEqual(
          createTestFieldValue(field, "omit-optional"),
          TEST_VALUES.repeated_default,
        );
      });
      it("should return two instances when behavior is 'all-required'", async () => {
        const ns = await loadProto(join(__dirname, "../data/repeated.proto"));
        const field =
          ns.lookupType("SomeMessage")!.fields[toCamelCase("some_repeated")]!;
        assert.strictEqual(
          createTestFieldValue(field, "all-required"),
          `[${TEST_VALUES.string}, ${TEST_VALUES.string}]`,
        );
      });
      it("should return the correct type", async () => {
        const ns = await loadProto(join(__dirname, "../data/repeated.proto"));
        const field =
          ns.lookupType("SomeMessage")!.fields[
            toCamelCase("some_repeated_num")
          ]!;
        assert.strictEqual(
          createTestFieldValue(field, "all-required"),
          `[${TEST_VALUES.number}, ${TEST_VALUES.number}]`,
        );
      });
      it("should support an inner message type", async () => {
        const ns = await loadProto(join(__dirname, "../data/repeated.proto"));
        const field =
          ns.lookupType("SomeOtherMessage")!.fields[toCamelCase("test_field")]!;
        assert.strictEqual(
          createTestFieldValue(field, "all-required")?.replace(/\s/g, ""), // Remove whitespace for easier comparison
          `[{nestedField:${TEST_VALUES.string},},{nestedField:${TEST_VALUES.string},}]`,
        );
      });
    });
    it("should support nested repeated fields", async () => {
      const ns = await loadProto(
        join(__dirname, "../data/nested_repeated.proto"),
      );
      const field = ns.lookupType("SomeMessage").fieldsArray[0]!;
      const val = createTestFieldValue(field, "all-required");
      assert.strictEqual(
        val?.replace(/\s/g, ""),
        `[{nestedField:[${TEST_VALUES.string},${TEST_VALUES.string}],},{nestedField:[${TEST_VALUES.string},${TEST_VALUES.string}],}]`,
      );
    });
    describe("for enum fields", () => {
      it("should return the key of the middle enum value", async () => {
        const ns = await loadProto(join(__dirname, "../data/enum.proto"));
        const field = ns.lookupType("SomeMessage").fieldsArray[0]!;
        assert.strictEqual(
          createTestFieldValue(field, "omit-optional"),
          `"SECOND"`,
        );
      });
    });
    it("should return the correct values for all primitive types", async () => {
      const ns = await loadProto(join(__dirname, "../data/primitives.proto"));
      const msg = ns.lookupType("PrimitiveExample")!;
      for (const [type, expectedValue, defaultValue] of primitiveTypes) {
        const reqField = msg.fields[toCamelCase(`required_${type}`)]!;
        assert.strictEqual(
          createTestFieldValue(reqField, "omit-optional"),
          expectedValue,
        );

        const optField = msg.fields[toCamelCase(`optional_${type}`)]!;
        assert.strictEqual(
          createTestFieldValue(optField, "default-optional"),
          defaultValue,
        );
      }
    });
    it("should return 'UNKNOWN' for unsupported field types", () => {
      assert.strictEqual(
        createTestFieldValue(
          {
            fullName: getTestFieldName(),
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
  describe("createMaybeOneOfTestFieldValue", () => {
    describe("for non-oneof fields", () => {
      it("should return the same value as createTestFieldValue", async () => {
        const ns = await loadProto(join(__dirname, "../data/primitives.proto"));
        const msg = ns.lookupType("PrimitiveExample")!;
        for (const [type] of primitiveTypes) {
          const field = msg.fields[toCamelCase(`required_${type}`)]!;
          assert.strictEqual(
            createMaybeOneOfTestFieldValue(field, "omit-optional"),
            createTestFieldValue(field, "omit-optional"),
          );
        }
      });
    });
    describe("for oneof fields", () => {
      it("should return null if omitting optional fields", async () => {
        const ns = await loadProto(join(__dirname, "../data/oneof.proto"));
        const field = getFields(ns.lookupType("OneOfMessage")).find((f) => (f as OneOfField)._isOneOf && f.name === "testOneof")! as OneOfField;
        assert.strictEqual(
          createMaybeOneOfTestFieldValue(field, "omit-optional"),
          null,
        );
        assert.strictEqual(
          createMaybeOneOfTestFieldValue(field, "default-optional"),
          null,
        );
      });
      it("should return the value for the middle field in the oneof", async () => {
        const ns = await loadProto(join(__dirname, "../data/oneof.proto"));
        const field = getFields(ns.lookupType("OneOfMessage")).find((f) => (f as OneOfField)._isOneOf && f.name === "testOneof")! as OneOfField;
        assert.strictEqual(
          createMaybeOneOfTestFieldValue(field, "all-required"),
          `{ number: ${TEST_VALUES.number} }`,
        );
      });
    })
  })
  describe("createTestInstance", () => {
    it("should create an instance of a message with all required fields", async () => {
      const ns = await loadProto(join(__dirname, "../data/primitives.proto"));
      const msg = ns.lookupType("PrimitiveExample")!;
      assert.strictEqual(
        createTestInstance(msg, "omit-optional").replace(/\s/g, ""),
        `{${primitiveTypes
          .sort((a, b) => a[0].localeCompare(b[0]))
          .reduce((acc, [type, expectedValue]) => {
            const fieldName = toCamelCase(`required_${type}`);
            return `${acc}${fieldName}:${expectedValue},`;
          }, "")}}`.replace(/\s/g, ""),
      );
    });
    it("should include optional fields when required by the behavior", async () => {
      const ns = await loadProto(join(__dirname, "../data/primitives.proto"));
      const msg = ns.lookupType("PrimitiveExample")!;
      const optFields = primitiveTypes
        .sort((a, b) => a[0].localeCompare(b[0]))
        .reduce((acc, [type, _, defaultValue]) => {
          const fieldName = toCamelCase(`optional_${type}`);
          return `${acc}${fieldName}:${defaultValue},`;
        }, "");
      const reqFields = primitiveTypes
        .sort((a, b) => a[0].localeCompare(b[0]))
        .reduce((acc, [type, expectedValue]) => {
          const fieldName = toCamelCase(`required_${type}`);
          return `${acc}${fieldName}:${expectedValue},`;
        }, "");
      assert.strictEqual(
        createTestInstance(msg, "default-optional").replace(/\s/g, ""),
        `{${optFields}${reqFields}}`.replace(/\s/g, ""),
      );
    });
  });
  describe("generateMessageTests", () => {
    it("should generate test code", async () => {
      const ns = await loadProto(join(__dirname, "../data/dummy.proto"));
      const dummyMessage = ns.lookupType("TestMessage")!;
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
    it("should generate test code for a namespace with messages", async () => {
      const ns = await loadProto(join(__dirname, "../data/dummy.proto"));
      const dummyMessage = ns.lookupType("TestMessage")!;
      const messageTests = generateMessageTests(dummyMessage);
      assert.strictEqual(
        generateNamespaceTests({
          apiName: "TestNamespace",
          topLevelMessages: [dummyMessage],
          relativePath: "./relative/path",
        }),
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
