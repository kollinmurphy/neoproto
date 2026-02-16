/**
 * Creates a JSDoc-style comment block from a given string, properly formatting it for single-line or multi-line comments.
 * @param comment - The comment text to format into a JSDoc comment block. Can be a single line or multiple lines separated by newline characters.
 * @param indentation - An optional string to prepend to each line of the comment for indentation purposes. Defaults to an empty string (no indentation).
 * @returns A formatted JSDoc comment block as a string, with appropriate indentation and line breaks based on the input comment.
 */
export function createMultilineComment(
  comment: string | null | undefined,
  indentation: string = "",
): string {
  if (!comment) {
    return "";
  }
  const commentLines = comment.split("\n").map((line) => line.trim());
  if (commentLines.length === 1) {
    return `${indentation}/** ${commentLines[0]} */`;
  }
  const lines = commentLines.map((line) => `${indentation} * ${line}`);
  return `${indentation}/**\n${lines.join("\n")}\n${indentation} */`;
}
