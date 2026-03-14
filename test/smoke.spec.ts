import { describe, it, beforeEach, afterEach } from "node:test";
import { run } from "../src";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert";
import { existsSync } from "node:fs";

describe("smoke test", () => {
  const outDir = join(process.cwd(), "tmp_smoke_test");

  beforeEach(async () => {
    if (existsSync(outDir)) await rm(outDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("should run without errors", async () => {
    const example = join(__dirname, "../example/example.proto");
    const { error } = await run({
      outDir: outDir,
      protoPath: example,
      testDir: join(outDir, "tests"),
      flagNoTestExecution: true,
      flagVerbose: true,
    });
    assert.strictEqual(error, false);
  });
});
