import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";
import path from "path";

const prod = process.argv[2] === "production";
// 设置 OUTDIR 环境变量可把构建产物直接输出到 Obsidian 插件目录，
// 例如：OUTDIR="D:/my-vault/.obsidian/plugins/blog-publisher" npm run dev
const outdir = process.env.OUTDIR;

const banner = `/* Blog Publisher (朋友圈博客) - built with esbuild */`;

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ["main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/*",
    "@lezer/*",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

async function copyAssets() {
  if (!outdir) return;
  fs.mkdirSync(outdir, { recursive: true });
  for (const f of ["main.js", "manifest.json", "styles.css"]) {
    if (fs.existsSync(f)) fs.copyFileSync(f, path.join(outdir, f));
  }
  console.log(`[esbuild] 已复制构建产物到: ${outdir}`);
}

if (prod) {
  await context.rebuild();
  await copyAssets();
  process.exit(0);
} else {
  await context.watch();
  await copyAssets();
}
