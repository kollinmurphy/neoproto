import proto from "protobufjs";
import { capitalizeFirstLetter } from "../utils/string-manipulation.js";
import {
  getEnums,
  getFields,
  getMessages,
  isRequiredField,
} from "../utils/protobuf.js";
import { logError } from "../utils/logger.js";

function createNamespaceUnwrappers(namespace: proto.Namespace): string {
  let definitions = "";
  const exports: string[] = [];
  const typeImports: string[] = [];
  const messages = getMessages(namespace);
  for (const message of messages) {
    const {
      definitions: mapperDefinitions,
      exports: mapperExports,
      typeImports: mapperImports,
    } = createMessageUnwrapperFunctions(namespace.name, message);
    definitions += mapperDefinitions;
    exports.push(...mapperExports);
    typeImports.push(...mapperImports);
  }

  const enumTypes = getEnums(namespace);
  for (const enumType of enumTypes) {
    const {
      definitions: enumDefinitions,
      exports: enumExports,
      typeImports: enumImports,
    } = createEnumUnwrapperFunction(enumType, namespace.name);
    definitions += enumDefinitions;
    exports.push(...enumExports);
    typeImports.push(...enumImports);
  }

  return `import type { ${[...new Set(typeImports)].sort().join(", ")} } from "./types.js";
import long from "long";
import { ${namespace.name} } from "./protobuf/${namespace.name}.js";

function isNonNullish<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

function assertUnreachable(x: never): never {
  throw new Error(\`Unexpected value: \${x}\`);
}
${definitions}
export {
  ${exports.join(",\n  ")},
};
`;
}

function createRequiredFieldUnwrapExpression(field: proto.Field, name: string) {
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
    case "bytes":
      return name;
    case "fixed64":
    case "int64":
    case "sfixed64":
    case "sint64":
    case "uint64":
      return `typeof ${name} === 'number' ? ${name} : long.fromBigInt(${name})`;
    default:
      if (field.resolvedType instanceof proto.Enum) {
        return `${getEnumUnwrapperFunctionName(field.resolvedType.name)}(${name})`;
      }
      return `${getUnwrapperFunctionName(fieldType)}(${name})`;
  }
}

function createMaybeOptionalFieldUnwrapExpression(field: proto.Field) {
  const isRequired = isRequiredField(field);
  if (!isRequired && field.resolvedType instanceof proto.Enum) {
    logError(
      `Field ${field.name} in message ${field.parent?.name} is an optional enum. Enums must be required and have a default zero value for an unspecified state.`,
    );
  }
  const fieldName = field.name;
  const baseExpression = createRequiredFieldUnwrapExpression(
    field,
    `input.${fieldName}`,
  );
  return isRequired
    ? `${fieldName}: ${baseExpression}`
    : `...(isNonNullish(input.${fieldName}) ? { ${fieldName}: ${baseExpression} } : {})`;
}

function createMaybeRepeatedFieldUnwrapExpression(field: proto.Field) {
  if (!field.repeated) return createMaybeOptionalFieldUnwrapExpression(field);
  const fieldName = field.name;
  const baseExpression = createRequiredFieldUnwrapExpression(field, "item");
  const needsMap = baseExpression !== "item";
  return needsMap
    ? `${fieldName}: (input.${fieldName} ?? []).map((item) => ${baseExpression})`
    : `${fieldName}: input.${fieldName} ?? []`;
}

function createMessageUnwrapperFunctions(
  namespace: string,
  message: proto.Type,
) {
  const functionName = getUnwrapperFunctionName(message.name);
  const definitions = `
/**
 * Maps a plain object to a ${namespace}.I${message.name} protobuf interface.
 * @param input Plain object containing the message
 * @returns ${namespace}.I${message.name} protobuf interface
 */
function ${functionName}(input: ${message.name}): ${namespace}.I${message.name} {
  const proto: ${namespace}.I${message.name} = {
    ${getFields(message)
      .map(createMaybeRepeatedFieldUnwrapExpression)
      .join(",\n    ")}
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

function createEnumUnwrapperFunction(enumType: proto.Enum, namespace: string) {
  const functionName = getEnumUnwrapperFunctionName(enumType.name);
  const definitions = `
/**
 * Maps a value of ${enumType.name} type to the corresponding protobuf enum value.
 * @param input Value of ${enumType.name} type
 * @returns Corresponding protobuf enum value
 */
function ${functionName}(input: ${enumType.name}): number {
  switch (input) {
${Object.entries(enumType.values)
  .map(
    ([key]) => `    case '${key}':
      return ${namespace}.${enumType.name}.${key};`,
  )
  .join("\n")}
    default:
      return assertUnreachable(input);
  }
}
`;
  return {
    definitions,
    exports: [functionName],
    typeImports: [enumType.name],
  };
}

function getUnwrapperFunctionName(messageName: string) {
  return `map${capitalizeFirstLetter(messageName)}ObjectToProto`;
}

function getEnumUnwrapperFunctionName(enumName: string) {
  return `map${capitalizeFirstLetter(enumName)}ValueToProto`;
}

export {
  createNamespaceUnwrappers,
  getUnwrapperFunctionName,
  getEnumUnwrapperFunctionName,
};
