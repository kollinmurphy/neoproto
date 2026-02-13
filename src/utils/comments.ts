function createMultilineComment(
  comment: string,
  indentation: string = "",
): string {
  const lines = comment.split("\n").map((line) => `${indentation} * ${line}`);
  return `${indentation}/**\n${lines.join("\n")}\n${indentation} */`;
}

export { createMultilineComment };
