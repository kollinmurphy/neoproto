import proto from "protobufjs";
import { capitalizeFirstLetter } from "../utils/string-manipulation.js";
import {
  getChildNamespaces,
  getEnums,
  getFields,
  getMessages,
  isRequiredField,
} from "../utils/protobuf.js";
import { logError } from "../utils/logger.js";

const INPUT_VARIABLE = "input";
const MAP_VARIABLE = "item";

type Dependencies = "long" | "isNonNullish" | "assertUnreachable";

function createRootNamespaceUnwrappers(namespace: proto.Namespace): string {
  const {
    content: definitions,
    exports,
    typeImports,
    dependencies,
  } = createNestedNamespaceUnwrappers(namespace, namespace.name);

  const importLines = [
    `import type { ${[...new Set(typeImports)].sort().join(", ")} } from "./types.js";`,
    ...(dependencies.has("long") ? ["import long from 'long';"] : []),
    `import { ${namespace.name} } from "./protobuf/${namespace.name}.js";`,
  ].join("\n");

  const functionDeclarations = [
    ...(dependencies.has("isNonNullish")
      ? [
          `function isNonNullish<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}
`,
        ]
      : []),
    ...(dependencies.has("assertUnreachable")
      ? [
          `function assertUnreachable(x: never): never {
  throw new Error(\`Unexpected value: \${x}\`);
}
`,
        ]
      : []),
  ].join("\n");

  return `${importLines}

${functionDeclarations}
${definitions}
export {
  ${exports.join(",\n  ")},
};
`;
}

function createNestedNamespaceUnwrappers(
  namespace: proto.Namespace,
  prefix: string,
): {
  content: string;
  exports: string[];
  typeImports: string[];
  dependencies: Set<Dependencies>;
} {
  let definitions = "";
  const exports: string[] = [];
  const typeImports: string[] = [];
  const messages = getMessages(namespace);
  const dependencies = new Set<Dependencies>();

  for (const message of messages) {
    const {
      definitions: mapperDefinitions,
      exports: mapperExports,
      typeImports: mapperImports,
      dependencies: mapperDependencies,
    } = createMessageUnwrapperFunctions(message, prefix);
    definitions += mapperDefinitions;
    exports.push(...mapperExports);
    typeImports.push(...mapperImports);
    for (const dep of mapperDependencies) {
      dependencies.add(dep);
    }
  }

  const enumTypes = getEnums(namespace);
  for (const enumType of enumTypes) {
    const {
      definitions: enumDefinitions,
      exports: enumExports,
      typeImports: enumImports,
    } = createEnumUnwrapperFunction(enumType, prefix);
    definitions += enumDefinitions;
    exports.push(...enumExports);
    typeImports.push(...enumImports);
    dependencies.add("assertUnreachable");
  }

  const children = getChildNamespaces(namespace);
  for (const childNamespace of children) {
    const {
      content: childContent,
      exports: childExports,
      typeImports: childImports,
      dependencies: childDependencies,
    } = createNestedNamespaceUnwrappers(
      childNamespace,
      `${prefix}.${childNamespace.name}`,
    );
    definitions += childContent;
    exports.push(...childExports);
    typeImports.push(...childImports);
    for (const dep of childDependencies) {
      dependencies.add(dep);
    }
  }

  return {
    typeImports,
    exports,
    content: definitions,
    dependencies,
  };
}

function createRequiredFieldUnwrapExpression(
  field: proto.Field,
  name: string,
): {
  content: string;
  dependencies: Dependencies[];
} {
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
      return { content: name, dependencies: [] };
    case "fixed64":
    case "int64":
    case "sfixed64":
    case "sint64":
    case "uint64":
      return {
        content: `typeof ${name} === 'number' ? ${name} : long.fromBigInt(${name})`,
        dependencies: ["long"],
      };
    default:
      if (field.resolvedType instanceof proto.Enum) {
        return {
          content: `${getEnumUnwrapperFunctionName(field.resolvedType.name)}(${name})`,
          dependencies: [],
        };
      }
      return {
        content: `${getUnwrapperFunctionName(fieldType)}(${name})`,
        dependencies: [],
      };
  }
}

