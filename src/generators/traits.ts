import proto from "protobufjs";
import {
  lowercaseFirstLetter,
  removeRequestSuffix,
} from "../utils/string-manipulation.js";
import {
  getDeserializerFunctionName,
  getSerializerFunctionName,
} from "./serialization.js";
import { getMessages } from "../utils/protobuf.js";
import { getMessageId } from "../utils/associations.js";
import { logError } from "../utils/logger.js";

/**
 * Generates wrapper functions for all messages and enums in a protobuf namespace, including nested namespaces, and returns the content of the wrapper file as a string.
 * @param namespace - The protobuf namespace to create wrapper functions for
 * @param associations - An array of tuples representing request-response message associations, where each tuple contains a request message type and its corresponding response message type. These associations are used to generate additional traits for request-response pairs.
 * @returns A string containing the content of the wrapper file with all the generated wrapper functions for the protobuf namespace
 */
function createNamespaceTraits(
  namespace: proto.Namespace,
  associations: [proto.Type, proto.Type][],
): string {
  let traitsContent = "";
  const messageTraits: string[] = [];
  const allImports: string[] = [];
  const messages = getMessages(namespace);
  for (const message of messages) {
    const result = createMessageTraits(message);
    if (!result) {
      continue;
    }
    const { definition, name, imports } = result;
    traitsContent += definition;
    messageTraits.push(name);
    allImports.push(...imports);
  }
  const { baseName, version } = parseNamespace(namespace.name);
  messageTraits.push("API_NAME", "API_VERSION");

  let associationTraits = "";
  for (const [request, response] of associations) {
    const pairName = removeRequestSuffix(request.name);
    const pairTraitsName = getReqResTraitName(pairName);
    const requestTraitName = getTraitName(request.name);
    const responseTraitName = getTraitName(response.name);
    associationTraits += `const ${pairTraitsName} = {
  name: "${pairName}",
  request: ${requestTraitName},
  response: ${responseTraitName},
};\n`;
    if (!messageTraits.includes(requestTraitName)) {
      logError(
        `${request.name} is missing a message ID but is detected as a request message. Please add a 'MessageId: ###' comment to it.`,
      );
    }
    if (!messageTraits.includes(responseTraitName)) {
      logError(
        `${response.name} is missing a message ID but is detected as a response message. Please add a 'MessageId: ###' comment to it.`,
      );
    }
    messageTraits.push(pairTraitsName);
  }

  return `import { ${[...new Set(allImports)].sort().join(", ")} } from "./serialization.js";

const API_NAME = "${baseName}";
const API_VERSION = ${version};
${traitsContent}
${associationTraits}
export {
  ${messageTraits.sort().join(",\n  ")}
};
`;
}

/**
 * Parses a protobuf namespace name to extract the base name and version number. The expected format for the namespace name is "NamespaceV1", where "Namespace" is the base name and "1" is the version number. If the namespace name does not match this format, an error is thrown.
 * @param namespace - The protobuf namespace name to parse
 * @returns An object containing the base name and version number extracted from the namespace name
 * @throws An error if the namespace name does not match the expected format
 */
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

/**
 * Creates a traits object for a protobuf message type, which includes the message ID, name, and references to the corresponding serializer and deserializer functions. If the message does not have an associated message ID, the function returns null and logs an error indicating that the message is missing a message ID.
 * @param message - The protobuf message type to create the traits object for
 * @returns An object containing the TypeScript definition for the traits object, the name of the traits object, and an array of imports required for the serializer and deserializer functions. If the message is missing a message ID, it returns null.
 */
function createMessageTraits(message: proto.Type) {
  const id = getMessageId(message);
  if (!id) {
    return null;
  }
  const traitName = getTraitName(message.name);
  const serialize = getSerializerFunctionName(message.name);
  const deserialize = getDeserializerFunctionName(message.name);
  const definition = `
const ${traitName} = {
  deserialize: ${deserialize},
  id: ${id},
  name: "${message.name}",
  serialize: ${serialize},
};\n`;
  return {
    definition,
    name: traitName,
    imports: [serialize, deserialize],
  };
}

/**
 * Generates a trait name for a protobuf message type by converting the first letter of the message name to lowercase and appending "Traits" to the end. For example, if the message name is "MyMessage", the generated trait name would be "myMessageTraits".
 * @param messageName - The name of the protobuf message type to generate the trait name for
 * @returns A string containing the generated trait name for the protobuf message type
 */
function getTraitName(messageName: string) {
  return `${lowercaseFirstLetter(messageName)}Traits`;
}

/**
 * Generates a trait name for a request-response pair of protobuf message types by removing the "Request" suffix from the request message name, converting the first letter to lowercase, and appending "ReqResTraits" to the end. For example, if the request message name is "GetUserRequest", the generated trait name for the request-response pair would be "getUserReqResTraits".
 * @param pairName - The base name of the request-response pair, which is derived from the request message name by removing the "Request" suffix
 * @returns A string containing the generated trait name for the request-response pair of protobuf message types
 */
function getReqResTraitName(pairName: string) {
  return `${lowercaseFirstLetter(pairName)}ReqResTraits`;
}

export { createNamespaceTraits };
