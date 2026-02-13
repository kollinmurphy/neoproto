import proto from "protobufjs";
import { capitalizeFirstLetter } from "../utils/string-manipulation.js";
import { getFields, isRequiredField } from "../utils/protobuf.js";

function createNamespaceUnwrappers(
  namespace: proto.Namespace,
  messageNames: string[],
): string {
  let definitions = "";
  const exports: string[] = [];
  const typeImports: string[] = [];
  for (const messageName of messageNames) {
    const message = namespace.nested?.[messageName] as proto.Type;
    const {
      definitions: mapperDefinitions,
      exports: mapperExports,
      typeImports: mapperImports,
    } = createMessageUnwrapperFunctions(namespace.name, message);
    definitions += mapperDefinitions;
    exports.push(...mapperExports);
    typeImports.push(...mapperImports);
  }
  return `import type { ${[...new Set(typeImports)].sort().join(", ")} } from "./types.js";
import long from "long";
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

function createRequiredFieldUnwrapExpression(field: proto.Field) {
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
      return `typeof input.${fieldName} === 'number' ? input.${fieldName} : long.fromBigInt(input.${fieldName})`;
    default:
      return `${getUnwrapperFunctionName(fieldType)}(input.${fieldName})`;
  }
}

function createMaybeOptionalFieldUnwrapExpression(field: proto.Field) {
  const fieldName = field.name;
  const baseExpression = createRequiredFieldUnwrapExpression(field);
  return {
    expression: isRequiredField(field)
      ? `${fieldName}: ${baseExpression}`
      : `...(isNonNullish(input.${fieldName}) ? { ${fieldName}: ${baseExpression} } : {})`,
    imports: [field.type],
  };
}

function createMessageUnwrapperFunctions(
  namespace: string,
  message: proto.Type,
) {
  const mappers = Object.values(message.fields)
    .sort()
    .map(createMaybeOptionalFieldUnwrapExpression);
  const functionName = getUnwrapperFunctionName(message.name);
  const definitions = `
/**
 * Maps a plain object to a ${namespace}.I${message.name} protobuf interface.
 * @param input Plain object containing the message
 * @returns ${namespace}.I${message.name} protobuf interface
 */
function ${functionName}(input: ${message.name}): ${namespace}.I${message.name} {
  const proto: ${namespace}.I${message.name} = {
    ${mappers.map((m) => m.expression).join(",\n    ")}
  };
  return proto;
}
`;
  return {
    definitions,
    exports: [functionName],
    typeImports: [message.name],
  };
}

function getUnwrapperFunctionName(messageName: string) {
  return `map${capitalizeFirstLetter(messageName)}ObjectToProto`;
}

export { createNamespaceUnwrappers, getUnwrapperFunctionName };
