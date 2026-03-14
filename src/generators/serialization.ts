import proto from "protobufjs";
import { capitalizeFirstLetter } from "../utils/string-manipulation.js";
import { getWrapperFunctionName } from "./wrap.js";
import { getUnwrapperFunctionName } from "./unwrap.js";
import { logError } from "../utils/logger.js";

/**
 * Generates wrapper functions for all messages and enums in a protobuf namespace, including nested namespaces, and returns the content of the wrapper file as a string.
 * @param namespaceName - The name of the protobuf namespace to generate wrapper functions for, which is used to reference the correct message types in the protobufjs encoding and decoding functions
 * @param topLevelMessages - An array of protobuf message types that are defined at the top level of the protobuf namespace, which are used to generate the serializer and deserializer function definitions for each message type
 * @returns A string containing the content of the wrapper file with all the generated wrapper functions for the protobuf namespace
 */
function createNamespaceSerializers(namespaceName: string, topLevelMessages: proto.Type[]): string {
  let definitions = "";
  const exports: string[] = [];
  const typeImports: string[] = [];
  const wrapperImports: string[] = [];
  const unwrapperImports: string[] = [];

  const rootNamespaceName = namespaceName.split(".").filter(Boolean)[0];
  const namespaceAccess = namespaceName.split(".").filter(Boolean).join(".");

  for (const message of topLevelMessages) {
    const {
      definitions: messageDefinitions,
      exports: messageExports,
      typeImports: messageImports,
      wrapperImports: messageWrapperImports,
      unwrapperImports: messageUnwrapperImports,
    } = createMessageSerializers(namespaceAccess, message);
    definitions += messageDefinitions;
    exports.push(...messageExports);
    typeImports.push(...messageImports);
    wrapperImports.push(...messageWrapperImports);
    unwrapperImports.push(...messageUnwrapperImports);
  }

  if (!definitions)
    logError(
      `No top-level messages found in namespace ${namespaceName}.`,
    );


  const dedupedTypeImports = [...new Set(typeImports)];
  const dedupedWrapperImports = [...new Set(wrapperImports)];
  const dedupedUnwrapperImports = [...new Set(unwrapperImports)];
  return `import type { ${dedupedTypeImports.join(", ")} } from "./types.js";
import { ${rootNamespaceName} } from "./protobuf/${rootNamespaceName}.js";
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
 * @param namespaceAccess - A string representing the access path to the protobuf namespace in the generated code, which is used to reference the correct message types in the protobufjs encoding and decoding functions. For example, if the namespace is "my.api.v1", the namespaceAccess would be "my.api.v1" to access the message types defined within that namespace.
 * @param message - The protobuf message type to create the serializer and deserializer functions for
 * @returns An object containing the TypeScript definitions for the serializer and deserializer functions, the names of the functions to be exported, and arrays of imports required for the message types and wrapper/unwrapper functions used in the definitions
 */
function createMessageSerializers(
  namespaceAccess: string,
  message: proto.Type,
): {
  definitions: string;
  exports: string[];
  typeImports: string[];
  wrapperImports: string[];
  unwrapperImports: string[];
} {
  const serialize = getSerializerFunctionName(message.name);
  const deserialize = getDeserializerFunctionName(message.name);
  const wrap = getWrapperFunctionName(message.name);
  const unwrap = getUnwrapperFunctionName(message.name);

  const definitions = `
/**
 * Serializes a ${message.name} message to a Uint8Array.
 * @param input ${message.name} message to serialize
 * @returns Uint8Array containing the serialized message
 */
function ${serialize}(input: ${message.name}): Uint8Array {
  return ${namespaceAccess}.${message.name}.encode(${unwrap}(input)).finish();
}

/**
 * Deserializes a ${message.name} message from a Uint8Array.
 * @param input Uint8Array containing the serialized message
 * @returns ${message.name} message
 */
function ${deserialize}(input: Uint8Array): ${message.name} {
  return ${wrap}(${namespaceAccess}.${message.name}.decode(input));
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
