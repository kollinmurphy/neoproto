import proto from "protobufjs";
import { removeMessageId, isResponseMessage, isRequestMessage, removeDirectionality } from "../utils/associations.js"

const NO_DOCUMENTATION = "*No documentation.*";

/**
 * Generates markdown documentation for a given protobuf namespace, including its comment and all top-level messages.
 * @param protoSource - The raw .proto file content as a string.
 * @param namespace - The protobuf namespace for which to generate documentation.
 * @param topLevelMessages - An array of all top-level messages in the namespace.
 * @param associations - An array of tuples representing request-response associations between messages.
 * @returns A markdown string documenting the namespace and its messages.
 */
function createNamespaceDocumentation(
  {
    protoSource,
    apiName,
    apiVersion,
    associations,
    topLevelMessages,
  }: {
    protoSource: string;
    apiName: string;
    apiVersion: string;
    associations: [proto.Type, proto.Type][];
    topLevelMessages: proto.Type[];
  }): string {
  const messageDocs = topLevelMessages.map((m) => createMessageDocumentation(m, associations)).join("\n\n").trim();
  const messageToc = topLevelMessages.map((msg) => `- [${msg.name}](#${msg.name.toLowerCase()})`);
  const namespaceComment = getNamespaceComment(protoSource)?.trim() || NO_DOCUMENTATION;

  return `# ${apiName} v${apiVersion}

${namespaceComment}

## Messages

${messageToc.join("\n")}

${messageDocs}
`;
}

/**
 * Generates markdown documentation for a given protobuf message, including its comment, message ID (if present), and associations with request/response messages. The documentation includes links to associated messages for easy navigation.
 * @param message - The protobuf message for which to generate documentation.
 * @param associations - An array of tuples representing request-response associations between messages. Each tuple contains a request message and its corresponding response message.
 * @returns A markdown string documenting the message, including its comment, message ID, and associations with request/response messages.
 */
function createMessageDocumentation(message: proto.Type, associations: [proto.Type, proto.Type][]): string {
  const messageIdResult = removeMessageId(message.comment || "");
  const directionalityResult = removeDirectionality(messageIdResult.comment);

  const finalComment = directionalityResult.comment || NO_DOCUMENTATION;

  const messageIdStr = messageIdResult.messageId ? `- Message ID: \`${messageIdResult.messageId}\`` : "";
  const directionStr = directionalityResult.direction ? `- Directionality: \`${directionalityResult.direction}\`` : "";

  const responseTo = isResponseMessage(message) ? associations.filter(([_, res]) => res === message) : [];
  const requestTo = isRequestMessage(message) ? associations.filter(([req, _]) => req === message) : [];

  const bullets = [
    messageIdStr,
    directionStr,
    ...responseTo.map(([req, _]) => `- **Request:** [${req.name}](#${req.name.toLowerCase()})`),
    ...requestTo.map(([_, res]) => `- **Response:** [${res.name}](#${res.name.toLowerCase()})`),
  ].map((l) => l?.trim()).filter(Boolean).join("\n");

  return `### ${message.name}
${bullets ? `\n${bullets}\n` : ""}
${finalComment}`;
}

/**
 * Matches either a slash-star comment or a block of double-slash comments immediately preceding the package declaration, and returns the cleaned-up comment text. If no such comment is found, returns null.
 * @param protoSource - The raw .proto file content as a string.
 * @returns The cleaned-up comment text if found, or null if no comment is present.
 */
function getNamespaceComment(protoSource: string): string | null {
  const slashStarRegex = /(\/\*[\s\S]*?\*\/)\s*(?=package\s+[\w.]+)/m;
  const slashStarMatch = protoSource.match(slashStarRegex);
  if (slashStarMatch?.[0]) {
    return slashStarMatch[0].replace(/\/\*+|\/+|\*+\//g, "").split("\n").map((l) => l.trim()).join("\n");
  }

  const doubleSlashRegex = /(?:(?:^[ \t]*\/\/.*(?:\r?\n|\r)?)+)\s*(?=package\s+)/m;
  const doubleSlashMatch = protoSource.match(doubleSlashRegex);
  if (doubleSlashMatch?.[0]) {
    return doubleSlashMatch[0].split("\n").map((l) => l.replace(/^\/+/, "").trim()).join("\n");
  }

  return null;
}

export { createNamespaceDocumentation }
