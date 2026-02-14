import proto from "protobufjs";
import {
  getMessages,
  hasOptionalField,
  isRequiredField,
} from "../utils/protobuf.js";
import { getMessageId } from "../utils/associations.js";
import {
  getDeserializerFunctionName,
  getSerializerFunctionName,
} from "./serialization.js";
import { logError } from "../utils/logger.js";

/**
 * Defines the behavior for handling optional fields when creating test
 * instances for protobuf messages. The "all-required" behavior includes all
 * fields as required, the "omit-optional" behavior omits optional fields from
 * the test instance, and the "default-optional" behavior includes optional
 * fields with default values (e.g., empty string for strings, 0 for numbers,
 * false for booleans). This type is used to specify how optional fields should
 * be treated when generating test cases for protobuf messages in the generated
 * test file.
 */
type OptionalBehavior = "all-required" | "omit-optional" | "default-optional";

/**
 * Generates test cases for all messages in a protobuf namespace, including nested namespaces, and returns the content of the test file as a string. The generated tests include serialization and deserialization tests for each message, as well as additional tests for handling optional fields if any are present in the message definitions.
 * @param namespace - The protobuf namespace to create test cases for
 * @param relativePath - The relative path to the generated index file for the protobuf namespace, which is used for importing the serializer and deserializer functions in the generated test file
 * @returns A string containing the content of the test file with all the generated test cases for the protobuf namespace
 */
function generateNamespaceTests(
  namespace: proto.Namespace,
  relativePath: string,
) {
  const messages = getMessages(namespace).filter((msg) =>
    Boolean(getMessageId(msg)),
  );

  return `
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ${messages
    .flatMap((msg) => [
      getSerializerFunctionName(msg.name),
      getDeserializerFunctionName(msg.name),
      `type ${msg.name}`,
    ])
    .join(", ")} } from "${relativePath}/index.js";

describe("${namespace.name}", () => {
  ${messages.map((msg) => generateMessageTests(msg)).join("\n")}
});

`;
}

/**
 * Generates test cases for a single protobuf message type, including serialization and deserialization tests, as well as additional tests for handling optional fields if any are present in the message definition. The generated tests create instances of the message with different combinations of required and optional fields to ensure that the serializer and deserializer functions handle all cases correctly.
 * @param message - The protobuf message type to create test cases for
 * @returns A string containing the test cases for the specified protobuf message type, including serialization and deserialization tests and optional field handling tests if applicable
 */
function generateMessageTests(message: proto.Type): string {
  const serializer = getSerializerFunctionName(message.name);
  const deserializer = getDeserializerFunctionName(message.name);
  const optional = hasOptionalField(message);
  const optionalTest = optional
    ? `it("should handle optional fields correctly", () => {
    const original: ${message.name} = ${createTestInstance(message, "omit-optional")};
    const defaulted: ${message.name} = ${createTestInstance(message, "default-optional")};
    const serialized = ${serializer}(original);
    const deserialized = ${deserializer}(serialized);
    assert.deepStrictEqual(deserialized, defaulted);
  });`
    : "";
  return `
describe("${message.name}", () => {
  it("should serialize and deserialize correctly", () => {
    const original: ${message.name} = ${createTestInstance(message, "all-required")};
    const serialized = ${serializer}(original);
    const deserialized = ${deserializer}(serialized);
    assert.deepStrictEqual(deserialized, original);
  });
  ${optionalTest}
});
`;
}

/**
 * Creates a test instance of a protobuf message type with example values for each field, handling optional fields according to the specified behavior. The function generates a string representation of a TypeScript object that can be used as a test instance for the message type in serialization and deserialization tests. For repeated fields, it generates an array of example values, and for optional fields, it either omits them or sets them to default values based on the provided optional behavior.
 * @param message - The protobuf message type to create a test instance for
 * @param optionalBehavior - The behavior to apply for optional fields when creating the test instance, which can be "all-required" to include all fields as required, "omit-optional" to omit optional fields from the test instance, or "default-optional" to include optional fields with default values (e.g., empty string for strings, 0 for numbers, false for booleans)
 * @returns A string containing the TypeScript object representation of a test instance for the specified protobuf message type, with example values for each field and handling of optional fields according to the specified behavior
 */
