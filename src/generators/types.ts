import proto from "protobufjs";
import { createMultilineComment } from "../utils/comments.js";
import { getEnums, getMessages, isRequiredField } from "../utils/protobuf.js";
import { logError } from "../utils/logger.js";

const ENUM_UNSPECIFIED_REGEX = /UNSPECIFIED|UNKNOWN/i;

function createNamespaceTypes(namespace: proto.NamespaceBase): string {
  const messages = getMessages(namespace);
  const messagesContent = messages.reduce(
    (content, message) => content + createMessageInterface(message),
    "",
  );

  const enumContent = getEnums(namespace).reduce(
    (content, enumType) => content + createEnumType(enumType),
    "",
  );
  const exports = [
    ...messages.map((m) => m.name),
    ...getEnums(namespace).map((e) => e.name),
  ].sort();

  return `${messagesContent}
${enumContent}
export type {
  ${exports.join(",\n  ")},
};
`;
}

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

function createMessageInterface(message: proto.Type) {
  let interfaceDef = "";
  if (message.comment) {
    interfaceDef += createMultilineComment(message.comment) + "\n";
  }
  interfaceDef += `interface ${message.name} {\n`;
  for (const field of message.fieldsArray.map((f) => f.resolve())) {
    const tsType = convertMaybeRepeatedToTsType(field);
    // NOTE: Repeated fields are considered required. Expect an empty array to be used if there are no values.
    const required = isRequiredField(field) || field.repeated;
    if (field.comment) {
      interfaceDef += createMultilineComment(field.comment, "  ") + "\n";
    }
    interfaceDef += `  ${field.name}${required ? "" : "?"}: ${tsType};\n`;
  }
  interfaceDef += `}\n\n`;
  return interfaceDef;
}

function convertMaybeRepeatedToTsType(protoType: proto.Field) {
  const baseType = convertToTypescriptType(protoType.type);
  return protoType.repeated ? `${baseType}[]` : baseType;
}

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

export { createNamespaceTypes };
