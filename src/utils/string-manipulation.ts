/**
 * Converts the first letter of a string to lowercase while keeping the rest of the string unchanged.
 * @param str - The input string to convert.
 * @returns A new string with the first letter converted to lowercase.
 */
export function lowercaseFirstLetter(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Converts the first letter of a string to uppercase while keeping the rest of the string unchanged.
 * @param str - The input string to convert.
 * @returns A new string with the first letter converted to uppercase.
 */
export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Removes common request suffixes ("Request" and "Req") from the end of a string, if present, to derive a base name for generating related response message names.
 * @param str - The input string from which to remove request suffixes.
 * @returns A new string with the "Request" or "Req" suffix removed if it was present; otherwise, returns the original string unchanged.
 */
export function removeRequestSuffix(str: string): string {
  return str.replace(/Request|Req$/, "");
}
