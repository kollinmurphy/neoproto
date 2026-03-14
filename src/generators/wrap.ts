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

/**
 * The set of dependencies that an inner function may require. If not needed, they will not be generated.
 */
type Dependency = "isNonNullable" | "assertUnreachable";

const INPUT_VARIABLE = "input";
const MAP_VARIABLE = "item";

/**
 * Generates wrapper functions for all messages and enums in a protobuf namespace, including nested namespaces, and returns the content of the wrapper file as a string.
 * @param namespace - The protobuf namespace to create wrapper functions for
 * @returns A string containing the content of the wrapper file with all the generated wrapper functions for the protobuf namespace
 */
function createRootNamespaceWrappers(namespace: proto.Namespace): string {
  const rootNamespaceName = namespace.fullName.split(".").filter(Boolean)[0];
  const namespaceAccess = namespace.fullName.split(".").filter(Boolean).join(".");

  const {
    content: definitions,
    exports,
    typeImports,
    dependencies,
  } = createNestedNamespaceWrappers(namespace, namespaceAccess);

  const importLines = `import type { ${[...new Set(typeImports)].sort().join(", ")} } from "./types.js";
import { ${rootNamespaceName} } from "./protobuf/${rootNamespaceName}.js";`;

  const functionDeclarations = [
    ...(dependencies.has("isNonNullable")
      ? [
        `function isNonNullable<T>(value: T): value is NonNullable<T> {
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
 * Recursively creates wrapper functions for all messages and enums in a protobuf namespace, including nested namespaces.
 * @param namespace - The protobuf namespace to create wrapper functions for
 * @param prefix - The prefix to use for the wrapper function names, which should correspond to the namespace hierarchy (e.g., "MyNamespace.SubNamespace")
 * @returns An object containing the content, exports, imports, and dependencies for the wrapper functions in the namespace
 */
function createNestedNamespaceWrappers(
  namespace: proto.Namespace,
  prefix: string,
): {
  content: string;
  exports: string[];
  typeImports: string[];
  dependencies: Set<Dependency>;
} {
  let definitions = "";
  const exports: string[] = [];
  const imports: string[] = [];
  const dependencies = new Set<Dependency>();

  const messages = getMessages(namespace);
  for (const message of messages) {
    const {
      definitions: mapperDefinitions,
      exports: mapperExports,
      imports: mapperImports,
      dependencies: mapperDependencies,
    } = createMessageWrapperFunctions(prefix, message);
    definitions += mapperDefinitions;
    exports.push(...mapperExports);
    imports.push(...mapperImports);
    mapperDependencies.forEach((dep) => dependencies.add(dep));
  }

  const enumTypes = getEnums(namespace);
  for (const enumType of enumTypes) {
    const {
      definitions: enumDefinitions,
      exports: enumExports,
      imports: enumImports,
      dependencies: enumDependencies,
    } = createEnumWrapperFunction(enumType, prefix);
    definitions += enumDefinitions;
    exports.push(...enumExports);
    imports.push(...enumImports);
    enumDependencies.forEach((dep) => dependencies.add(dep));
  }

  const children = getChildNamespaces(namespace);
  for (const childNamespace of children) {
    const {
      content: childDefinitions,
      exports: childExports,
      typeImports: childImports,
      dependencies: childDependencies,
    } = createNestedNamespaceWrappers(
      childNamespace,
      `${prefix}.${childNamespace.name}`,
    );
    definitions += childDefinitions;
    exports.push(...childExports);
    imports.push(...childImports);
    childDependencies.forEach((dep) => dependencies.add(dep));
  }

  return {
    content: definitions,
    exports,
    typeImports: imports,
    dependencies,
  };
}

/**
 * Creates a TS expression for a required field, or for an optional field that has already been checked for non-nullability.
 * @param field - The protobuf field to create the expression for
 * @param name - The name of the variable to use in the expression
 * @returns An object containing the content and dependencies for the field
 */
function createRequiredFieldWrapExpression(field: proto.Field, name: string) {
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
        content: `typeof ${name} === "number" ? BigInt(${name}) : ${name}.toBigInt()`,
        dependencies: [],
      };
    default:
      if (field.resolvedType instanceof proto.Enum) {
        return {
          content: `${getEnumWrapperFunctionName(field.resolvedType.name)}(${name})`,
          dependencies: [],
        };
      }
      return {
        content: `${getWrapperFunctionName(fieldType)}(${name})`,
        dependencies: [],
      };
  }
}

/**
 * Creates a TS expression for a field that may be optional. If the field is
 * required, it will simply create a required field expression. If the field is
 * optional, it will create an expression that conditionally includes the field
 * in the resulting object if it is non-nullable. Note that for optional fields,
 * if the default value (e.g., empty string, 0, false) is present, it will be
 * omitted from the resulting object, as the protobufjs library treats missing
 * fields and fields with default values as equivalent when decoding messages.
 * @param field - The protobuf field to create the expression for
 * @returns An object containing the content and dependencies for the field
 */
function createMaybeOptionalFieldWrapExpression(field: proto.Field): {
  content: string;
  dependencies: Dependency[];
} {
  const baseExpression = createRequiredFieldWrapExpression(
    field,
    `input.${field.name}`,
  );
  const required = isRequiredField(field);
  return {
    content: required
      ? `${field.name}: ${baseExpression.content}`
      : `...(isNonNullable(input.${field.name}) ? { ${field.name}: ${baseExpression.content} } : {})`,
    dependencies: required
      ? baseExpression.dependencies
      : [...baseExpression.dependencies, "isNonNullable"],
  };
}

/**
 * Creates a TS expression for a field that may be repeated.
 * Note that for repeated fields, if the field is missing, it will be treated as an empty array.
 * @param field - The protobuf field to create the expression for
 * @returns An object containing the content and dependencies for the field
 */
function createMaybeRepeatedFieldWrapExpression(field: proto.Field): {
  content: string;
  dependencies: Dependency[];
} {
  if (!field.repeated) return createMaybeOptionalFieldWrapExpression(field);
  const baseExpression = createRequiredFieldWrapExpression(field, MAP_VARIABLE);
  const needsMap = baseExpression.content !== MAP_VARIABLE;
  return {
    content: needsMap
      ? `${field.name}: (input.${field.name} ?? []).map((${MAP_VARIABLE}) => ${baseExpression.content})`
      : `${field.name}: input.${field.name} ?? []`,
    dependencies: baseExpression.dependencies,
  };
}

/**
 * Creates a wrapper function for a protobuf message type that maps a protobuf message to a plain object.
 * @param namespace - The namespace in which the message type is defined
 * @param message - The protobuf message type to create the wrapper function for
 * @returns An object containing the definitions, exports, imports, and dependencies for the message wrapper function
 */
function createMessageWrapperFunctions(
  namespace: string,
  message: proto.Type,
): {
  definitions: string;
  exports: string[];
  imports: string[];
  dependencies: Dependency[];
} {
  const functionName = getWrapperFunctionName(message.name);
  const fields = getFields(message).map(createMaybeOneOfFieldWrapExpression);
  const definitions = `
/**
 * Maps a ${message.name} protobuf message to a plain object.
 * @param ${INPUT_VARIABLE} ${message.name} protobuf message to map
 * @returns Plain object containing the mapped message
 */
function ${functionName}(${INPUT_VARIABLE}: ${namespace}.I${message.name}): ${message.name} {
  const object: ${message.name} = {
    ${fields.map((field) => field.content).join(",\n    ")}
  };
  return object;
}
`;
  return {
    definitions,
    exports: [functionName],
    imports: [message.name],
    dependencies: Array.from(
      new Set(fields.flatMap((field) => field.dependencies)),
    ),
  };
}

function createMaybeOneOfFieldWrapExpression(field: MaybeOneOfField): {
  content: string;
  dependencies: Dependency[];
} {
  if (!("_isOneOf" in field))
    return createMaybeRepeatedFieldWrapExpression(field);
  const mappedFields = field.fields.map((f) => ({
    ...createRequiredFieldWrapExpression(f, `${INPUT_VARIABLE}.${f.name}`),
    name: f.name,
  }));
  const content = `...(() => {
    ${mappedFields
      .map(
        (f) => `  if (isNonNullable(${INPUT_VARIABLE}.${f.name})) {
        const partial: Pick<${field.oneOf.parent?.name}, "${field.name}"> = { ${field.name}: { ${f.name}: ${f.content} } };
        return partial;
      };`,
      )
      .join("\n    ")}
    return {};
    })()`;
  return {
    content,
    dependencies: [
      "isNonNullable",
      ...mappedFields.flatMap((f) => f.dependencies),
    ],
  };
}

/**
 * Creates a wrapper function for a protobuf enum type that maps enum values to their corresponding string literal types.
 * @param enumType - The protobuf enum type to create the wrapper function for
 * @param namespace - The namespace in which the enum type is defined
 * @returns An object containing the definitions, exports, imports, and dependencies for the enum wrapper function
 */
function createEnumWrapperFunction(
  enumType: proto.Enum,
  namespace: string,
): {
  definitions: string;
  exports: string[];
  imports: string[];
  dependencies: Dependency[];
} {
  const functionName = getEnumWrapperFunctionName(enumType.name);
  const definitions = `
/**
 * Maps a ${enumType.name} protobuf enum value to its corresponding string literal type.
 * @param ${INPUT_VARIABLE} ${enumType.name} protobuf enum value to map
 * @returns String literal type corresponding to the enum value
 */
function ${functionName}(${INPUT_VARIABLE}: ${namespace}.${enumType.name}): ${enumType.name} {
  switch (${INPUT_VARIABLE}) {
    ${Object.entries(enumType.values)
      .map(
        ([key]) => `case ${namespace}.${enumType.name}.${key}:
      return "${key}" as ${enumType.name};`,
      )
      .join("\n    ")}
    default:
      assertUnreachable(${INPUT_VARIABLE});
  }
}
`;
  return {
    definitions,
    exports: [functionName],
    imports: [enumType.name],
    dependencies: ["assertUnreachable"],
  };
}

/**
 * Generates a wrapper function name for a protobuf message type.
 * @param messageName - The name of the protobuf message type
 * @returns The generated wrapper function name for the message type
 */
function getWrapperFunctionName(messageName: string) {
  return `map${capitalizeFirstLetter(messageName)}ProtoToObject`;
}

/**
 * Generates a wrapper function name for a protobuf enum type.
 * @param enumName - The name of the protobuf enum type
 * @returns The generated wrapper function name for the enum type
 */
function getEnumWrapperFunctionName(enumName: string) {
  return `map${capitalizeFirstLetter(enumName)}ProtoToValue`;
}

export { createRootNamespaceWrappers, getWrapperFunctionName };
