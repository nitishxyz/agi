import { build } from "bun";

const entrypoints = ["./src/index.ts", "./src/cli.ts"];

const result = await build({
  entrypoints,
  outdir: "./dist",
  target: "bun",
  format: "esm",
  splitting: true,
  sourcemap: "none",
  external: [],
  minify: true,
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Built ${result.outputs.length} files to dist/`);
for (const output of result.outputs) {
  console.log(`  ${output.path} (${(output.size / 1024).toFixed(1)}KB)`);
}