function createMaybeOptionalFieldUnwrapExpression(field: proto.Field): {
  content: string;
  dependencies: Dependencies[];
} {
  const isRequired = isRequiredField(field);
  if (!isRequired && field.resolvedType instanceof proto.Enum) {
    logError(
      `Field ${field.name} in message ${field.parent?.name} is an optional enum. Enums must be required and have a default zero value for an unspecified state.`,
    );
  }
  const fieldName = field.name;
  const baseExpression = createRequiredFieldUnwrapExpression(
    field,
    `${INPUT_VARIABLE}.${fieldName}`,
  );
  const content = isRequired
    ? `${fieldName}: ${baseExpression.content}`
    : `...(isNonNullish(${INPUT_VARIABLE}.${fieldName}) ? { ${fieldName}: ${baseExpression.content} } : {})`;
  const dependencies: Dependencies[] = isRequired
    ? baseExpression.dependencies
    : [...baseExpression.dependencies, "isNonNullish"];
  return { content, dependencies };
}

function createMaybeRepeatedFieldUnwrapExpression(field: proto.Field): {
  content: string;
  dependencies: Dependencies[];
} {
  if (!field.repeated) return createMaybeOptionalFieldUnwrapExpression(field);
  const fieldName = field.name;
  const baseExpression = createRequiredFieldUnwrapExpression(
    field,
    MAP_VARIABLE,
  );
  const needsMap = baseExpression.content !== MAP_VARIABLE;
  const content = needsMap
    ? `${fieldName}: (${INPUT_VARIABLE}.${fieldName} ?? []).map((${MAP_VARIABLE}) => ${baseExpression.content})`
    : `${fieldName}: ${INPUT_VARIABLE}.${fieldName} ?? []`;
  return {
    content,
    dependencies: baseExpression.dependencies,
  };
}

function createMessageUnwrapperFunctions(message: proto.Type, prefix: string) {
  const functionName = getUnwrapperFunctionName(message.name);
  const fieldResults = getFields(message).map(
    createMaybeRepeatedFieldUnwrapExpression,
  );
  const contentLines = fieldResults.map((result) => result.content);
  const definitions = `
/**
 * Maps a plain object to a ${prefix}.I${message.name} protobuf interface.
 * @param ${INPUT_VARIABLE} Plain object containing the message
 * @returns ${prefix}.I${message.name} protobuf interface
 */
function ${functionName}(${INPUT_VARIABLE}: ${message.name}): ${prefix}.I${message.name} {
  const proto: ${prefix}.I${message.name} = {
    ${contentLines.join(",\n    ")}
  };
  return proto;
}
`;
  return {
    definitions,
    exports: [functionName],
    typeImports: [message.name],
    dependencies: new Set(
      fieldResults.flatMap((result) => result.dependencies),
    ),
  };
}

function createEnumUnwrapperFunction(enumType: proto.Enum, prefix: string) {
  const functionName = getEnumUnwrapperFunctionName(enumType.name);
  const definitions = `
/**
 * Maps a value of ${enumType.name} type to the corresponding protobuf enum value.
 * @param ${INPUT_VARIABLE} Value of ${enumType.name} type
 * @returns Corresponding protobuf enum value
 */
function ${functionName}(${INPUT_VARIABLE}: ${enumType.name}): number {
  switch (${INPUT_VARIABLE}) {
${Object.entries(enumType.values)
  .map(
    ([key]) => `    case '${key}':
      return ${prefix}.${enumType.name}.${key};`,
  )
  .join("\n")}
    default:
      return assertUnreachable(${INPUT_VARIABLE});
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
  createRootNamespaceUnwrappers,
  getUnwrapperFunctionName,
  getEnumUnwrapperFunctionName,
};
