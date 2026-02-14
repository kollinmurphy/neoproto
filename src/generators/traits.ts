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

function getTraitName(messageName: string) {
  return `${lowercaseFirstLetter(messageName)}Traits`;
}

function getReqResTraitName(pairName: string) {
  return `${lowercaseFirstLetter(pairName)}ReqResTraits`;
}

export { createNamespaceTraits };
