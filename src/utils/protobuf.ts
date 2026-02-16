import proto from "protobufjs";

/**
 * Checks whether a protobuf field is marked as required. The field.optional property is not reliable for determining this.
 * @param field - The protobuf field to check for required status.
 * @returns True if the field is required, false otherwise.
 */
export function isRequiredField(field: proto.Field) {
  return (field as unknown as { rule: string })["rule"] === "required";
}

export interface OneOfField {
  _isOneOf: true;
  name: string;
  fields: proto.Field[];
  oneOf: proto.OneOf;
}

export type MaybeOneOfField = proto.Field | OneOfField;

/**
 * Retrieves and sorts the fields of a protobuf message.
 * @param message - The protobuf message type to retrieve fields from.
 * @returns An array of protobuf fields sorted alphabetically by field name, with fields that are part of a "oneof" group grouped together and sorted by their field names as well.
 */
export function getFields(message: proto.Type): MaybeOneOfField[] {
  const { oneOf, noOneOf } = Object.values(message.fields).reduce(
    (acc, field) => {
      if (field.partOf) {
        if (!acc.oneOf[field.partOf.name]) acc.oneOf[field.partOf.name] = [];
        acc.oneOf[field.partOf.name]!.push(field);
      } else {
        acc.noOneOf.push(field);
      }
      return acc;
    },
    {
      noOneOf: [] as proto.Field[],
      oneOf: {} as Record<string, proto.Field[]>,
    },
  );
  return [
    ...noOneOf,
    ...Object.entries(oneOf).map(([name, fields]) => {
      return {
        _isOneOf: true,
        name,
        fields: fields.sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        ),
        oneOf: fields[0]?.partOf!,
      } satisfies OneOfField;
    }),
  ].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/**
 * Retrieves all protobuf message types defined within a given namespace, including those nested within other namespaces, and returns them as a flat array.
 * @param namespace - The protobuf namespace to search for message types. This can be a root namespace or any nested namespace within the protobuf definition.
 * @returns An array of protobuf message types found within the specified namespace and its nested namespaces. The array includes all messages regardless of their nesting level, providing a comprehensive list of message types available in the given namespace.
 */
export function getMessages(namespace: proto.Namespace): proto.Type[] {
  return Object.values(namespace.nested ?? {})
    .filter((nested) => nested instanceof proto.Type)
    .map((type) => type as proto.Type);
}

/**
 * Retrieves all protobuf enum types defined within a given namespace, including those nested within other namespaces, and returns them as a flat array.
 * @param namespace - The protobuf namespace to search for enum types. This can be a root namespace or any nested namespace within the protobuf definition.
 * @returns An array of protobuf enum types found within the specified namespace and its nested namespaces. The array includes all enums regardless of their nesting level, providing a comprehensive list of enum types available in the given namespace.
 */
export function getEnums(namespace: proto.Namespace): proto.Enum[] {
  return Object.values(namespace.nested ?? {})
    .filter((nested) => nested instanceof proto.Enum)
    .map((enumType) => enumType as proto.Enum);
}

/**
 * Retrieves all direct child namespaces (including nested namespaces, root namespaces, and message types) defined within a given protobuf namespace and returns them as a flat array.
 * @param namespace - The protobuf namespace to search for child namespaces. This can be a root namespace or any nested namespace within the protobuf definition.
 * @returns An array of direct child namespaces, root namespaces, and message types within the specified protobuf namespace.
 */
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

/**
 * Checks whether a protobuf message has any optional fields, either directly within the message or nested within any of its fields that are themselves protobuf messages. This function recursively checks all nested message types to determine if any optional fields are present at any level of the message hierarchy.
 * @param message - The protobuf message type to check for optional fields. This can be any protobuf message type, including those that contain nested message types as fields.
 * @returns True if the message has at least one optional field (either directly or nested), false otherwise. The function returns true if any field in the message or any of its nested message types is not marked as required, indicating that the message can be considered to have optional fields. If all fields in the message and its nested message types are required, the function returns false, indicating that there are no optional fields present.
 */
export function hasOptionalField(message: proto.Type): boolean {
  return getFields(message).some(
    (field) =>
      "_isOneOf" in field ||
      !isRequiredField(field) ||
      (field.resolvedType instanceof proto.Type &&
        hasOptionalField(field.resolvedType)),
  );
}
