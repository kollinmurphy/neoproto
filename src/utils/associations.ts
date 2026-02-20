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

function isResponseMessage(message: proto.Type): boolean {
  return (
    message.name.endsWith("Response") ||
    message.name.endsWith("Res") ||
    message.name.endsWith("Rsp")
  );
}

/**
 * Extracts the MessageId from a protobuf message's comment if it follows the format "MessageId: <number>".
 * @param message - The protobuf message type from which to extract the MessageId.
 * @returns The extracted MessageId as a number if found, or null if not found or if the format is incorrect.
 */
function getMessageId(message: proto.Type): number | null {
  const match = (message.comment || "").match(/MessageId:?\s*(\d+)/i);
  return match ? parseInt(match[1] || "0", 10) : null;
}

function isMessage(message: proto.Type): boolean {
  const hasId = Boolean(getMessageId(message));
  const isReq = isRequestMessage(message);
  const isRes = isResponseMessage(message);
  return hasId || isReq || isRes;
}

export { associateMessages, getMessageId, isMessage };
