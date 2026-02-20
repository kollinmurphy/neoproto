import proto from "protobufjs";
import { capitalizeFirstLetter } from "../utils/string-manipulation.js";
import {
  getChildNamespaces,
  getEnums,
  getFields,
  getMessages,
  isRequiredField,
  MaybeOneOfField,
} from "../utils/protobuf.js";
import { logError } from "../utils/logger.js";

const INPUT_VARIABLE = "input";
const MAP_VARIABLE = "item";

/**
 * The set of dependencies that an inner function may require. If not needed, they will not be generated.
 */
type Dependencies = "long" | "isNonNullish" | "assertUnreachable";

/**
 * Generates unwrapper functions for all messages and enums in a protobuf namespace, including nested namespaces, and returns the content of the unwrapper file as a string.
 * @param namespace - The protobuf namespace to create unwrapper functions for
 * @returns A string containing the content of the unwrapper file with all the generated unwrapper functions for the protobuf namespace
 */
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

/**
 * Recursively creates unwrapper functions for all messages and enums in a protobuf namespace, including nested namespaces.
 * @param namespace - The protobuf namespace to create unwrapper functions for
 * @param prefix - The prefix to use for the unwrapper function names, which should correspond to the namespace hierarchy (e.g., "MyNamespace.SubNamespace")
 * @returns An object containing the content, exports, imports, and dependencies for the unwrapper functions in the namespace
 */
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

/**
 * Creates a TS expression for a required field, or for an optional field that has already been checked for non-nullability.
 * @param field - The protobuf field to create the expression for
 * @param name - The name of the variable to use in the expression
 * @returns An object containing the content and dependencies for the field
 */
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
        content: `typeof ${name} === 'number' ? ${name} : long.fromString(${name}.toString())`,
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

/**
 * Creates a TS expression for a field that may be optional. If the field is
 * @param field - The protobuf field to create the expression for
 * @returns An object containing the content and dependencies for the field
 */
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

function createMaybeOneOfFieldUnwrapExpression(field: MaybeOneOfField): {
  content: string;
  dependencies: Dependencies[];
} {
  if (!("_isOneOf" in field))
    return createMaybeRepeatedFieldUnwrapExpression(field);
  const mappedFields = field.fields.map((f) => ({
    ...createRequiredFieldUnwrapExpression(f, `oneOfValue.${f.name}`),
    name: f.name,
  }));
  const content = `...(() => {
    const oneOfValue = ${INPUT_VARIABLE}.${field.name};
    if (!oneOfValue) return {};
    ${mappedFields
      .map(
        (f) =>
          `if ('${f.name}' in oneOfValue) return { ${f.name}: ${f.content} };`,
      )
      .join("\n")}
    return {};
  })()`;
  return {
    content,
    dependencies: mappedFields.flatMap((f) => f.dependencies),
  };
}

/**
 * Creates an unwrapper function for a protobuf message, which maps a plain object to the corresponding protobuf interface. The function will handle both required and optional fields, as well as repeated fields, and will use the appropriate unwrapper functions for nested messages and enums as needed.
 * @param message - The protobuf message to create the unwrapper function for
 * @param prefix - The prefix to use for the unwrapper function name, which should correspond to the namespace hierarchy (e.g., "MyNamespace.SubNamespace")
 * @returns An object containing the content, exports, imports, and dependencies for the unwrapper function for the message
 */
function createMessageUnwrapperFunctions(message: proto.Type, prefix: string) {
  const functionName = getUnwrapperFunctionName(message.name);
  const fieldResults = getFields(message).map(
    createMaybeOneOfFieldUnwrapExpression,
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

/**
 * Creates an unwrapper function for a protobuf enum, which maps a value of the enum type to the corresponding protobuf enum value. The function will use a switch statement to handle all possible values of the enum and will throw an error if an unexpected value is encountered.
 * @param enumType - The protobuf enum to create the unwrapper function for
 * @param prefix - The prefix to use for the unwrapper function name, which should correspond to the namespace hierarchy (e.g., "MyNamespace.SubNamespace")
 * @returns An object containing the content, exports, imports, and dependencies for the unwrapper function for the enum
 */
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

/**
 * Generates the name of the unwrapper function for a given protobuf message, which follows the convention of "map{MessageName}ObjectToProto" where {MessageName} is the name of the protobuf message with the first letter capitalized.
 * @param messageName - The name of the protobuf message to generate the unwrapper function name for
 * @returns The name of the unwrapper function for the given protobuf message
 */
function getUnwrapperFunctionName(messageName: string) {
  return `map${capitalizeFirstLetter(messageName)}ObjectToProto`;
}

/**
 * Generates the name of the unwrapper function for a given protobuf enum, which follows the convention of "map{EnumName}ValueToProto" where {EnumName} is the name of the protobuf enum with the first letter capitalized.
 * @param enumName - The name of the protobuf enum to generate the unwrapper function name for
 * @returns The name of the unwrapper function for the given protobuf enum
 */
function getEnumUnwrapperFunctionName(enumName: string) {
  return `map${capitalizeFirstLetter(enumName)}ValueToProto`;
}

export {
  createRootNamespaceUnwrappers,
  getUnwrapperFunctionName,
  getEnumUnwrapperFunctionName,
};
