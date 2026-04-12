/**
 * Libera puertos 3000/3001 (Next dev) y borra .next/dev para evitar
 * "Another next dev server is already running" tras un cierre abrupto.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const devDir = path.join(root, ".next", "dev");

function killPortWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.includes("LISTENING") || !trimmed.includes(`:${port}`)) continue;
      const parts = trimmed.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } catch {
        /* ya terminado */
      }
    }
  } catch {
    /* sin listeners en ese puerto */
  }
}

function killPortUnix(port) {
  try {
    execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null`, {
      shell: "/bin/bash",
      stdio: "ignore",
    });
  } catch {
    /* ok */
  }
}

if (process.platform === "win32") {
  killPortWindows(3000);
  killPortWindows(3001);
} else {
  killPortUnix(3000);
  killPortUnix(3001);
}

if (fs.existsSync(devDir)) {
  fs.rmSync(devDir, { recursive: true, force: true });
}

console.log("[clean-dev] Puertos 3000/3001 liberados y .next/dev eliminado. Podés arrancar next dev.");
