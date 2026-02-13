import proto from "protobufjs";

export function isRequiredField(field: proto.Field) {
  return (field as unknown as { rule: string })["rule"] === "required";
}

export function getFields(message: proto.Type): proto.Field[] {
  return Object.values(message.fields)
    .map((f) => f.resolve())
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

export function getMessages(namespace: proto.Namespace): proto.Type[] {
  return Object.values(namespace.nested ?? {})
    .filter((nested) => nested instanceof proto.Type)
    .map((type) => type as proto.Type);
}
