import proto from "protobufjs";
import { capitalizeFirstLetter } from "../utils/string-manipulation.js";
import { isRequiredField } from "../utils/protobuf.js";

function createNamespaceWrappers(
  namespace: proto.Namespace,
  messageNames: string[],
): string {
  let definitions = "";
  const exports: string[] = [];
  const imports: string[] = [];
  for (const messageName of messageNames) {
    const message = namespace.nested?.[messageName] as proto.Type;
    const {
      definitions: mapperDefinitions,
      exports: mapperExports,
      imports: mapperImports,
    } = createMessageWrapperFunctions(namespace.name, message);
    definitions += mapperDefinitions;
    exports.push(...mapperExports);
    imports.push(...mapperImports);
  }
  const dedupedImports = [...new Set(imports)];
  return `import type { ${dedupedImports.join(", ")} } from "./types.js";
import { ${namespace.name} } from "./protobuf/${namespace.name}.js";

function isNonNullish<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}
${definitions}
export {
  ${exports.join(",\n  ")},
};
`;
}

function createRequiredFieldWrapExpression(field: proto.Field) {
  const fieldName = field.name;
  const fieldType = field.resolvedType ? field.resolvedType.name : field.type;
  switch (fieldType) {
    case "bool":
    case "string":
    case "double":
    case "fixed32":
    case "float":
    case "int32":
    case "sfixed32":
    case "sint32":
    case "uint32":
      return `input.${fieldName}`;
    case "fixed64":
    case "int64":
    case "sfixed64":
    case "sint64":
    case "uint64":
      return `typeof input.${fieldName} === "number" ? BigInt(input.${fieldName}) : input.${fieldName}.toBigInt()`;
    default:
      return `${getWrapperFunctionName(fieldType)}(input.${fieldName})`;
  }
}

function createMaybeOptionalFieldWrapExpression(field: proto.Field) {
  const fieldName = field.name;
  const baseExpression = createRequiredFieldWrapExpression(field);
  return {
    expression: isRequiredField(field)
      ? `${fieldName}: ${baseExpression}`
      : `...(isNonNullish(input.${fieldName}) ? { ${fieldName}: ${baseExpression} } : {})`,
  };
}

function createMessageWrapperFunctions(namespace: string, message: proto.Type) {
  const mappers = Object.values(message.fields)
    .sort()
    .map(createMaybeOptionalFieldWrapExpression);
  const functionName = getWrapperFunctionName(message.name);
  const definitions = `
/**
 * Maps a ${message.name} protobuf message to a plain object.
 * @param input ${message.name} protobuf message to map
 * @returns Plain object containing the mapped message
 */
function ${functionName}(input: ${namespace}.I${message.name}): ${message.name} {
  const object: ${message.name} = {
    ${mappers.map((m) => m.expression).join(",\n    ")}
  };
  return object;
}
`;
  return {
    definitions,
    exports: [functionName],
    imports: [message.name],
  };
}

function getWrapperFunctionName(messageName: string) {
  return `map${capitalizeFirstLetter(messageName)}ProtoToObject`;
}

export { createNamespaceWrappers, getWrapperFunctionName };
