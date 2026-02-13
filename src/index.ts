import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { runProtobufjsCli } from "./pbcli.js";
import { createNamespaceSerializers } from "./generators/serialization.js";
import { createNamespaceTypes } from "./generators/types.js";
import { createNamespaceTraits } from "./generators/traits.js";
import { createNamespaceWrappers } from "./generators/wrap.js";
import { createNamespaceUnwrappers } from "./generators/unwrap.js";

const __dirname = new URL(".", import.meta.url).pathname;

const protoPath = `${__dirname}../data/example.proto`;
const outDir = `${__dirname}../data/dist`;

async function main() {
  if (existsSync(outDir)) {
    await rm(outDir, { force: true, recursive: true });
  }
  await mkdir(`${outDir}/protobuf`, { recursive: true });
  const { namespace, root } = await runProtobufjsCli(
    protoPath,
    `${outDir}/protobuf`,
  );
  const messageNames = Object.keys(namespace.nested ?? {});
  console.log(`Messages in ${protoPath}: ${messageNames.join(", ")}`);

  await writeFile(
    `${outDir}/serialization.ts`,
    createNamespaceSerializers(namespace, messageNames),
  );
  console.log(`Wrote serialization functions to ${outDir}/serialization.ts`);

  await writeFile(
    `${outDir}/wrap.ts`,
    createNamespaceWrappers(namespace, messageNames),
  );
  console.log(`Wrote wrapper functions to ${outDir}/wrap.ts`);

  await writeFile(
    `${outDir}/unwrap.ts`,
    createNamespaceUnwrappers(namespace, messageNames),
  );
  console.log(`Wrote unwrapper functions to ${outDir}/unwrap.ts`);

  await writeFile(
    `${outDir}/types.ts`,
    createNamespaceTypes(namespace, messageNames),
  );
  console.log(`Wrote TypeScript interfaces to ${outDir}/types.ts`);

  await writeFile(
    `${outDir}/traits.ts`,
    createNamespaceTraits(namespace, messageNames),
  );
  console.log(`Wrote traits to ${outDir}/traits.ts`);
}

main();
