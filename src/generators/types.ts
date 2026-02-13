import proto from "protobufjs";
import { createMultilineComment } from "../utils/comments.js";

function createNamespaceTypes(
  namespace: proto.NamespaceBase,
  messageNames: string[],
): string {
  let typesContent = "";
  for (const messageName of messageNames) {
    const message = namespace.nested?.[messageName] as proto.Type;
    typesContent += createMessageInterface(message);
  }
  typesContent += `export type {
  ${messageNames.join(",\n  ")},
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
    const tsType = convertToTypescriptType(field.type);
    const optional =
      (field as unknown as { rule: string })["rule"] !== "required" ? "?" : "";
    if (field.comment) {
      interfaceDef += createMultilineComment(field.comment, "  ") + "\n";
    }
    interfaceDef += `  ${field.name}${optional}: ${tsType};\n`;
  }
  interfaceDef += `}\n\n`;
  return interfaceDef;
}

function convertToTypescriptType(protoType: string): string {
  switch (protoType) {
    case "string":
      return "string";
    case "int32":
    case "int64":
    case "uint32":
    case "uint64":
    case "sint32":
    case "sint64":
    case "fixed32":
    case "fixed64":
    case "sfixed32":
    case "sfixed64":
    case "float":
    case "double":
      return "number";
    case "bool":
      return "boolean";
    default:
      return protoType; // For message types, enums, etc.
  }
}

export { createNamespaceTypes };
