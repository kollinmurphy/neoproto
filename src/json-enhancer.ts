import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import proto from "protobufjs";
import pbcli from "protobufjs-cli";

const __dirname = new URL(".", import.meta.url).pathname;

async function convertProtoToJson(path: string) {
  const { root } = proto.parse(readFileSync(path, "utf8"), {
    alternateCommentMode: true,
  });
  return root.toJSON({ keepComments: true });
}

const protoPath = `${__dirname}../data/example.proto`;
const outDir = `${__dirname}../data/dist`;

async function main() {
  if (existsSync(outDir)) {
    await rm(outDir, { force: true, recursive: true });
  }
  await mkdir(outDir, { recursive: true });
  const json = await convertProtoToJson(protoPath);
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
}

main();