function createTestInstance(
  message: proto.Type,
  optionalBehavior: OptionalBehavior,
): string {
  return `{
${message.fieldsArray
  .map((field) => createTestFieldValue(field, optionalBehavior))
  .filter(Boolean)
  .join("\n")}
    }`;
}

/**
 * Creates a test value for a single field of a protobuf message type, handling optional fields according to the specified behavior. The function generates a string representation of the field assignment that can be included in a test instance for the message type. For repeated fields, it generates an array of example values, and for optional fields, it either omits them or sets them to default values based on the provided optional behavior.
 * @param field - The protobuf field to create a test value for
 * @param optionalBehavior - The behavior to apply for optional fields when creating the test value, which can be "all-required" to include all fields as required, "omit-optional" to omit optional fields from the test value, or "default-optional" to include optional fields with default values (e.g., empty string for strings, 0 for numbers, false for booleans)
 * @param omitFieldName - A boolean flag indicating whether to omit the field name in the generated test value, which is used for generating values for repeated fields where the field name is not included in the array elements
 * @returns A string containing the TypeScript representation of the test value for the specified protobuf field, with handling of optional fields according to the specified behavior. If the field is omitted due to being optional and the optional behavior is "omit-optional", it returns null.
 */
function createTestFieldValue(
  field: proto.Field,
  optionalBehavior: OptionalBehavior,
  omitFieldName = false,
): string | null {
  const isOptional = !isRequiredField(field);
  if (optionalBehavior === "omit-optional" && isOptional && !field.repeated) {
    return null; // Skip optional fields if optionalBehavior is "omit-optional"
  }

  const fieldName = field.name;
  const fieldType = field.resolvedType ? field.resolvedType.name : field.type;
  let exampleValue: string;

  if (field.repeated) {
    if (optionalBehavior === "all-required") {
      const instance = createTestFieldValue(
        { ...field, repeated: false } as proto.Field,
        optionalBehavior,
        /* omitFieldName */ true,
      );
      exampleValue = `[${instance}, ${instance}]`;
    } else {
      exampleValue = "[]"; // Use empty array for repeated fields when omitting optional fields
    }
  } else {
    switch (fieldType) {
      case "string":
        exampleValue =
          optionalBehavior === "default-optional" && isOptional
            ? `""`
            : `"example"`;
        break;
      case "int32":
      case "uint32":
      case "sint32":
      case "fixed32":
      case "sfixed32":
        exampleValue =
          optionalBehavior === "default-optional" && isOptional ? `0` : `123`;
        break;
      case "int64":
      case "uint64":
      case "sint64":
      case "fixed64":
      case "sfixed64":
        exampleValue =
          optionalBehavior === "default-optional" && isOptional ? `0n` : `123n`; // BigInt for 64-bit integers
        break;
      case "bool":
        exampleValue =
          optionalBehavior === "default-optional" && isOptional
            ? `false`
            : `true`;
        break;
      case "bytes":
        exampleValue =
          optionalBehavior === "default-optional" && isOptional
            ? `Buffer.from([])`
            : `Buffer.from([1, 2, 3])`;
        break;
      default:
        const resolvedType = field.resolvedType;
        if (resolvedType && resolvedType instanceof proto.Type) {
          if (optionalBehavior === "default-optional" && isOptional) {
            exampleValue = "";
          } else {
            exampleValue = createTestInstance(resolvedType, optionalBehavior);
          }
        } else if (
          field.resolvedType &&
          field.resolvedType instanceof proto.Enum
        ) {
          const enumValues = Object.keys(field.resolvedType.values);
          const middleValue = enumValues[Math.floor(enumValues.length / 2)];
          exampleValue = `"${middleValue}"`;
        } else {
          logError(
            `Unsupported field type "${fieldType}" for field "${fieldName}". Using "UNKNOWN" as placeholder.`,
          );
          exampleValue = "UNKNOWN";
        }
    }
  }

  if (!exampleValue) return null;

  return omitFieldName
    ? `${exampleValue}`
    : `      ${fieldName}: ${exampleValue},`;
}

export { generateNamespaceTests };
