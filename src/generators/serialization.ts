import proto from "protobufjs";
import { capitalizeFirstLetter } from "../utils/string-manipulation.js";
import { getWrapperFunctionName } from "./wrap.js";
import { getUnwrapperFunctionName } from "./unwrap.js";

function createNamespaceSerializers(
  namespace: proto.Namespace,
  messageNames: string[],
): string {
  let definitions = "";
  const exports: string[] = [];
  const typeImports: string[] = [];
  const wrapperImports: string[] = [];
  const unwrapperImports: string[] = [];
  for (const messageName of messageNames) {
    const message = namespace.nested?.[messageName] as proto.Type;
    const {
      definitions: messageDefinitions,
      exports: messageExports,
      typeImports: messageImports,
      wrapperImports: messageWrapperImports,
      unwrapperImports: messageUnwrapperImports,
    } = createMessageSerializers(namespace.name, message);
    definitions += messageDefinitions;
    exports.push(...messageExports);
    typeImports.push(...messageImports);
    wrapperImports.push(...messageWrapperImports);
    unwrapperImports.push(...messageUnwrapperImports);
  }
  const dedupedTypeImports = [...new Set(typeImports)];
  const dedupedWrapperImports = [...new Set(wrapperImports)];
  const dedupedUnwrapperImports = [...new Set(unwrapperImports)];
  return `import type { ${dedupedTypeImports.join(", ")} } from "./types.js";
import { ${namespace.name} } from "./protobuf/${namespace.name}.js";
import { ${dedupedWrapperImports.join(", ")} } from "./wrap.js";
import { ${dedupedUnwrapperImports.join(", ")} } from "./unwrap.js";
${definitions}
export {
  ${exports.join(",\n  ")},
};
`;
}

function createMessageSerializers(namespace: string, message: proto.Type) {
  const functionSuffix = capitalizeFirstLetter(message.name);

  const serialize = `serialize${functionSuffix}`;
  const deserialize = `deserialize${functionSuffix}`;
  const wrap = getWrapperFunctionName(message.name);
  const unwrap = getUnwrapperFunctionName(message.name);

  const definitions = `
/**
 * Serializes a ${message.name} message to a Uint8Array.
 * @param input ${message.name} message to serialize
 * @returns Uint8Array containing the serialized message
 */
function ${serialize}(input: ${message.name}): Uint8Array {
  return ${namespace}.${message.name}.encode(${unwrap}(input)).finish();
}

/**
 * Deserializes a ${message.name} message from a Uint8Array.
 * @param input Uint8Array containing the serialized message
 * @returns ${message.name} message
 */
function ${deserialize}(input: Uint8Array): ${message.name} {
  return ${wrap}(${namespace}.${message.name}.decode(input));
}
`;
  return {
    definitions,
    exports: [serialize, deserialize],
    typeImports: [message.name],
    wrapperImports: [wrap],
    unwrapperImports: [unwrap],
  };
}

function getSerializerFunctionName(messageName: string) {
  return `serialize${capitalizeFirstLetter(messageName)}`;
}

function getDeserializerFunctionName(messageName: string) {
  return `deserialize${capitalizeFirstLetter(messageName)}`;
}

export {
  createNamespaceSerializers,
  getSerializerFunctionName,
  getDeserializerFunctionName,
};
