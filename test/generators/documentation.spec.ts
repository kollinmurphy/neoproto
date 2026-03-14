import assert from "node:assert";
import { describe, it } from "node:test";
import {
  createNamespaceDocumentation
} from "../../src/generators/documentation";
import proto from "protobufjs";

describe("documentation.ts", () => {
  describe("createNamespaceDocumentation", () => {
    it("should generate documentation for a protobuf namespace with messages that have comments", () => {
      const message1 = new proto.Type("SomeRequest").add(new proto.Field("field1", 1, "string"));
      message1.comment = "This is the first message.";
      const message2 = new proto.Type("SomeResponse").add(new proto.Field("field2", 1, "int32"));
      message2.comment = "This is the second message.";

      const expectedDocumentation = `# TestNamespace v99.1.0

*No documentation.*

## Messages

- [SomeRequest](#somerequest)
- [SomeResponse](#someresponse)

### SomeRequest

- **Response:** [SomeResponse](#someresponse)

This is the first message.

### SomeResponse

- **Request:** [SomeRequest](#somerequest)

This is the second message.
`;

      assert.strictEqual(createNamespaceDocumentation({
        apiName: "TestNamespace",
        apiVersion: "99.1.0",
        associations: [[message1, message2]],
        topLevelMessages: [message1, message2],
        protoSource: "",
      }), expectedDocumentation);
    });
  });
  it("should handle messages without comments and no associations", () => {
    const message1 = new proto.Type("LonelyMessage").add(new proto.Field("field1", 1, "string"));

    const expectedDocumentation = `# LonelyNamespace v0.0.1

*No documentation.*

## Messages

- [LonelyMessage](#lonelymessage)

### LonelyMessage

*No documentation.*
`;

    assert.strictEqual(createNamespaceDocumentation({
      apiName: "LonelyNamespace",
      apiVersion: "0.0.1",
      associations: [],
      topLevelMessages: [message1],
      protoSource: "",
    }), expectedDocumentation);
  });
  it("should include message ID and directionality in the documentation when present", () => {
    const message1 = new proto.Type("DirectionalMessage").add(new proto.Field("field1", 1, "string"));
    message1.comment = "Message ID: 12345\nDirectionality: client-to-provider";

    const expectedDocumentation = `# DirectionalNamespace v1.0.0

*No documentation.*

## Messages

- [DirectionalMessage](#directionalmessage)

### DirectionalMessage

- Message ID: \`12345\`
- Directionality: \`client-to-provider\`

*No documentation.*
`;

    assert.strictEqual(createNamespaceDocumentation({
      apiName: "DirectionalNamespace",
      apiVersion: "1.0.0",
      associations: [],
      topLevelMessages: [message1],
      protoSource: "",
    }), expectedDocumentation);
  });
});
