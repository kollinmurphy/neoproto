# neoproto

`neoproto` is a code generation tool that focuses on improving the developer experience of working with protobuf messages in TypeScript. It generates usable type definitions, serialization and deserialization functions, and test cases for protobuf messages defined in `.proto` files. The goal is to produce an idiomatic TypeScript API that abstracts away the idiosyncrasies of protobuf as much as possible.

> This tool is in early development. It may contain bugs and does not support all features of protobuf. Use at your own risk.

### Features

All `neoproto` needs is a `.proto` file. It does all the work from there by parsing the file using [protobufjs](https://www.npmjs.com/package/protobufjs-cli) to generate an intermediate representation of the protobuf schema, and then converts that representation into a usable TypeScript API.

![neoproto diagram](./doc/diagram.png)

### Usage

`neoproto` is designed to be used as a command-line tool. Install it as a dev dependency in your project:

```bash
npm install --save-dev neoproto
```

Then, you can run it from the command line:

```bash
npx neoproto -p path/to/your/file.proto -o path/to/output/directory -t path/to/test/directory
```

### Features

- 👩‍💻 **Developer-friendly type definitions**: Generates idiomatic TypeScript type definitions that are easy to work with, abstracting away protobuf's quirks.
- 🔄 **Serialization and deserialization functions**: Provides functions to serialize and deserialize messages, making it easy to work with protobuf messages in your code.
- 🧪 **Test case generation**: Automatically generates test cases for your messages, ensuring that serialization and deserialization work as expected.
- 📄 **Documentation generation**: Creates markdown documentation for your messages, including comments, message IDs, and associations between request and response messages.

### Example

Say you have a protobuf file `example.proto` with the following content:

```protobuf
// neoproto currently only supports proto2 syntax
syntax = "proto2";

// This is an example protobuf file to demonstrate the capabilities of the library. It includes various features such as nested messages, enums, oneof fields, and comments for documentation purposes.
package MyApi.V1;

/**
 * Metadata shared across multiple message types.
 */
message MyNestedMessage {
  optional int32 id = 1;
  optional int64 some_other_long = 2;
}

/**
 * Request message for the MyMessage service.
 * MessageId: 1
 * client to provider
 */
message MyMessageReq {
  optional string value = 1;
  optional int64 some_long = 2;
  // This field needs some additional explanation.
  optional MyNestedMessage nested = 3;
  optional bool some_thing = 4;

  repeated string some_repeated_strings = 5;
  repeated MyNestedMessage some_repeated_nested = 6;
}

/**
 * Response message containing the result of a MyMessageReq.
 * MessageID 2
 * Directionality: provider-to-client
 */
message MyMessageRes {
  optional string value = 1;
  optional int64 some_long = 2;
  optional MyNestedMessage nested = 3;
  optional bool some_thing = 4;

  repeated string some_repeated_strings = 5;
  repeated MyNestedMessage some_repeated_nested = 6;
  optional bytes binary_data = 7;
}

/**
 * An important notification of some change.
 * MessageID: 3
 * Directionality: bidirectional
 */
message SomethingElseNotification {
  optional string name = 1;
  optional int32 id = 2;
}
```

With that single protobuf file as input, `neoproto` will generate the following:

`README.md` documentation file with the following content:

```markdown
# MyApi v1

This is an example protobuf file to demonstrate the capabilities of the library. It includes various features such as nested messages, enums, oneof fields, and comments for documentation purposes.

## Messages

- [MyMessageReq](#mymessagereq)
- [MyMessageRes](#mymessageres)
- [SomethingElseNotification](#somethingelsenotification)

### MyMessageReq

- Message ID: `1`
- Directionality: `client to provider`
- **Response:** [MyMessageRes](#mymessageres)

Request message for the MyMessage service.

### MyMessageRes

- Message ID: `2`
- Directionality: `provider-to-client`
- **Request:** [MyMessageReq](#mymessagereq)

Response message containing the result of a MyMessageReq.

### SomethingElseNotification

- Message ID: `3`
- Directionality: `bidirectional`

An important notification of some change.
```

A TypeScript `type.ts` file containing the definitions for all messages:

```typescript
/**
 * Request message for the MyMessage service.
 * MessageId: 1
 * client to provider
 */
interface MyMessageReq {
  /** This field needs some additional explanation. */
  nested?: MyNestedMessage;
  someLong?: bigint;
  someRepeatedNested: MyNestedMessage[];
  someRepeatedStrings: string[];
  someThing?: boolean;
  value?: string;
}

/**
 * Response message containing the result of a MyMessageReq.
 * MessageID 2
 * Directionality: provider-to-client
 */
interface MyMessageRes {
  binaryData?: Uint8Array;
  nested?: MyNestedMessage;
  someLong?: bigint;
  someRepeatedNested: MyNestedMessage[];
  someRepeatedStrings: string[];
  someThing?: boolean;
  value?: string;
}

/** Metadata shared across multiple message types. */
interface MyNestedMessage {
  id?: number;
  someOtherLong?: bigint;
}

/**
 * An important notification of some change.
 * MessageID: 3
 * Directionality: bidirectional
 */
interface SomethingElseNotification {
  id?: number;
  name?: string;
}

export type {
  MyMessageReq,
  MyMessageRes,
  MyNestedMessage,
  SomethingElseNotification,
};
```

A `traits.ts` file containing message metadata, associations, and an interface for the API:

```typescript;
import {
  deserializeMyMessageReq,
  deserializeMyMessageRes,
  deserializeSomethingElseNotification,
  serializeMyMessageReq,
  serializeMyMessageRes,
  serializeSomethingElseNotification,
} from "./serialization.js";

const API_NAME = "MyApi";
const API_VERSION = "1";

const myMessageReqTraits = {
  deserialize: deserializeMyMessageReq,
  id: 1,
  name: "MyMessageReq",
  serialize: serializeMyMessageReq,
};

const myMessageResTraits = {
  deserialize: deserializeMyMessageRes,
  id: 2,
  name: "MyMessageRes",
  serialize: serializeMyMessageRes,
};

const somethingElseNotificationTraits = {
  deserialize: deserializeSomethingElseNotification,
  id: 3,
  name: "SomethingElseNotification",
  serialize: serializeSomethingElseNotification,
};

const myMessageReqResTraits = {
  name: "MyMessage",
  request: myMessageReqTraits,
  response: myMessageResTraits,
};

export {
  API_NAME,
  API_VERSION,
  myMessageReqResTraits,
  myMessageReqTraits,
  myMessageResTraits,
  somethingElseNotificationTraits,
};
```

A `serialization.ts` file containing serialization and deserialization functions for all messages:

```typescript
import type {
  MyMessageReq,
  MyMessageRes,
  SomethingElseNotification,
} from "./types.js";
import { MyApi } from "./protobuf/MyApi.js";
import {
  mapMyMessageReqProtoToObject,
  mapMyMessageResProtoToObject,
  mapSomethingElseNotificationProtoToObject,
} from "./wrap.js";
import {
  mapMyMessageReqObjectToProto,
  mapMyMessageResObjectToProto,
  mapSomethingElseNotificationObjectToProto,
} from "./unwrap.js";

/**
 * Serializes a MyMessageReq message to a Uint8Array.
 * @param input MyMessageReq message to serialize
 * @returns Uint8Array containing the serialized message
 */
function serializeMyMessageReq(input: MyMessageReq): Uint8Array {
  return MyApi.V1.MyMessageReq.encode(
    mapMyMessageReqObjectToProto(input),
  ).finish();
}

/**
 * Deserializes a MyMessageReq message from a Uint8Array.
 * @param input Uint8Array containing the serialized message
 * @returns MyMessageReq message
 */
function deserializeMyMessageReq(input: Uint8Array): MyMessageReq {
  return mapMyMessageReqProtoToObject(MyApi.V1.MyMessageReq.decode(input));
}

/**
 * Serializes a MyMessageRes message to a Uint8Array.
 * @param input MyMessageRes message to serialize
 * @returns Uint8Array containing the serialized message
 */
function serializeMyMessageRes(input: MyMessageRes): Uint8Array {
  return MyApi.V1.MyMessageRes.encode(
    mapMyMessageResObjectToProto(input),
  ).finish();
}

/**
 * Deserializes a MyMessageRes message from a Uint8Array.
 * @param input Uint8Array containing the serialized message
 * @returns MyMessageRes message
 */
function deserializeMyMessageRes(input: Uint8Array): MyMessageRes {
  return mapMyMessageResProtoToObject(MyApi.V1.MyMessageRes.decode(input));
}

/**
 * Serializes a SomethingElseNotification message to a Uint8Array.
 * @param input SomethingElseNotification message to serialize
 * @returns Uint8Array containing the serialized message
 */
function serializeSomethingElseNotification(
  input: SomethingElseNotification,
): Uint8Array {
  return MyApi.V1.SomethingElseNotification.encode(
    mapSomethingElseNotificationObjectToProto(input),
  ).finish();
}

/**
 * Deserializes a SomethingElseNotification message from a Uint8Array.
 * @param input Uint8Array containing the serialized message
 * @returns SomethingElseNotification message
 */
function deserializeSomethingElseNotification(
  input: Uint8Array,
): SomethingElseNotification {
  return mapSomethingElseNotificationProtoToObject(
    MyApi.V1.SomethingElseNotification.decode(input),
  );
}

export {
  deserializeMyMessageReq,
  deserializeMyMessageRes,
  deserializeSomethingElseNotification,
  serializeMyMessageReq,
  serializeMyMessageRes,
  serializeSomethingElseNotification,
};
```

An `unwrap.ts` file containing functions to the nice TypeScript objects to the protobuf message objects:

```typescript
import type {
  MyMessageReq,
  MyMessageRes,
  MyNestedMessage,
  SomethingElseNotification,
} from "./types.js";
import long from "long";
import { MyApi } from "./protobuf/MyApi.js";

function isNonNullish<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

/**
 * Maps a plain object to a MyApi.V1.IMyMessageReq protobuf interface.
 * @param input Plain object containing the message
 * @returns MyApi.V1.IMyMessageReq protobuf interface
 */
function mapMyMessageReqObjectToProto(
  input: MyMessageReq,
): MyApi.V1.IMyMessageReq {
  const proto: MyApi.V1.IMyMessageReq = {
    ...(isNonNullish(input.nested)
      ? { nested: mapMyNestedMessageObjectToProto(input.nested) }
      : {}),
    ...(isNonNullish(input.someLong)
      ? { someLong: long.fromString(input.someLong.toString()) }
      : {}),
    someRepeatedNested: (input.someRepeatedNested ?? []).map((item) =>
      mapMyNestedMessageObjectToProto(item),
    ),
    someRepeatedStrings: input.someRepeatedStrings ?? [],
    ...(isNonNullish(input.someThing) ? { someThing: input.someThing } : {}),
    ...(isNonNullish(input.value) ? { value: input.value } : {}),
  };
  console.log("Unwrapped MyApi.V1.MyMessageReq:", proto);

  return proto;
}

/**
 * Maps a plain object to a MyApi.V1.IMyMessageRes protobuf interface.
 * @param input Plain object containing the message
 * @returns MyApi.V1.IMyMessageRes protobuf interface
 */
function mapMyMessageResObjectToProto(
  input: MyMessageRes,
): MyApi.V1.IMyMessageRes {
  const proto: MyApi.V1.IMyMessageRes = {
    ...(isNonNullish(input.binaryData) ? { binaryData: input.binaryData } : {}),
    ...(isNonNullish(input.nested)
      ? { nested: mapMyNestedMessageObjectToProto(input.nested) }
      : {}),
    ...(isNonNullish(input.someLong)
      ? { someLong: long.fromString(input.someLong.toString()) }
      : {}),
    someRepeatedNested: (input.someRepeatedNested ?? []).map((item) =>
      mapMyNestedMessageObjectToProto(item),
    ),
    someRepeatedStrings: input.someRepeatedStrings ?? [],
    ...(isNonNullish(input.someThing) ? { someThing: input.someThing } : {}),
    ...(isNonNullish(input.value) ? { value: input.value } : {}),
  };
  console.log("Unwrapped MyApi.V1.MyMessageRes:", proto);

  return proto;
}

/**
 * Maps a plain object to a MyApi.V1.IMyNestedMessage protobuf interface.
 * @param input Plain object containing the message
 * @returns MyApi.V1.IMyNestedMessage protobuf interface
 */
function mapMyNestedMessageObjectToProto(
  input: MyNestedMessage,
): MyApi.V1.IMyNestedMessage {
  const proto: MyApi.V1.IMyNestedMessage = {
    ...(isNonNullish(input.id) ? { id: input.id } : {}),
    ...(isNonNullish(input.someOtherLong)
      ? { someOtherLong: long.fromString(input.someOtherLong.toString()) }
      : {}),
  };
  console.log("Unwrapped MyApi.V1.MyNestedMessage:", proto);

  return proto;
}

/**
 * Maps a plain object to a MyApi.V1.ISomethingElseNotification protobuf interface.
 * @param input Plain object containing the message
 * @returns MyApi.V1.ISomethingElseNotification protobuf interface
 */
function mapSomethingElseNotificationObjectToProto(
  input: SomethingElseNotification,
): MyApi.V1.ISomethingElseNotification {
  const proto: MyApi.V1.ISomethingElseNotification = {
    ...(isNonNullish(input.id) ? { id: input.id } : {}),
    ...(isNonNullish(input.name) ? { name: input.name } : {}),
  };
  console.log("Unwrapped MyApi.V1.SomethingElseNotification:", proto);

  return proto;
}

export {
  mapMyMessageReqObjectToProto,
  mapMyMessageResObjectToProto,
  mapMyNestedMessageObjectToProto,
  mapSomethingElseNotificationObjectToProto,
};
```

A `wrap.ts` file containing functions to map the protobuf message objects to the nice TypeScript objects:

```typescript
import type {
  MyMessageReq,
  MyMessageRes,
  MyNestedMessage,
  SomethingElseNotification,
} from "./types.js";
import { MyApi } from "./protobuf/MyApi.js";

function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

/**
 * Maps a MyMessageReq protobuf message to a plain object.
 * @param input MyMessageReq protobuf message to map
 * @returns Plain object containing the mapped message
 */
function mapMyMessageReqProtoToObject(
  input: MyApi.V1.IMyMessageReq,
): MyMessageReq {
  const object: MyMessageReq = {
    ...(isNonNullable(input.nested)
      ? { nested: mapMyNestedMessageProtoToObject(input.nested) }
      : {}),
    ...(isNonNullable(input.someLong)
      ? {
          someLong:
            typeof input.someLong === "number"
              ? BigInt(input.someLong)
              : input.someLong.toBigInt(),
        }
      : {}),
    someRepeatedNested: (input.someRepeatedNested ?? []).map((item) =>
      mapMyNestedMessageProtoToObject(item),
    ),
    someRepeatedStrings: input.someRepeatedStrings ?? [],
    ...(isNonNullable(input.someThing) ? { someThing: input.someThing } : {}),
    ...(isNonNullable(input.value) ? { value: input.value } : {}),
  };
  return object;
}

/**
 * Maps a MyMessageRes protobuf message to a plain object.
 * @param input MyMessageRes protobuf message to map
 * @returns Plain object containing the mapped message
 */
function mapMyMessageResProtoToObject(
  input: MyApi.V1.IMyMessageRes,
): MyMessageRes {
  const object: MyMessageRes = {
    ...(isNonNullable(input.binaryData)
      ? { binaryData: input.binaryData }
      : {}),
    ...(isNonNullable(input.nested)
      ? { nested: mapMyNestedMessageProtoToObject(input.nested) }
      : {}),
    ...(isNonNullable(input.someLong)
      ? {
          someLong:
            typeof input.someLong === "number"
              ? BigInt(input.someLong)
              : input.someLong.toBigInt(),
        }
      : {}),
    someRepeatedNested: (input.someRepeatedNested ?? []).map((item) =>
      mapMyNestedMessageProtoToObject(item),
    ),
    someRepeatedStrings: input.someRepeatedStrings ?? [],
    ...(isNonNullable(input.someThing) ? { someThing: input.someThing } : {}),
    ...(isNonNullable(input.value) ? { value: input.value } : {}),
  };
  return object;
}

/**
 * Maps a MyNestedMessage protobuf message to a plain object.
 * @param input MyNestedMessage protobuf message to map
 * @returns Plain object containing the mapped message
 */
function mapMyNestedMessageProtoToObject(
  input: MyApi.V1.IMyNestedMessage,
): MyNestedMessage {
  const object: MyNestedMessage = {
    ...(isNonNullable(input.id) ? { id: input.id } : {}),
    ...(isNonNullable(input.someOtherLong)
      ? {
          someOtherLong:
            typeof input.someOtherLong === "number"
              ? BigInt(input.someOtherLong)
              : input.someOtherLong.toBigInt(),
        }
      : {}),
  };
  return object;
}

/**
 * Maps a SomethingElseNotification protobuf message to a plain object.
 * @param input SomethingElseNotification protobuf message to map
 * @returns Plain object containing the mapped message
 */
function mapSomethingElseNotificationProtoToObject(
  input: MyApi.V1.ISomethingElseNotification,
): SomethingElseNotification {
  const object: SomethingElseNotification = {
    ...(isNonNullable(input.id) ? { id: input.id } : {}),
    ...(isNonNullable(input.name) ? { name: input.name } : {}),
  };
  return object;
}

export {
  mapMyMessageReqProtoToObject,
  mapMyMessageResProtoToObject,
  mapMyNestedMessageProtoToObject,
  mapSomethingElseNotificationProtoToObject,
};
```

A simple `index.ts` file that exports everything:

```typescript
export * from "./serialization.js";
export * from "./traits.js";
export * from "./types.js";
export * from "./unwrap.js";
export * from "./wrap.js";
```

And as a cherry on top, a `serialization.spec.ts` file containing test cases for all messages:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  serializeMyMessageReq,
  deserializeMyMessageReq,
  type MyMessageReq,
  serializeMyMessageRes,
  deserializeMyMessageRes,
  type MyMessageRes,
  serializeSomethingElseNotification,
  deserializeSomethingElseNotification,
  type SomethingElseNotification,
} from "../index.js";

