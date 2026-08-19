import { spawnSync } from "node:child_process";


const isWindows = process.platform === "win32";
const pythonExecutable = process.env.PYTHON_EXE || (isWindows ? "py" : "python3");
const pythonPrefix = isWindows && !process.env.PYTHON_EXE ? ["-3.11"] : [];
const hugoExecutable = process.env.HUGO_EXE || "hugo";
const task = process.argv[2];


function run(executable, args) {
  const display = [executable, ...args].map((value) => (
    /\s/.test(value) ? JSON.stringify(value) : value
  )).join(" ");
  process.stdout.write(`[site-tasks] ${display}\n`);

  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
      PYTHONDONTWRITEBYTECODE: "1",
    },
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}


function runPython(args) {
  run(pythonExecutable, [...pythonPrefix, "-X", "utf8", ...args]);
}


if (task === "test") {
  runPython(["-m", "unittest", "discover", "-s", "scripts/tests"]);
} else if (task === "build") {
  runPython(["scripts/normalize_markdown_image_paths.py"]);
  runPython(["scripts/sync_images.py"]);
  runPython(["scripts/sync_icons.py"]);
  run(hugoExecutable, ["--minify", "--buildFuture", "--cleanDestinationDir"]);
  runPython(["scripts/prepare_cloudflare_assets.py"]);
} else {
  process.stderr.write("Usage: node scripts/site_tasks.mjs <test|build>\n");
  process.exit(2);
}
