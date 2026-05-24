import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "apps/api/artifacts/showcase-images");

const shots = [
  ["cover", "01-cover.png"],
  ["topic", "02-topic-input.png"],
  ["script", "03-script-generation.png"],
  ["voice", "04-voice-config.png"],
  ["scenes", "05-scene-preview.png"],
  ["export", "06-export-result.png"],
  ["summary", "07-product-summary.png"]
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
  const python = path.join(rootDir, "apps/api/.venv/bin/python");
  const child = spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: path.join(rootDir, "apps/api"),
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

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const externalBaseUrl = process.env.SHOWCASE_BASE_URL;
  const externalApiUrl = process.env.SHOWCASE_API_URL;
  const port = externalBaseUrl ? null : await findFreePort();
  const apiPort = externalApiUrl ? null : await findFreePort();
  const apiBaseUrl = externalApiUrl ?? `http://127.0.0.1:${apiPort}`;
  const apiServer = externalApiUrl ? null : startApiServer(apiPort, port);
  const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`;
  const server = externalBaseUrl ? null : startWebServer(port, apiBaseUrl);

  try {
    await waitForServer(`${apiBaseUrl}/api/studio/runtime?demo=true`);
    await waitForServer(`${baseUrl}/showcase?shot=cover`);

    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
      headless: true
    });
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });

    for (const [shot, filename] of shots) {
      const target = `${baseUrl}/showcase?shot=${shot}`;
      await page.goto(target, { waitUntil: "networkidle" });
      await page.waitForLoadState("domcontentloaded");
      await page.waitForSelector('[data-runtime-loaded="true"]', { timeout: 15_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.waitForTimeout(350);
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

    console.log("showcase images generated:");
    for (const [, filename] of shots) {
      console.log(`- ${filename}`);
    }
  } finally {
    if (server) {
      server.kill("SIGTERM");
      setTimeout(() => {
        if (!server.killed) server.kill("SIGKILL");
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
