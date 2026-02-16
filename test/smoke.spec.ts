import { describe, it, after } from "node:test";
import { run } from "../src";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert";

describe("smoke test", () => {
  const outDir = join(process.cwd(), "tmp_smoke_test");

  after(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("should run without errors", async () => {
    const example = join(__dirname, "../example/example.proto");
    await run({
      outDir: outDir,
      protoPath: example,
      testDir: join(outDir, "tests"),
      flagNoTestExecution: true,
    });
    assert.strictEqual(process.exitCode ?? 0, 0);
  });
});
