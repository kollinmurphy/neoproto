import { describe, it } from "node:test";
import { removeMessageId } from "../../src/utils/associations";
import assert from "node:assert";

describe("associations.ts", () => {

  describe("removeMessageId()", () => {
    it("should extract MessageId from comment and return cleaned comment", () => {
      const comment = "This is a message. Message Id: 42. It has an ID.";
      const result = removeMessageId(comment);
      assert.strictEqual(result.messageId, 42);
      assert.strictEqual(result.comment, "");
    });
    it("should return null for MessageId if not present and original comment", () => {
      const comment = "This message has no ID.";
      const result = removeMessageId(comment);
      assert.strictEqual(result.messageId, null);
      assert.strictEqual(result.comment, comment);
    });
    it("should be a no-op for invalid message IDs", () => {
      const comment = "This is a message.\nMessage Id: notanumber.\nIt has an invalid ID.";
      const result = removeMessageId(comment);
      assert.strictEqual(result.messageId, null);
      assert.strictEqual(result.comment, comment);
    });
    it("should preserve other lines and formatting in the comment", () => {
      const comment = "Line 1.\nMessageID 99\nLine 3.";
      const result = removeMessageId(comment);
      assert.strictEqual(result.messageId, 99);
      assert.strictEqual(result.comment, "Line 1.\n\nLine 3.");
    });
  })
});
