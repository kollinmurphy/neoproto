import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import proto from "protobufjs";
import { runProtobufjsCli } from "./pbcli.js";
import { createNamespaceSerializers } from "./generators/serialization-functions.js";
import { createNamespaceTypes } from "./generators/types.js";
import { createNamespaceTraits } from "./generators/traits.js";

const __dirname = new URL(".", import.meta.url).pathname;

const protoPath = `${__dirname}../data/example.proto`;
const outDir = `${__dirname}../data/dist`;

async function main() {
  if (existsSync(outDir)) {
    await rm(outDir, { force: true, recursive: true });
  }
  await mkdir(outDir, { recursive: true });
  const { root } = await runProtobufjsCli(protoPath, outDir);

  const namespaceStr = Object.keys(root.nested ?? {})[0];
  if (!namespaceStr) throw new Error(`No namespace found in ${protoPath}`);
  const namespace = root.nested?.[namespaceStr] as proto.Namespace;
  const messageNames = Object.keys(namespace.nested ?? {});
  console.log(`Messages in ${protoPath}: ${messageNames.join(", ")}`);

  await writeFile(
    `${outDir}/serialization.ts`,
    createNamespaceSerializers(namespace, messageNames),
  );
  console.log(`Wrote serialization functions to ${outDir}/serialization.ts`);

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
