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
import { getMessageId, isTopLevelMessage } from "../utils/associations.js";

/**
 * Generates wrapper functions for all messages and enums in a protobuf namespace, including nested namespaces, and returns the content of the wrapper file as a string.
 * @param apiName - The name of the API, which is included in the generated traits for informational purposes
 * @param apiVersion - The version of the API, which is included in the generated traits for informational purposes
 * @param namespace - The protobuf namespace to create wrapper functions for
 * @param associations - An array of tuples representing request-response message associations, where each tuple contains a request message type and its corresponding response message type. These associations are used to generate additional traits for request-response pairs.
 * @returns A string containing the content of the wrapper file with all the generated wrapper functions for the protobuf namespace
 */
function createNamespaceTraits(
  {
    apiName,
    apiVersion,
    namespace,
    associations,
  }: {
    apiName: string;
    apiVersion: string;
    namespace: proto.Namespace,
    associations: [proto.Type, proto.Type][],
  }
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
  messageTraits.push("API_NAME", "API_VERSION");

  let associationTraits = "";
  for (const [request, response] of associations) {
    const pairName = removeRequestSuffix(request.name);
    const pairTraitsName = getReqResTraitName(pairName);
    const requestTraitName = getTraitName(request.name);
    const responseTraitName = getTraitName(response.name);
    associationTraits += `const ${pairTraitsName} = {
  name: "${pairName}" as const,
  request: ${requestTraitName},
  response: ${responseTraitName},
};\n\n`;
    messageTraits.push(pairTraitsName);
  }

  return `import { ${[...new Set(allImports)].sort().join(", ")} } from "./serialization.js";

const API_NAME = "${apiName}" as const;
const API_VERSION = "${apiVersion}" as const;

// #region message traits
${traitsContent}
// #endregion

// #region association traits
${associationTraits}
// #endregion

export {
  ${messageTraits.sort().join(",\n  ")}
};
`;
}

/**
 * Creates a traits object for a protobuf message type, which includes the message ID, name, and references to the corresponding serializer and deserializer functions. If the message does not have an associated message ID, the function returns null and logs an error indicating that the message is missing a message ID.
 * @param message - The protobuf message type to create the traits object for
 * @returns An object containing the TypeScript definition for the traits object, the name of the traits object, and an array of imports required for the serializer and deserializer functions. If the message is missing a message ID, it returns null.
 */
function createMessageTraits(message: proto.Type) {
  if (!isTopLevelMessage(message)) {
    return null;
  }
  const id = getMessageId(message);
  const traitName = getTraitName(message.name);
  const serialize = getSerializerFunctionName(message.name);
  const deserialize = getDeserializerFunctionName(message.name);
  const idLine = id ? `\n  id: ${id} as const,` : "";
  const definition = `
const ${traitName} = {
  deserialize: ${deserialize},${idLine}
  name: "${message.name}" as const,
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
