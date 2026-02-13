const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function logError(message: string, prefix = "ERROR: ") {
  console.error(`${RED}${prefix}${message}${RESET}`);
  process.exitCode = 1;
}

export { logError };
