import proto from "protobufjs";
import { createMultilineComment } from "../utils/comments.js";
import {
  getChildNamespaces,
  getEnums,
  getFields,
  getMessages,
  isRequiredField,
} from "../utils/protobuf.js";
import { logError } from "../utils/logger.js";
import { findDuplicates } from "../utils/array-manipulation.js";

/**
 * The regular expression used to validate that the first enum value, the zero or default value, is named "UNSPECIFIED" or "UNKNOWN" (case-insensitive).
 */
const ENUM_UNSPECIFIED_REGEX = /UNSPECIFIED|UNKNOWN/i;

/**
 * Generates TypeScript type definitions for all messages and enums in a protobuf namespace, including nested namespaces, and returns the content of the types file as a string. It also checks for duplicate type names across the entire namespace hierarchy and logs an error if any duplicates are found.
 * @param namespace - The protobuf namespace to create TypeScript type definitions for
 * @returns A string containing the content of the types file with all the generated TypeScript type definitions for the protobuf namespace
 */
function createRootNamespaceTypes(namespace: proto.NamespaceBase): string {
  const result = createNestedNamespaceTypes(namespace);
  const duplicatedExports = findDuplicates(result.exports);
  if (duplicatedExports.length > 0) {
    logError(
      `Duplicate type names found: ${duplicatedExports.join(
        ", ",
      )}. Please ensure all message and enum names are unique across the entire namespace hierarchy.`,
    );
  }
  return `${result.content}
export type {
  ${result.exports.join(",\n  ")},
};
`;
}

/**
 * Recursively generates TypeScript type definitions for all messages and enums in a protobuf namespace, including nested namespaces. It returns an object containing the content of the type definitions and an array of exported type names for the current namespace and all nested namespaces.
 * @param namespace - The protobuf namespace to create TypeScript type definitions for
 * @returns An object containing the content of the type definitions and an array of exported type names for the current namespace and all nested namespaces
 */
function createNestedNamespaceTypes(namespace: proto.NamespaceBase) {
  const messages = getMessages(namespace);
  const messagesContent = messages.reduce(
    (content, message) => content + createMessageInterface(message),
    "",
  );

  const enums = getEnums(namespace);
  const enumContent = enums.reduce(
    (content, enumType) => content + createEnumType(enumType),
    "",
  );

  const children = getChildNamespaces(namespace);
  const nestedContent: { content: string; exports: string[] } = children.reduce(
    (data, childNamespace) => {
      const childTypes = createNestedNamespaceTypes(childNamespace);
      return {
        content: data.content + childTypes.content,
        exports: [...data.exports, ...childTypes.exports],
      };
    },
    { content: "", exports: [] as string[] },
  );

  const exports: string[] = [
    ...messages.map((m) => m.name),
    ...enums.map((e) => e.name),
    ...nestedContent.exports,
  ];

  return {
    content: `${messagesContent}
${enumContent}
${nestedContent.content}
`,
    exports,
  };
}

/**
 * Creates a TypeScript type definition for a protobuf enum type, mapping enum values to their corresponding string literal types. It also checks that the first enum value starts with 0 and has an "UNSPECIFIED" or "UNKNOWN" name, logging errors if these conditions are not met.
 * @param enumType - The protobuf enum type to create the TypeScript type definition for
 * @returns A string containing the TypeScript type definition for the protobuf enum type
 */
function createEnumType(enumType: proto.Enum): string {
  let enumDef = "";
  if (enumType.comment) {
    enumDef += createMultilineComment(enumType.comment) + "\n";
  }
  enumDef += `type ${enumType.name} =\n`;
  const values = Object.entries(enumType.values);
  if (values[0]?.[1] !== 0) {
    logError(
      `Enum ${enumType.name} does not start with a value of 0. This may cause issues with serialization. Please ensure the first enum value is 0.`,
    );
  }
  if (!ENUM_UNSPECIFIED_REGEX.test(values[0]?.[0] ?? "")) {
    logError(
      `First enum value for ${enumType.name} is "${values[0]?.[0]}". It's expected to have an "UNSPECIFIED" or "UNKNOWN" value as the first enum entry to represent an undefined state.`,
    );
  }
  values.forEach(([key, value], index) => {
    enumDef += `  | '${key}' // ${value}`;
    if (index < values.length - 1) {
      enumDef += "\n";
    }
  });
  enumDef += `\n;\n\n`;
  return enumDef;
}

