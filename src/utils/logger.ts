const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

let hasLoggedError = false;

/**
 * Logs an error message to the console in red text and sets the process exit code to 1 to indicate an error occurred.
 * @param message - The error message to log to the console.
 * @param prefix - An optional prefix to prepend to the error message for additional context. Defaults to "ERROR: ".
 */
export function logError(message: string, prefix = "ERROR: ") {
  console.error(`${RED}${prefix}${message}${RESET}`);
  hasLoggedError = true;
}

/**
 * Logs a warning message to the console in yellow text without affecting the process exit code, allowing the program to continue running while still alerting the user to potential issues.
 * @param message - The warning message to log to the console.
 * @param prefix - An optional prefix to prepend to the warning message for additional context. Defaults to "WARNING: ".
 */
export function logWarning(message: string, prefix = "WARNING: ") {
  console.warn(`${YELLOW}${prefix}${message}${RESET}`);
}

/**
 * Retrieves the current state of whether an error has been logged using the logError function.
 * @returns A boolean value indicating whether an error has been logged (true) or not (false).
 */
export function getHasLoggedError() {
  return hasLoggedError;
}

export function clearErrorState() {
  hasLoggedError = false;
}
