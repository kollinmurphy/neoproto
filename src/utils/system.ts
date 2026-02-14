import { resolve, isAbsolute, relative } from "path";
import { spawn } from "child_process";

/**
 * Computes the relative path from dirA to dirB. Both absolute and relative paths are supported.
 * @param dirA - The base directory from which to compute the relative path
 * @param dirB - The target directory to which the relative path should point
 * @returns A string representing the relative path from dirA to dirB, prefixed with './' if it's a relative path
 * @throws Will throw an error if either dirA or dirB is not a valid path
 */
export function getRelativePath(dirA: string, dirB: string): string {
  // 1. Resolve to absolute paths to handle relative inputs correctly
  const absoluteA = resolve(dirA);
  const absoluteB = resolve(dirB);

  // 2. Compute the relative path
  const relativePath = relative(absoluteA, absoluteB);

  // 3. Optional: Ensure it starts with './' for ESM imports or clarity
  if (!relativePath.startsWith(".") && !isAbsolute(relativePath)) {
    return `./${relativePath}`;
  }

  return relativePath;
}

/**
 * Executes a system command in a child process and returns a promise that resolves when the command completes.
 * @param command - The command to execute (e.g., "npm", "git")
 * @param args - An array of arguments to pass to the command (e.g., ["install", "lodash"])
 * @param cwd - The working directory in which to execute the command
 * @returns A promise that resolves when the command completes successfully, or rejects if the command fails
 */
export async function executeCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: true });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}
