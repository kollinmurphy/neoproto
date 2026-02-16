import { readFile, writeFile } from "node:fs/promises";
import proto from "protobufjs";
import pbcli from "protobufjs-cli";

/**
 * Helper to wrap protobufjs-cli main functions in a Promise
 * @param tool - The protobufjs-cli tool to run (e.g. pbjs or pbts).
 * @param args - The command line arguments to pass to the tool
 * @return A promise that resolves when the tool finishes execution, or rejects if an error occurs.
 * @throws An error if the tool execution fails.
 * @example
 * await runCli(pbcli.pbjs, ["--target", "static-module", "--wrap", "es6", "--out", "output.js", "input.proto"]);
 */
function runCli(tool: any, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    tool.main(args, (err: Error | null, _?: string) => {
      if (err) return reject(err);
      resolve(0);
    });
  });
}

/**
 * Runs the protobufjs CLI to generate JSON, JS, and TS files from a .proto file.
 * @param protoPath - The path to the .proto file to compile.
 * @param outDir - The directory to output the generated files to.
 * @returns - The protobufjs namespace and root objects for the compiled .proto file.
 * @throws - If the namespace cannot be found in the compiled .proto file.
 */
export async function runProtobufjsCli(protoPath: string, outDir: string) {
  const { root } = proto.parse(await readFile(protoPath, "utf8"), {
    alternateCommentMode: true,
  });
  const namespaceStr = Object.keys(root.nested ?? {})[0];
  if (!namespaceStr) throw new Error(`No namespace key found in ${protoPath}`);
  const namespace = root.nested?.[namespaceStr] as proto.Namespace;
  if (!namespace)
    throw new Error(`Namespace ${namespaceStr} not found in ${protoPath}`);

  const json = root.toJSON({ keepComments: true });
  await writeFile(
    `${outDir}/${namespaceStr}.json`,
    JSON.stringify(json, null, 2),
  );
  console.log(`Wrote JSON to ${outDir}/${namespaceStr}.json`);

  await runCli(pbcli.pbjs, [
    "--target",
    "static-module",
    "--wrap",
    "es6",
    "--alt-comment",
    "--out",
    `${outDir}/${namespaceStr}.js`,
    protoPath,
  ]);
  console.log(`Wrote JS module to ${outDir}/${namespaceStr}.js`);

  await runCli(pbcli.pbts, [
    "--out",
    `${outDir}/${namespaceStr}.d.ts`,
    `${outDir}/${namespaceStr}.js`,
  ]);
  console.log(`Wrote TS definitions to ${outDir}/${namespaceStr}.d.ts`);

  return { namespace: namespace.resolveAll() };
}
