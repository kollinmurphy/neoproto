import proto from "protobufjs";
import { capitalizeFirstLetter } from "../utils/string-manipulation.js";
import { getWrapperFunctionName } from "./wrap.js";
import { getUnwrapperFunctionName } from "./unwrap.js";
import { getMessages } from "../utils/protobuf.js";
import { getMessageId } from "../utils/associations.js";
import { logError } from "../utils/logger.js";

/**
 * Generates wrapper functions for all messages and enums in a protobuf namespace, including nested namespaces, and returns the content of the wrapper file as a string.
 * @param namespace - The protobuf namespace to create wrapper functions for
 * @returns A string containing the content of the wrapper file with all the generated wrapper functions for the protobuf namespace
 */
function createNamespaceSerializers(namespace: proto.Namespace): string {
  let definitions = "";
  const exports: string[] = [];
  const typeImports: string[] = [];
  const wrapperImports: string[] = [];
  const unwrapperImports: string[] = [];
  const messages = getMessages(namespace);
  for (const message of messages) {
    if (!getMessageId(message)) continue;
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

  if (!definitions)
    logError(
      `No messages with a valid message ID found in namespace ${namespace.name}.`,
    );

  const dedupedTypeImports = [...new Set(typeImports)];
  const dedupedWrapperImports = [...new Set(wrapperImports)];
  const dedupedUnwrapperImports = [...new Set(unwrapperImports)];
  return `import type { ${dedupedTypeImports.join(", ")} } from "./types.js";
import { ${namespace.name} } from "./protobuf/${namespace.name}.js";
import { ${dedupedWrapperImports.join(", ")} } from "./wrap.js";
import { ${dedupedUnwrapperImports.join(", ")} } from "./unwrap.js";
${definitions}
export {
  ${exports.sort().join(",\n  ")},
};
`;
}

/**
 * Generates a serializer and deserializer function for a single protobuf message type. The serializer function takes an instance of the message type and returns a Uint8Array containing the serialized message, while the deserializer function takes a Uint8Array containing the serialized message and returns an instance of the message type. The functions use the protobufjs library to perform the encoding and decoding, and they also utilize wrapper and unwrapper functions to convert between the protobuf message format and the TypeScript types defined for the message.
 * @param namespace - The name of the protobuf namespace that the message type belongs to, which is used to reference the correct message type in the protobufjs encoding and decoding functions
 * @param message - The protobuf message type to create the serializer and deserializer functions for
 * @returns An object containing the TypeScript definitions for the serializer and deserializer functions, the names of the functions to be exported, and arrays of imports required for the message types and wrapper/unwrapper functions used in the definitions
 */
function createMessageSerializers(
  namespace: string,
  message: proto.Type,
): {
  definitions: string;
  exports: string[];
  typeImports: string[];
  wrapperImports: string[];
  unwrapperImports: string[];
} {
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

/**
 * Generates a serializer and deserializer function name for a given protobuf message name by capitalizing the first letter of the message name and prefixing it with "serialize" for the serializer function and "deserialize" for the deserializer function. For example, if the message name is "MyMessage", the generated serializer function name would be "serializeMyMessage" and the deserializer function name would be "deserializeMyMessage".
 * @param messageName - The name of the protobuf message type to generate the serializer and deserializer function names for
 * @returns An object containing the generated serializer and deserializer function names for the specified protobuf message type
 */
function getSerializerFunctionName(messageName: string) {
  return `serialize${capitalizeFirstLetter(messageName)}`;
}

/**
 * Generates a deserializer function name for a given protobuf message name by capitalizing the first letter of the message name and prefixing it with "deserialize". For example, if the message name is "MyMessage", the generated deserializer function name would be "deserializeMyMessage".
 * @param messageName - The name of the protobuf message type to generate the deserializer function name for
 * @returns A string containing the generated deserializer function name for the specified protobuf message type
 */
function getDeserializerFunctionName(messageName: string) {
  return `deserialize${capitalizeFirstLetter(messageName)}`;
}

export {
  createNamespaceSerializers,
  createMessageSerializers,
  getSerializerFunctionName,
  getDeserializerFunctionName,
};
