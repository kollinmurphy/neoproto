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
import { fileURLToPath } from "node:url";
import process from "node:process";

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

/**
 * Prints usage instructions for the CLI tool.
 */
function printUsage() {
  console.log(`
Example usage: ${process.argv[1]} --proto /path/to/file.proto --out-dir ./dist --test-dir ./dist/test

Parameters:
  ${"--proto, -p".padEnd(20)}(required) Path to the .proto file to process.
  ${"--out-dir, -o".padEnd(20)}(required) Directory where the generated files will be saved.
  ${"--test-dir, -t".padEnd(20)}(optional) Directory where the test files will be saved.

Flags:
  ${"--force, -f".padEnd(20)}Overwrite the output directory if it already exists. (Use with caution! This will delete all existing files in the output directory.)
  ${"--no-prettier".padEnd(20)}Skip formatting the generated files with Prettier.
  ${"--no-test-execution".padEnd(20)}Skip executing the generated tests after creation. This is only relevant if a test directory is specified.
`);
}

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
 * Checks if a specific flag is present in the command-line arguments.
 * @param flag - The flag to check for (e.g., "--force").
 * @returns True if the flag is present, false otherwise.
 */
function getFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

/**
 * Retrieves the value of a specific parameter from the command-line arguments.
 * @param param - The parameter to retrieve (e.g., "--out-dir").
 * @param options - An object specifying whether the parameter is required.
 * @returns The value of the parameter if found, or an empty string if not found and not required.
 * @throws If the parameter is required but not found, the function will log an error, print usage instructions, and exit the process.
 */
function getParameter(
  param: string,
  { required }: { required: boolean },
): string {
  const args = process.argv.slice(2);
  const idx = args.findIndex((arg) => arg === param);
  if (idx !== -1 && idx < args.length - 1) {
    return args[idx + 1]!;
  }
  if (required) {
    logError(`Missing required parameter: ${param}`, "");
    printUsage();
    process.exit(1);
  }
  return "";
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

  if (!process.argv.includes("--no-test-execution") && testDir) {
    console.log("\nRunning generated tests...\n");
    try {
      await executeCommand(
        process.argv[0] || "node",
        ["--import tsx --test", `${testDir}/serialization.spec.ts`],
        process.cwd(),
      );
    } catch (err) {
      logError("Generated unit tests failed.", "");
    }
  }
}

/**
 * The main entry point of the CLI tool. Parses command-line arguments, validates them, and invokes the main function to generate code based on the provided .proto file.
 * If the required parameters are missing or if the output/test directories already exist without the --force flag, the function will log appropriate error messages and exit the process.
 * If the --help or -h flag is provided, the function will print usage instructions and exit.
 */
async function main() {
  if (process.argv.length <= 2 || getFlag("--help") || getFlag("-h")) {
    printUsage();
    process.exit(0);
  }
  const outDir = getParameter("--out-dir", { required: true });
  const protoPath = getParameter("--proto", { required: true });
  const testDir = getParameter("--test-dir", { required: false });
  const flagForce = getFlag("--force");
  const flagNoPrettier = getFlag("--no-prettier");
  await run({ outDir, protoPath, testDir, flagForce, flagNoPrettier });
}

if (isMain)
  main()
    .then(() => {
      if (!process.exitCode) {
        console.log("\nAll tasks completed successfully!\n");
        process.exit(0);
      } else {
        logError(
          "One or more tasks completed with errors. Please check the logs above for details.",
          "",
        );
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });

export { run };
