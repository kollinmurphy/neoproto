import { readFile, writeFile } from "node:fs/promises";
import proto from "protobufjs";
import pbcli from "protobufjs-cli";

async function runProtobufjsCli(protoPath: string, outDir: string) {
  const { root } = proto.parse(await readFile(protoPath, "utf8"), {
    alternateCommentMode: true,
  });
  const json = root.toJSON({ keepComments: true });
  const namespaceStr = Object.keys(root.nested ?? {})[0];
  if (!namespaceStr) throw new Error(`No namespace found in ${protoPath}`);
  const namespace = root.nested?.[namespaceStr] as proto.Namespace;
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
    "--alt-comment",
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

export { runProtobufjsCli };
