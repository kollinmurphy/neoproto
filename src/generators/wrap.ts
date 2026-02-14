import proto from "protobufjs";
import { capitalizeFirstLetter } from "../utils/string-manipulation.js";
import {
  getChildNamespaces,
  getEnums,
  getFields,
  getMessages,
  isRequiredField,
} from "../utils/protobuf.js";

type Dependency = "isNonNullish" | "assertUnreachable";

const INPUT_VARIABLE = "input";
const MAP_VARIABLE = "item";

function createRootNamespaceWrappers(namespace: proto.Namespace): string {
  const {
    content: definitions,
    exports,
    typeImports,
    dependencies,
  } = createNestedNamespaceWrappers(namespace, namespace.name);

  const importLines = `import type { ${[...new Set(typeImports)].sort().join(", ")} } from "./types.js";
import { ${namespace.name} } from "./protobuf/${namespace.name}.js";`;

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

function createMaybeOptionalFieldWrapExpression(field: proto.Field): {
  content: string;
  dependencies: Dependency[];
} {
  const fieldName = field.name;
  const baseExpression = createRequiredFieldWrapExpression(
    field,
    `input.${fieldName}`,
  );
  const dependencies: Dependency[] = isRequiredField(field)
    ? baseExpression.dependencies
    : [...baseExpression.dependencies, "isNonNullish"];
  return {
    content: isRequiredField(field)
      ? `${fieldName}: ${baseExpression.content}`
      : `...(isNonNullish(input.${fieldName}) ? { ${fieldName}: ${baseExpression.content} } : {})`,
    dependencies,
  };
}

function createMaybeRepeatedFieldWrapExpression(field: proto.Field): {
  content: string;
  dependencies: Dependency[];
} {
  if (!field.repeated) return createMaybeOptionalFieldWrapExpression(field);
  const fieldName = field.name;
  const baseExpression = createRequiredFieldWrapExpression(field, MAP_VARIABLE);
  const needsMap = baseExpression.content !== MAP_VARIABLE;
  return {
    content: needsMap
      ? `${fieldName}: (input.${fieldName} ?? []).map((${MAP_VARIABLE}) => ${baseExpression.content})`
      : `${fieldName}: input.${fieldName} ?? []`,
    dependencies: baseExpression.dependencies,
  };
}

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
  const fields = getFields(message).map(createMaybeRepeatedFieldWrapExpression);
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

function getWrapperFunctionName(messageName: string) {
  return `map${capitalizeFirstLetter(messageName)}ProtoToObject`;
}

function getEnumWrapperFunctionName(enumName: string) {
  return `map${capitalizeFirstLetter(enumName)}ProtoToValue`;
}

export { createRootNamespaceWrappers, getWrapperFunctionName };
