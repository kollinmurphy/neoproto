function createMultilineComment(
  comment: string,
  indentation: string = "",
): string {
  const commentLines = comment.split("\n").map((line) => line.trim());
  if (commentLines.length === 1) {
    return `${indentation}/** ${commentLines[0]} */`;
  }
  const lines = commentLines.map((line) => `${indentation} * ${line}`);
  return `${indentation}/**\n${lines.join("\n")}\n${indentation} */`;
}

export { createMultilineComment };
