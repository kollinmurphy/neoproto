import proto from "protobufjs";
import { removeRequestSuffix } from "./string-manipulation.js";

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

function isRequestMessage(message: proto.Type): boolean {
  return message.name.endsWith("Request") || message.name.endsWith("Req");
}

function getExpectedResponseNames(requestName: string): string[] {
  const baseName = removeRequestSuffix(requestName);
  return [`${baseName}Response`, `${baseName}Res`, `${baseName}Rsp`];
}

function getMessageId(message: proto.Type): number | null {
  const match = (message.comment || "").match(/MessageId:?\s+(\d+)/i);
  return match ? parseInt(match[1] || "-1", 10) : null;
}

export { associateMessages, getMessageId };
