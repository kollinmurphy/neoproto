import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { runProtobufjsCli } from "./pbcli.js";
import { createNamespaceSerializers } from "./generators/serialization.js";
import { createNamespaceTypes } from "./generators/types.js";
import { createNamespaceTraits } from "./generators/traits.js";
import { createNamespaceWrappers } from "./generators/wrap.js";
import { createNamespaceUnwrappers } from "./generators/unwrap.js";
import { associateMessages } from "./utils/associations.js";
import { getMessages } from "./utils/protobuf.js";
import { logError } from "./utils/logger.js";

const __dirname = new URL(".", import.meta.url).pathname;

const protoPath = `${__dirname}../data/example.proto`;
const outDir = `${__dirname}../data/dist`;

async function main() {
  if (existsSync(outDir)) {
    const canOverwrite =
      process.argv.includes("--force") || process.argv.includes("-f");
    if (!canOverwrite) {
      console.error(
        `Output directory ${outDir} already exists. Use --force or -f to overwrite.`,
      );
      process.exit(1);
    }
    await rm(outDir, { force: true, recursive: true });
  }
  await mkdir(`${outDir}/protobuf`, { recursive: true });

  const { namespace } = await runProtobufjsCli(protoPath, `${outDir}/protobuf`);
  const associations = associateMessages(getMessages(namespace));

  await writeFile(
    `${outDir}/serialization.ts`,
    createNamespaceSerializers(namespace),
  );
  console.log(`Wrote serialization functions to ${outDir}/serialization.ts`);

  await writeFile(`${outDir}/wrap.ts`, createNamespaceWrappers(namespace));
  console.log(`Wrote wrapper functions to ${outDir}/wrap.ts`);

  await writeFile(`${outDir}/unwrap.ts`, createNamespaceUnwrappers(namespace));
  console.log(`Wrote unwrapper functions to ${outDir}/unwrap.ts`);

  await writeFile(`${outDir}/types.ts`, createNamespaceTypes(namespace));
  console.log(`Wrote TypeScript interfaces to ${outDir}/types.ts`);

  await writeFile(
    `${outDir}/traits.ts`,
    createNamespaceTraits(namespace, associations),
  );
  console.log(`Wrote traits to ${outDir}/traits.ts`);

  await writeFile(
    `${outDir}/index.ts`,
    `export * from "./serialization.js";
export * from "./traits.js";
export * from "./types.js";
export * from "./unwrap.js";
export * from "./wrap.js";
`,
  );
  console.log(`Wrote index file to ${outDir}/index.ts`);
}

main()
  .then(() => {
    if (!process.exitCode) {
      console.log("\nAll tasks completed successfully!\n");
    } else {
      logError(
        "One or more tasks completed with errors. Please check the logs above for details.",
        "",
      );
    }
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
