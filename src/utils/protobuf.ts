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

export function getEnums(namespace: proto.Namespace): proto.Enum[] {
  return Object.values(namespace.nested ?? {})
    .filter((nested) => nested instanceof proto.Enum)
    .map((enumType) => enumType as proto.Enum);
}

export function getChildNamespaces(
  namespace: proto.Namespace,
): proto.NamespaceBase[] {
  return Object.values(namespace.nested ?? {}).filter(
    (nested) =>
      nested instanceof proto.Namespace ||
      nested instanceof proto.Root ||
      nested instanceof proto.Type,
  ) as proto.NamespaceBase[];
}
