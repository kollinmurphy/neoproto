import { readFile, writeFile } from "node:fs/promises";
import proto from "protobufjs";
import pbcli from "protobufjs-cli";

async function runProtobufjsCli(protoPath: string, outDir: string) {
  const { root } = proto.parse(await readFile(protoPath, "utf8"), {
    alternateCommentMode: true,
  });
  const json = root.toJSON({ keepComments: true });
  await writeFile(`${outDir}/example.json`, JSON.stringify(json, null, 2));
  console.log(`Wrote JSON to ${outDir}/example.json`);

  pbcli.pbjs.main([
    "--target",
    "static-module",
    "--wrap",
    "es6",
    "--alt-comment",
    "--out",
    `${outDir}/example.js`,
    protoPath,
  ]);
  console.log(`Wrote JS module to ${outDir}/example.js`);

  pbcli.pbts.main(["--out", `${outDir}/example.d.ts`, `${outDir}/example.js`]);
  console.log(`Wrote TS definitions to ${outDir}/example.d.ts`);

  return { root };
}

export { runProtobufjsCli };
