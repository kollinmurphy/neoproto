import proto from "protobufjs";

function createNamespaceSerializers(
  namespace: proto.Namespace,
  messageNames: string[],
): string {
  let serializationFunctions = `import { ${namespace.name} } from "./example.js";
  `;
  const functionNames: string[] = [];
  for (const messageName of messageNames) {
    const message = namespace.nested?.[messageName] as proto.Type;
    const { definitions, names } = createMessageSerializers(
      namespace.name,
      message,
    );
    serializationFunctions += definitions;
    functionNames.push(...names);
  }
  serializationFunctions += `
  export {
    ${functionNames.join(",\n  ")},
  };
  `;
  return serializationFunctions;
}

function createMessageSerializers(namespace: string, message: proto.Type) {
  const definitions = `
/**
 * Serializes a ${message.name} message to a Uint8Array.
 * @param input ${message.name} message to serialize
 * @returns Uint8Array containing the serialized message
 */
function serialize${message.name}(input: ${namespace}.${message.name}): Uint8Array {
  return ${namespace}.${message.name}.encode(input).finish();
}

/**
 * Deserializes a ${message.name} message from a Uint8Array.
 * @param input Uint8Array containing the serialized message
 * @returns ${message.name} message
 */
function deserialize${message.name}(input: Uint8Array): ${namespace}.${message.name} {
  return ${namespace}.${message.name}.decode(input);
}
`;
  return {
    definitions,
    names: [`serialize${message.name}`, `deserialize${message.name}`],
  };
}

export { createNamespaceSerializers };
