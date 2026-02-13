import proto from "protobufjs";
import { lowercaseFirstLetter } from "../utils/string-manipulation.js";
import {
  getDeserializerFunctionName,
  getSerializerFunctionName,
} from "./serialization.js";

function createNamespaceTraits(
  namespace: proto.Namespace,
  messageNames: string[],
): string {
  let traitsContent = "";
  const traitNames: string[] = [];
  const allImports: string[] = [];
  for (const messageName of messageNames) {
    const message = namespace.nested?.[messageName] as proto.Type;
    const { definition, name, imports } = createMessageTraits(message);
    traitsContent += definition;
    traitNames.push(name);
    allImports.push(...imports);
  }
  const { baseName, version } = parseNamespace(namespace.name);
  traitNames.push("API_NAME", "API_VERSION");
  return `import { ${[...new Set(allImports)].sort().join(", ")} } from "./serialization.js";

const API_NAME = "${baseName}";
const API_VERSION = ${version};
${traitsContent}
export {
  ${traitNames.sort().join(",\n  ")}
};
`;
}

function parseNamespace(namespace: string) {
  const match = namespace.match(/^(.*)_?v(\d+)$/i);
  if (!match) {
    throw new Error(
      `Invalid namespace format: ${namespace}. Expected format is "NamespaceV1"`,
    );
  }
  return {
    baseName: match[1]?.replace(/_?$/, "") || "", // Remove trailing underscore if present
    version: match[2],
  };
}

function createMessageTraits(message: proto.Type) {
  const traitName = `${lowercaseFirstLetter(message.name)}Traits`;
  const serialize = getSerializerFunctionName(message.name);
  const deserialize = getDeserializerFunctionName(message.name);
  const definition = `
const ${traitName} = {
  deserialize: ${deserialize},
  serialize: ${serialize},
};\n`;
  return {
    definition,
    name: traitName,
    imports: [serialize, deserialize],
  };
}

export { createNamespaceTraits };
