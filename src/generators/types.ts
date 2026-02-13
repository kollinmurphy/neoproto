import proto from "protobufjs";
import { createMultilineComment } from "../utils/comments.js";
import { getMessages, isRequiredField } from "../utils/protobuf.js";

function createNamespaceTypes(namespace: proto.NamespaceBase): string {
  let typesContent = "";
  const messages = getMessages(namespace);
  for (const message of messages) {
    typesContent += createMessageInterface(message);
  }
  typesContent += `export type {
  ${messages.map((m) => m.name).join(",\n  ")},
};
`;
  return typesContent;
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
    case "string":
      return "string";
    case "double":
    case "fixed32":
    case "float":
    case "int32":
    case "sfixed32":
    case "sint32":
    case "uint32":
      return "number";
    case "fixed64":
    case "int64":
    case "sfixed64":
    case "sint64":
    case "uint64":
      return "bigint";
    case "bool":
      return "boolean";
    default:
      return protoType; // For message types, enums, etc.
  }
}

export { createNamespaceTypes };
