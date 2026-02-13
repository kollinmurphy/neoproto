import proto from "protobufjs";
import { lowercaseFirstLetter } from "../utils/string-manipulation.js";

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
  traitsContent += `export {
  ${traitNames.join(",\n  ")}
};
`;
  traitsContent = `import { ${[...new Set(allImports)].join(", ")} } from "./serialization.js";

${traitsContent}`;
  return traitsContent;
}

function createMessageTraits(message: proto.Type) {
  const traitName = `${lowercaseFirstLetter(message.name)}Traits`;
  const serializeFunctionName = `serialize${message.name}`;
  const deserializeFunctionName = `deserialize${message.name}`;
  const definition = `const ${traitName} = {
  serialize: ${serializeFunctionName},
  deserialize: ${deserializeFunctionName},
};\n\n`;
  return {
    definition,
    name: traitName,
    imports: [serializeFunctionName, deserializeFunctionName],
  };
}

export { createNamespaceTraits };
