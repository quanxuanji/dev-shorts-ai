import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const apiDir = path.join(rootDir, "apps/api");
const outputDir = path.join(rootDir, "apps/api/artifacts/real-project-screenshots");

const shots = [
  ["topic", "01-real-studio-overview.png"],
  ["topic", "02-real-topic-brief.png"],
  ["script", "03-real-script-editor.png"],
  ["tts", "04-real-voice-config.png"],
  ["render", "05-real-scene-timeline.png"],
  ["export", "06-real-export-panel.png"],
  ["export", "07-real-final-preview.png"]
];

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(url, timeoutMs = 45_000) {
  const started = Date.now();
  let lastError;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? "unknown error"}`);
}

function startApiServer(port, webPort) {
  const python = process.env.PYTHON ?? path.join(apiDir, ".venv/bin/python");
  const child = spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: apiDir,
      env: {
        ...process.env,
        API_CORS_ORIGINS: `http://127.0.0.1:${webPort},http://localhost:${webPort},http://127.0.0.1:3000,http://localhost:3000`,
        PYTHONUNBUFFERED: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  child.stdout.on("data", (data) => process.stdout.write(`[api] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[api] ${data}`));
  return child;
}

async function ensureApiPython() {
  const configured = process.env.PYTHON;
  if (configured) return configured;
  const venvPython = path.join(apiDir, ".venv/bin/python");
  try {
    await access(venvPython);
    return venvPython;
  } catch {
    return "python3";
  }
}

function startWebServer(port, apiBaseUrl) {
  const child = spawn(
    "npm",
    ["--workspace", "apps/web", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: apiBaseUrl,
        NEXT_TELEMETRY_DISABLED: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  child.stdout.on("data", (data) => process.stdout.write(`[web] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[web] ${data}`));
  return child;
}

async function validatePng(filePath) {
  const info = await stat(filePath);
  if (info.size <= 0) {
    throw new Error(`${path.basename(filePath)} is empty`);
  }

  const buffer = await readFile(filePath);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width !== 1920 || height !== 1080) {
    throw new Error(`${path.basename(filePath)} has invalid size ${width}x${height}, expected 1920x1080`);
  }
}

async function clickStage(page, stage) {
  if (stage === "topic") return;
  const labelByStage = {
    script: "LLM Script",
    tts: "FishSpeech TTS",
    subtitle: "Subtitle",
    render: "Remotion Render",
    export: "FFmpeg Export"
  };
  const label = labelByStage[stage];
  await page.getByText(label, { exact: false }).first().click({ timeout: 8_000 });
  await page.waitForTimeout(250);
}

async function installRuntimeRoutes(page, apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/api/studio/runtime?demo=true`);
  if (!response.ok) {
    throw new Error(`Unable to load demo runtime: HTTP ${response.status}`);
  }
  const runtime = await response.json();
  const task = runtime.task ?? {
    id: runtime.task_id,
    title: runtime.title,
    topic: runtime.topic,
    target_style: runtime.target_style,
    status: runtime.status,
    progress: runtime.progress,
    current_step: runtime.current_step,
    mode: "semi_real",
    source_url: "",
    local_file_path: "",
    artifacts: {},
    steps: [],
    logs: runtime.logs ?? [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await page.route("**/api/tasks/recent", (route) => route.fulfill({ json: [task] }));
  await page.route(`**/api/tasks/${task.id}`, (route) => route.fulfill({ json: task }));
  await page.route("**/api/studio/runtime?task_id=*", (route) => route.fulfill({ json: runtime }));
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const externalBaseUrl = process.env.REAL_STUDIO_BASE_URL;
  const externalApiUrl = process.env.REAL_STUDIO_API_URL;
  const webPort = externalBaseUrl ? null : await findFreePort();
  const apiPort = externalApiUrl ? null : await findFreePort();
  const apiBaseUrl = externalApiUrl ?? `http://127.0.0.1:${apiPort}`;
  const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${webPort}`;
  if (!externalApiUrl) {
    process.env.PYTHON = await ensureApiPython();
  }
  const apiServer = externalApiUrl ? null : startApiServer(apiPort, webPort);
  const webServer = externalBaseUrl ? null : startWebServer(webPort, apiBaseUrl);

  try {
    await waitForServer(`${apiBaseUrl}/api/studio/runtime?demo=true`);
    await waitForServer(`${baseUrl}/studio`);

    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
      headless: true
    });
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });

    await installRuntimeRoutes(page, apiBaseUrl);
    await page.goto(`${baseUrl}/studio`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.waitForTimeout(500);

    for (const [stage, filename] of shots) {
      await clickStage(page, stage);
      await page.screenshot({
        path: path.join(outputDir, filename),
        fullPage: false,
        animations: "disabled"
      });
    }

    await browser.close();

    for (const [, filename] of shots) {
      await validatePng(path.join(outputDir, filename));
    }

    console.log("real studio screenshots generated:");
    for (const [, filename] of shots) {
      console.log(`- ${filename}`);
    }
  } finally {
    if (webServer) {
      webServer.kill("SIGTERM");
      setTimeout(() => {
        if (!webServer.killed) webServer.kill("SIGKILL");
      }, 2_000).unref();
    }
    if (apiServer) {
      apiServer.kill("SIGTERM");
      setTimeout(() => {
        if (!apiServer.killed) apiServer.kill("SIGKILL");
      }, 2_000).unref();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
