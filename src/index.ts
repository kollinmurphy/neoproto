import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { runProtobufjsCli } from "./pbcli.js";
import { createNamespaceSerializers } from "./generators/serialization.js";
import { createRootNamespaceTypes } from "./generators/types.js";
import { createNamespaceTraits } from "./generators/traits.js";
import { createRootNamespaceWrappers } from "./generators/wrap.js";
import { createRootNamespaceUnwrappers } from "./generators/unwrap.js";
import { associateMessages } from "./utils/associations.js";
import { getMessages } from "./utils/protobuf.js";
import { logError } from "./utils/logger.js";
import prettier from "prettier";
import { generateNamespaceTests } from "./generators/test.js";
import { executeCommand, getRelativePath } from "./utils/system.js";
import process from "node:process";

/**
 * Formats all .ts files in the specified directory using Prettier.
 * @param directory - The directory containing the .ts files to format.
 * @returns A promise that resolves when all files have been formatted.
 */
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

/**
 * Options needed to run the main function of the CLI tool.
 */
interface Options {
  /** The output directory where generated files will be saved. */
  outDir: string;

  /** The path to the .proto file to process. */
  protoPath: string;

  /** The output directory where test files will be saved. */
  testDir?: string;

  /** Whether to forcibly overwrite existing output directories. */
  flagForce?: boolean;

  /** Whether to skip formatting generated files with Prettier. */
  flagNoPrettier?: boolean;

  /** Whether to skip executing generated tests after generation. */
  flagNoTestExecution?: boolean;
}

/**
 * The main function that orchestrates the generation of serialization functions, traits, types, and tests based on a .proto file.
 * @param options - An object containing the necessary options to run the function, including output directory, .proto file path, test directory, and flags for force and Prettier.
 * @returns A promise that resolves when all tasks are completed, or rejects if any errors occur during the process.
 * @throws If the output directory or test directory already exists and the --force flag is not provided, the function will log an error and exit the process.
 */
async function run({
  outDir,
  protoPath,
  testDir,
  flagForce,
  flagNoPrettier,
  flagNoTestExecution,
}: Options) {
  if (existsSync(outDir)) {
    if (!flagForce) {
      logError(
        `Output directory ${outDir} already exists. Use --force or -f to overwrite.`,
      );
      process.exit(1);
    }
    await rm(outDir, { force: true, recursive: true });
  }
  await mkdir(`${outDir}/protobuf`, { recursive: true });

  if (testDir && existsSync(testDir)) {
    if (!flagForce) {
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

  await writeFile(`${outDir}/wrap.ts`, createRootNamespaceWrappers(namespace));
  console.log(`Wrote wrapper functions to ${outDir}/wrap.ts`);

  await writeFile(
    `${outDir}/unwrap.ts`,
    createRootNamespaceUnwrappers(namespace),
  );
  console.log(`Wrote unwrapper functions to ${outDir}/unwrap.ts`);

  await writeFile(`${outDir}/types.ts`, createRootNamespaceTypes(namespace));
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
      generateNamespaceTests(namespace, getRelativePath(testDir, outDir)),
    );
    console.log(`Wrote unit test file to ${testDir}/serialization.spec.ts`);

    if (testDir !== outDir && !flagNoPrettier) await runPrettier(testDir);
  }

  if (!flagNoPrettier) await runPrettier(outDir);

  if (!flagNoTestExecution && testDir) {
    console.log("\nRunning generated tests...\n");
    try {
      await executeCommand(
        process.argv[0] || "node",
        ["--import", "tsx", "--test", `${testDir}/serialization.spec.ts`],
        process.cwd(),
      );
    } catch (err) {
      logError("Generated unit tests failed.", "");
    }
  }
}

export { run };
