import { readFile, writeFile } from "node:fs/promises";
import proto from "protobufjs";
import pbcli from "protobufjs-cli";

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

  pbcli.pbjs.main([
    "--target",
    "static-module",
    "--wrap",
    "es6",
    "--alt-comment", // NOTE: pbjs fails to find comments without the alternate comment mode enabled
    "--out",
    `${outDir}/${namespaceStr}.js`,
    protoPath,
  ]);
  console.log(`Wrote JS module to ${outDir}/${namespaceStr}.js`);

  pbcli.pbts.main([
    "--out",
    `${outDir}/${namespaceStr}.d.ts`,
    `${outDir}/${namespaceStr}.js`,
  ]);
  console.log(`Wrote TS definitions to ${outDir}/${namespaceStr}.d.ts`);

  return { namespace, root };
}