/**
 * Creates a TypeScript interface definition for a protobuf message type, mapping protobuf field types to their corresponding TypeScript types. It also handles repeated fields by mapping them to array types and marks optional fields with a "?" suffix. If the message or any of its fields have comments, they are included as JSDoc comments in the generated interface.
 * @param message - The protobuf message type to create the TypeScript interface definition for
 * @returns A string containing the TypeScript interface definition for the protobuf message type
 */
function createMessageInterface(message: proto.Type) {
  let interfaceDef = "";
  if (message.comment) {
    interfaceDef += createMultilineComment(message.comment) + "\n";
  }
  interfaceDef += `interface ${message.name} {\n`;
  const mergedFields = getFields(message);
  for (const field of mergedFields) {
    if ("_isOneOf" in field) {
      if (field.oneOf?.comment) {
        interfaceDef +=
          createMultilineComment(field.oneOf.comment, "  ") + "\n";
      }
      const tsType = field.fields
        .map((t) =>
          `${createMultilineComment(t.comment, "  ")} {${t.name}:${convertToTypescriptType(t.type)}}`.trim(),
        )
        .join("\n    | ");
      interfaceDef += `  ${field.name}?:\n    | ${tsType};\n`;
    } else {
      const tsType = convertMaybeRepeatedToTsType(field);
      // NOTE: Repeated fields are considered required. Expect an empty array to be used if there are no values.
      const required = isRequiredField(field) || field.repeated;
      if (field.comment) {
        interfaceDef += createMultilineComment(field.comment, "  ") + "\n";
      }
      interfaceDef += `  ${field.name}${required ? "" : "?"}: ${tsType};\n`;
    }
  }
  interfaceDef += `}\n\n`;
  return interfaceDef;
}

/**
 * Converts a protobuf field type to a TypeScript type, handling repeated fields by mapping them to array types. For example, a protobuf field of type "int32" would be mapped to "number", and if it is repeated, it would be mapped to "number[]". For message types or enums, it will return the type name as is, which should correspond to another generated TypeScript interface or type.
 * @param protoType - The protobuf field to convert the type for
 * @returns A string containing the TypeScript type corresponding to the protobuf field type, with repeated fields mapped to array types if applicable
 */
function convertMaybeRepeatedToTsType(protoType: proto.Field) {
  const baseType = convertToTypescriptType(protoType.type);
  return protoType.repeated ? `${baseType}[]` : baseType;
}

/**
 * Converts a protobuf field type to a TypeScript type, mapping protobuf scalar types to their corresponding TypeScript types. For message types or enums, it will return the type name as is, which should correspond to another generated TypeScript interface or type.
 * @param protoType - The protobuf field type to convert to a TypeScript type
 * @returns A string containing the TypeScript type corresponding to the protobuf field type
 */
function convertToTypescriptType(protoType: string): string {
  switch (protoType) {
    /* decimals */
    case "double":
    case "float":
    /* 32-bit integers */
    case "fixed32":
    case "int32":
    case "sfixed32":
    case "sint32":
    case "uint32":
      return "number";

    /* 64-bit integers */
    case "fixed64":
    case "int64":
    case "sfixed64":
    case "sint64":
    case "uint64":
      return "bigint";

    /* others */
    case "bool":
      return "boolean";

    case "bytes":
      return "Uint8Array";

    case "string":
      return "string";

    default:
      return protoType; // For message types, enums, etc.
  }
}

export { createRootNamespaceTypes };
