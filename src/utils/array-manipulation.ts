/**
 * Finds duplicate values in an array.
 * @param array - The array to search for duplicates.
 * @returns An array of duplicate values found in the input array.
 */
export function findDuplicates<T>(array: T[]): T[] {
  const seen = new Set<T>();
  const duplicates = new Set<T>();

  for (const item of array) {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  }

  return Array.from(duplicates);
}
