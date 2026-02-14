import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { runProtobufjsCli } from "./pbcli.js";
import { createNamespaceSerializers } from "./generators/serialization.js";
import { createNamespaceTypes } from "./generators/types.js";
import { createNamespaceTraits } from "./generators/traits.js";
import { createNamespaceWrappers } from "./generators/wrap.js";
import { createNamespaceUnwrappers } from "./generators/unwrap.js";
import { associateMessages } from "./utils/associations.js";
import { getMessages } from "./utils/protobuf.js";
import { logError } from "./utils/logger.js";
import prettier from "prettier";

function printUsage() {
  console.log(`
Usage: ${process.argv[1]} --proto <path/to/file.proto> --out-dir <output/directory> [--force] [--test-dir <path/to/test/dir>]

Options:
  --proto, -p       Path to the .proto file to process.
  --out-dir, -o    Directory where the generated files will be saved.
  --force, -f      Overwrite the output directory if it already exists.
  --test-dir, -t    Directory where the test files will be saved.

Example:
  ${process.argv[1]} --proto ./example.proto --out-dir ./generated --force --test-dir ./tests
`);
}

async function runPrettier(directory: string) {
  const tsFiles = await readdir(directory);
  const tsFilePaths = tsFiles
    .filter((file) => file.endsWith(".ts"))
    .map((file) => `${directory}/${file}`);

  for (const filePath of tsFilePaths) {
    const input = await readFile(filePath, "utf-8");
    const output = await prettier.format(input, { parser: "typescript" });
    await writeFile(filePath, output);
    console.log(`Formatted ${filePath} with Prettier`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const outDirIdx = args.findIndex(
    (arg) => arg === "--out-dir" || arg === "-o",
  );
  if (outDirIdx === -1 || outDirIdx === args.length - 1) {
    logError(
      "Output directory not specified. Use --out-dir or -o followed by the desired path.",
      "",
    );
    process.exit(1);
  }

  const protoPathIdx = args.findIndex(
    (arg) => arg === "--proto" || arg === "-p",
  );
  if (protoPathIdx === -1 || protoPathIdx === args.length - 1) {
    logError(
      "Proto file path not specified. Use --proto or -p followed by the path to your .proto file.",
      "",
    );
    process.exit(1);
  }

  const testDirIdx = args.findIndex(
    (arg) => arg === "--test-dir" || arg === "-t",
  );

  const protoPath = args[protoPathIdx + 1]!;
  const outDir = args[outDirIdx + 1]!;
  const testDir = testDirIdx !== -1 ? args[testDirIdx + 1]! : null;
  const canOverwrite = args.includes("--force") || args.includes("-f");

  if (existsSync(outDir)) {
    if (!canOverwrite) {
      logError(
        `Output directory ${outDir} already exists. Use --force or -f to overwrite.`,
      );
      process.exit(1);
    }
    await rm(outDir, { force: true, recursive: true });
  }
  await mkdir(`${outDir}/protobuf`, { recursive: true });

  if (testDir && existsSync(testDir)) {
    if (!canOverwrite) {
      logError(
        `Test directory ${testDir} already exists. Use --force or -f to overwrite.`,
      );
      process.exit(1);
    }
    await rm(testDir, { force: true, recursive: true });
  }

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

  if (testDir) {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      `${testDir}/serialization.spec.ts`,
      `// Placeholder for serialization tests. Implement your tests here.`,
    );
    console.log(`Wrote test file to ${testDir}/serialization.spec.ts`);

    if (testDir !== outDir) await runPrettier(testDir);
  }

  await runPrettier(outDir);
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
