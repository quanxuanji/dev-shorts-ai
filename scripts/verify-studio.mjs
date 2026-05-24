import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const apiDir = path.join(rootDir, "apps/api");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const label = [command, ...args].join(" ");
    console.log(`\n[verify] ${label}`);
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        ...options.env
      },
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function pythonCommand() {
  const venvPython = path.join(apiDir, ".venv/bin/python");
  if (await fileExists(venvPython)) return venvPython;
  return process.env.PYTHON ?? "python3";
}

async function main() {
  const python = await pythonCommand();

  await run(python, ["-m", "compileall", "-f", "app"], { cwd: apiDir });
  await run("npm", ["run", "typecheck"]);
  await run("npm", ["run", "lint:web"]);
  await run("npm", ["run", "typecheck:render"]);
  await run("npm", ["run", "build:web"]);

  console.log("\n[verify] passed");
}

main().catch((error) => {
  console.error(`\n[verify] failed: ${error.message}`);
  process.exit(1);
});

