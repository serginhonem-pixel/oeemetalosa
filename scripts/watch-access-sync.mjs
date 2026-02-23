import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 1) {
  const t = args[i];
  if (!t.startsWith("--")) continue;
  const key = t.slice(2);
  const next = args[i + 1];
  argMap.set(key, next && !next.startsWith("--") ? next : "true");
}

const accessPath =
  argMap.get("accessPath") || "C:\\DadosVBA\\BDMETALOSA.accdb";
const email = argMap.get("email") || "";
const senha = argMap.get("senha") || "";
const maquinaId = argMap.get("maquinaId") || "CONFORMADORA_TELHAS";
const debounceMs = Number(argMap.get("debounceMs") || 8000);
const pollMs = Number(argMap.get("pollMs") || 2000);
const runNow = String(argMap.get("runNow") || "false") === "true";

if (!email || !senha) {
  console.error(
    "Uso: node scripts/watch-access-sync.mjs --email <email> --senha <senha> [--accessPath C:\\DadosVBA\\BDMETALOSA.accdb]"
  );
  process.exit(1);
}

if (!fs.existsSync(accessPath)) {
  console.error(`Arquivo Access nao encontrado: ${accessPath}`);
  process.exit(1);
}

const log = (...parts) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}]`, ...parts);
};

const runCmd = (cmd, cmdArgs, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} saiu com codigo ${code}`));
    });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let running = false;
let queued = false;
let debounceTimer = null;

const runSync = async () => {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  try {
    log("Alteracao detectada. Iniciando export + sync...");

    // Retry curto: o Access pode ainda estar gravando no instante da mudanca.
    let ok = false;
    let lastErr = null;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await runCmd("powershell", [
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          "scripts\\export-access-oee.ps1",
          "-AccessPath",
          accessPath,
          "-OutDir",
          "data-import",
        ]);

        await runCmd("node", [
          "scripts\\sync-access-rest.mjs",
          "--email",
          email,
          "--senha",
          senha,
          "--maquinaId",
          maquinaId,
          "--inputDir",
          "data-import",
        ]);
        ok = true;
        break;
      } catch (err) {
        lastErr = err;
        log(`Tentativa ${attempt}/5 falhou:`, err.message || err);
        if (attempt < 5) await sleep(5000);
      }
    }
    if (!ok) {
      throw lastErr || new Error("Falha na sincronizacao");
    }

    log("Sincronizacao concluida com sucesso.");
  } catch (err) {
    log("Erro na sincronizacao:", err.message || err);
  } finally {
    running = false;
    if (queued) {
      queued = false;
      setTimeout(() => {
        runSync().catch(() => {});
      }, 1000);
    }
  }
};

const scheduleSync = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runSync().catch(() => {});
  }, debounceMs);
};

const stat0 = fs.statSync(accessPath);
let lastMtime = stat0.mtimeMs;
let lastSize = stat0.size;

fs.watchFile(accessPath, { interval: pollMs }, (curr, prev) => {
  if (!curr || !prev) return;
  const changed =
    curr.mtimeMs !== lastMtime ||
    curr.size !== lastSize ||
    curr.mtimeMs !== prev.mtimeMs ||
    curr.size !== prev.size;
  if (!changed) return;
  lastMtime = curr.mtimeMs;
  lastSize = curr.size;
  scheduleSync();
});

log("Watcher ativo.");
log(`Arquivo: ${accessPath}`);
log(`Debounce: ${debounceMs}ms | Poll: ${pollMs}ms`);
log("Aguardando alteracoes...");

if (runNow) {
  runSync().catch(() => {});
}

process.on("SIGINT", () => {
  fs.unwatchFile(accessPath);
  log("Watcher finalizado.");
  process.exit(0);
});