describe("MyApi", () => {
  describe("MyMessageReq", () => {
    it("should serialize and deserialize correctly", () => {
      const original: MyMessageReq = {
        nested: {
          id: 123,
          someOtherLong: BigInt("9223372036854775807"),
        },
        someLong: BigInt("9223372036854775807"),
        someRepeatedNested: [
          {
            id: 123,
            someOtherLong: BigInt("9223372036854775807"),
          },
          {
            id: 123,
            someOtherLong: BigInt("9223372036854775807"),
          },
        ],
        someRepeatedStrings: ["example", "example"],
        someThing: true,
        value: "example",
      };
      const serialized = serializeMyMessageReq(original);
      const deserialized = deserializeMyMessageReq(serialized);
      assert.deepStrictEqual(deserialized, original);
    });
    it("should handle optional fields correctly", () => {
      const original: MyMessageReq = {
        someRepeatedNested: [],
        someRepeatedStrings: [],
      };
      const defaulted: MyMessageReq = {
        someLong: 0n,
        someRepeatedNested: [],
        someRepeatedStrings: [],
        someThing: false,
        value: "",
      };
      const serialized = serializeMyMessageReq(original);
      const deserialized = deserializeMyMessageReq(serialized);
      assert.deepStrictEqual(deserialized, defaulted);
    });
  });

  describe("MyMessageRes", () => {
    it("should serialize and deserialize correctly", () => {
      const original: MyMessageRes = {
        binaryData: Buffer.from([1, 2, 3]),
        nested: {
          id: 123,
          someOtherLong: BigInt("9223372036854775807"),
        },
        someLong: BigInt("9223372036854775807"),
        someRepeatedNested: [
          {
            id: 123,
            someOtherLong: BigInt("9223372036854775807"),
          },
          {
            id: 123,
            someOtherLong: BigInt("9223372036854775807"),
          },
        ],
        someRepeatedStrings: ["example", "example"],
        someThing: true,
        value: "example",
      };
      const serialized = serializeMyMessageRes(original);
      const deserialized = deserializeMyMessageRes(serialized);
      assert.deepStrictEqual(deserialized, original);
    });
    it("should handle optional fields correctly", () => {
      const original: MyMessageRes = {
        someRepeatedNested: [],
        someRepeatedStrings: [],
      };
      const defaulted: MyMessageRes = {
        binaryData: Buffer.from([]),
        someLong: 0n,
        someRepeatedNested: [],
        someRepeatedStrings: [],
        someThing: false,
        value: "",
      };
      const serialized = serializeMyMessageRes(original);
      const deserialized = deserializeMyMessageRes(serialized);
      assert.deepStrictEqual(deserialized, defaulted);
    });
  });

  describe("SomethingElseNotification", () => {
    it("should serialize and deserialize correctly", () => {
      const original: SomethingElseNotification = {
        id: 123,
        name: "example",
      };
      const serialized = serializeSomethingElseNotification(original);
      const deserialized = deserializeSomethingElseNotification(serialized);
      assert.deepStrictEqual(deserialized, original);
    });
    it("should handle optional fields correctly", () => {
      const original: SomethingElseNotification = {};
      const defaulted: SomethingElseNotification = {
        id: 0,
        name: "",
      };
      const serialized = serializeSomethingElseNotification(original);
      const deserialized = deserializeSomethingElseNotification(serialized);
      assert.deepStrictEqual(deserialized, defaulted);
    });
  });
});
```

### Limitations

This is a strongly opinionated library that makes certain assumptions about how protobuf messages are defined and used. It is not a general-purpose library. You may find it helpful, or you may find that it does not fit your use case. In either case, please feel free to fork the library and modify it to suit your needs.

This project supports only a subset of the `proto2` syntax (messages and enums). `proto3` is not intended to be supported, although it may have some level of compatibility.

As defined in the [protobuf spec version 2](https://protobuf.dev/programming-guides/proto2/#default), the default values of fields are as follows:

| Type          | Default Value |
| ------------- | ------------- |
| string        | empty string  |
| bytes         | empty bytes   |
| bool          | false         |
| numeric types | zero          |
| enum          | first value   |

Given the above, there is no way to differentiate between a field that is set to its default value and a field that is not set at all. This can lead to ambiguity in certain cases, especially when dealing with optional fields. This library has taken the approach of treating all optional fields as if they were set to the default value. Ensure that your protobuf messages are designed with this in mind to avoid unintended consequences, and that usage of the library aligns with this behavior.
