import proto from "protobufjs";
import { removeRequestSuffix } from "./string-manipulation.js";

/**
 * Associates request messages with their corresponding response messages based on naming conventions.
 * @param messages - An array of protobuf message types to analyze for associations.
 * @returns An array of tuples, where each tuple contains a request message and its associated response message.
 */
function associateMessages(messages: proto.Type[]): [proto.Type, proto.Type][] {
  const requests = messages.filter(isRequestMessage);
  const associations: [proto.Type, proto.Type][] = [];
  for (const request of requests) {
    const expectedResponseNames = getExpectedResponseNames(request.name);
    const response = messages.find((msg) =>
      expectedResponseNames.includes(msg.name),
    );
    if (response) {
      associations.push([request, response]);
    }
  }
  return associations;
}

/**
 * Determines if a protobuf message is a request message based on its name.
 * @param message - The protobuf message type to check.
 * @returns True if the message is identified as a request message, false otherwise.
 */
function isRequestMessage(message: proto.Type): boolean {
  return message.name.endsWith("Request") || message.name.endsWith("Req");
}

/**
 * Generates a list of expected response message names based on the request message name by removing common request suffixes and appending typical response suffixes.
 * @param requestName - The name of the request message to derive expected response names from.
 * @returns An array of expected response message names corresponding to the given request message name.
 */
function getExpectedResponseNames(requestName: string): string[] {
  const baseName = removeRequestSuffix(requestName);
  return [`${baseName}Response`, `${baseName}Res`, `${baseName}Rsp`];
}

/**
 * Determines if a protobuf message is a top-level message based on the presence of a MessageId in its comment or if it follows common naming conventions for request, response, or notification messages.
 * @param message - The protobuf message type to check.
 * @returns True if the message is identified as a top-level message, false otherwise.
 */
function isResponseMessage(message: proto.Type): boolean {
  return (
    message.name.endsWith("Response") ||
    message.name.endsWith("Res") ||
    message.name.endsWith("Rsp")
  );
}

/**
 * Determines if a protobuf message is a notification message based on common naming conventions for notification messages.
 * @param message - The protobuf message type to check.
 * @returns True if the message is identified as a notification message, false otherwise.
 */
function isNotificationMessage(message: proto.Type): boolean {
  return (
    message.name.endsWith("Notification") ||
    message.name.endsWith("Notify") ||
    message.name.endsWith("Ntf") ||
    message.name.endsWith("Notif")
  );
}

/**
 * Determines if a protobuf message is a top-level message by checking if it has a MessageId in its comment or if it follows common naming conventions for request, response, or notification messages. Top-level messages are those that are considered primary entities in the API and are typically documented and have serialization functions generated for them.
 * @param message - The protobuf message type to check.
 * @returns True if the message is identified as a top-level message, false otherwise.
 */
function isTopLevelMessage(message: proto.Type): boolean {
  const hasId = Boolean(getMessageId(message));
  const isReq = isRequestMessage(message);
  const isRes = isResponseMessage(message);
  const isNotif = isNotificationMessage(message);
  return hasId || isReq || isRes || isNotif;
}

/**
 * Extracts the MessageId from a protobuf message's comment if it follows the format "MessageId: <number>".
 * @param message - The protobuf message type from which to extract the MessageId.
 * @returns The extracted MessageId as a number if found, or null if not found or if the format is incorrect.
 */
function getMessageId(message: proto.Type): number | null {
  const match = (message.comment || "").match(/Message\s*Id:?\s*(\d+)/i);
  return match ? parseInt(match[1] || "0", 10) : null;
}

/**
 * Extracts the MessageId from a comment string and removes that specific line.
 * @param messageComment - The raw comment string from the protobuf message.
 * @returns An object containing the extracted MessageId (or null) and the cleaned comment.
 */
function removeMessageId(messageComment: string): {
  messageId: number | null;
  comment: string;
} {
  const regex = /^.*Message\s*Id:?\s*(\d+).*$/im;
  const match = (messageComment || "").match(regex);

  if (!match) {
    return { messageId: null, comment: messageComment };
  }

  const messageId = parseInt(match[1] || "0", 10);
  const cleanedComment = messageComment.replace(regex, "").trim();

  return {
    messageId: isNaN(messageId) ? null : messageId,
    comment: cleanedComment,
  };
}

type Directionality = "client-to-provider" | "provider-to-client" | "bidirectional";

/**
 * Extracts the directionality information from a protobuf message's comment if it contains keywords indicating the direction of communication (e.g., "client-to-provider", "provider-to-client", "bidirectional") and removes that specific line from the comment.
 * @param messageComment - The raw comment string from the protobuf message.
 * @returns An object containing the extracted directionality (or null) and the cleaned comment without the directionality information.
 */
function removeDirectionality(messageComment: string): {
  direction: Directionality | null;
  comment: string;
} {
  const regex = /^.*\b(client-?\s*to-?\s*provider|provider-?\s*to-?\s*client|bidirectional)\b.*$/im;
  const match = (messageComment || "").match(regex);

  if (!match) {
    return { direction: null, comment: messageComment };
  }

  const direction = match[1] as Directionality;
  const cleanedComment = messageComment.replace(match[0], "").trim();

  return {
    direction,
    comment: cleanedComment,
  };
}

export {
  associateMessages,
  getMessageId,
  isRequestMessage,
  isResponseMessage,
  isNotificationMessage,
  isTopLevelMessage,
  removeDirectionality,
  removeMessageId,
};
