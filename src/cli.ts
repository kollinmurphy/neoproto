#!/usr/bin/env node

import { logError } from "./utils/logger.js";
import { run } from "./index.js";

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
 * Checks if a specific flag is present in the command-line arguments.
 * @param flag - The flag to check for (e.g., "--force").
 * @returns True if the flag is present, false otherwise.
 */
function getFlag(flag: string, shortFlag?: string): boolean {
  const args = process.argv.slice(2);
  return args.includes(flag) || Boolean(shortFlag && args.includes(shortFlag));
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
  shortParam: string,
  { required }: { required: boolean },
): string {
  const args = process.argv.slice(2);
  const idx = args.findIndex((arg) => arg === param || arg === shortParam);
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
 * The main entry point of the CLI tool. Parses command-line arguments, validates them, and invokes the main function to generate code based on the provided .proto file.
 * If the required parameters are missing or if the output/test directories already exist without the --force flag, the function will log appropriate error messages and exit the process.
 * If the --help or -h flag is provided, the function will print usage instructions and exit.
 */
async function main() {
  if (process.argv.length <= 2 || getFlag("--help") || getFlag("-h")) {
    printUsage();
    process.exit(0);
  }
  try {
    const { error } = await run({
      outDir: getParameter("--out-dir", "-o", { required: true }),
      protoPath: getParameter("--proto", "-p", { required: true }),
      testDir: getParameter("--test-dir", "-t", { required: false }),
      flagForce: getFlag("--force", "-f"),
      flagNoPrettier: getFlag("--no-prettier"),
      flagNoTestExecution: getFlag("--no-test-execution"),
    });
    if (error) {
      logError(
        "One or more tasks completed with errors. Please check the logs above for details.",
      );
      process.exit(1);
    } else {
      console.log("\nAll tasks completed successfully!\n");
    }
  } catch (err) {
    logError(
      `An unexpected error occurred: ${err instanceof Error ? err.stack : String(err)}`,
    );
    process.exit(1);
  }
}

main();
