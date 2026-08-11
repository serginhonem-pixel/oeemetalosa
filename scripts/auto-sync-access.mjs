// Observa o arquivo .accdb do Access e, quando ele muda, automaticamente:
//   1) roda o export (export-access-oee.ps1) -> atualiza data-import/*.csv
//   2) git add + commit + push do data-import/, se houver diferença
// Assim o app publicado (Vercel) sempre builda com o dado mais recente do
// Access, sem precisar de ninguém rodar sync-access.bat na mao.
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

const accessPath = argMap.get("accessPath") || "C:\\DadosVBA\\BDMETALOSA.accdb";
const debounceMs = Number(argMap.get("debounceMs") || 15000);
const pollMs = Number(argMap.get("pollMs") || 5000);
const runNow = String(argMap.get("runNow") || "false") === "true";

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
    let out = "";
    const child = spawn(cmd, cmdArgs, { shell: false, ...options });
    child.stdout?.on("data", (d) => {
      out += d.toString();
      process.stdout.write(d);
    });
    child.stderr?.on("data", (d) => process.stderr.write(d));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(out);
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
    log("Alteracao detectada no Access. Exportando...");

    let ok = false;
    let lastErr = null;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await runCmd("powershell", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          "scripts\\export-access-oee.ps1",
          "-AccessPath",
          accessPath,
          "-OutDir",
          "data-import",
        ]);
        ok = true;
        break;
      } catch (err) {
        lastErr = err;
        log(`Export tentativa ${attempt}/5 falhou:`, err.message || err);
        if (attempt < 5) await sleep(5000);
      }
    }
    if (!ok) throw lastErr || new Error("Falha no export do Access");

    log("Export concluido. Verificando diferencas no git...");
    await runCmd("git", ["add", "data-import"]);

    // resumo_import_access.json tem um timestamp que muda a cada export,
    // mesmo sem dado novo. So conta como mudanca real se os CSVs mudarem.
    let hasDiff = true;
    try {
      await runCmd("git", [
        "diff",
        "--cached",
        "--quiet",
        "--",
        "data-import/import_producao.csv",
        "data-import/import_paradas.csv",
      ]);
      hasDiff = false; // saiu com 0 = sem diferenca
    } catch (_) {
      hasDiff = true; // saiu != 0 = tem diferenca
    }

    if (!hasDiff) {
      await runCmd("git", ["reset", "--", "data-import"]).catch(() => {});
      log("Nenhuma diferenca nos dados do Access. Nada para commitar.");
      return;
    }

    const msg = `chore: atualiza dados do Access (auto ${new Date().toISOString()})`;
    await runCmd("git", ["commit", "-m", msg]);
    log("Commit criado. Enviando push...");
    await runCmd("git", ["push"]);
    log("Push concluido com sucesso.");
  } catch (err) {
    log("Erro na sincronizacao automatica:", err.message || err);
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
    curr.mtimeMs !== lastMtime || curr.size !== lastSize || curr.mtimeMs !== prev.mtimeMs;
  if (!changed) return;
  lastMtime = curr.mtimeMs;
  lastSize = curr.size;
  log("Mudanca detectada em", accessPath);
  scheduleSync();
});

log("Observando", accessPath, "para sincronizar dados do Access automaticamente.");
log(`Debounce: ${debounceMs}ms | Poll: ${pollMs}ms`);

if (runNow) {
  scheduleSync();
}

process.on("SIGINT", () => {
  log("Encerrando watcher (SIGINT).");
  process.exit(0);
});
