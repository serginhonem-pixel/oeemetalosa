import fs from "fs";
import path from "path";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, writeBatch } from "firebase/firestore";
import XLSX from "xlsx";

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 1) {
  const token = args[i];
  if (!token.startsWith("--")) continue;
  const key = token.slice(2);
  const next = args[i + 1];
  const hasValue = next && !next.startsWith("--");
  argMap.set(key, hasValue ? next : "true");
}

const email = argMap.get("email") || "";
const senha = argMap.get("senha") || "";
const maquinaId = argMap.get("maquinaId") || "CONFORMADORA_TELHAS";
const inputDir = argMap.get("inputDir") || "data-import";

if (!email || !senha) {
  console.error(
    "Uso: node scripts/sync-access-to-firestore.mjs --email <email> --senha <senha> [--maquinaId CONFORMADORA_TELHAS]"
  );
  process.exit(1);
}

const parseEnvFile = (filePath) => {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    out[k] = v;
  });
  return out;
};

const env = parseEnvFile(path.resolve(".env.local"));
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY_PROD,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN_PROD,
  projectId: env.VITE_FIREBASE_PROJECT_ID_PROD,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET_PROD,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID_PROD,
  appId: env.VITE_FIREBASE_APP_ID_PROD,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID_PROD,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Config Firebase PROD nao encontrada em .env.local");
  process.exit(1);
}

const clean = (v) => String(v ?? "").trim();
const normKey = (v) =>
  clean(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

const getField = (row, candidates) => {
  const entries = Object.entries(row || {});
  const target = candidates.map((c) => normKey(c));
  for (const [k, v] of entries) {
    const nk = normKey(k);
    if (target.includes(nk)) return v;
  }
  // fallback tolerante para cabecalhos corrompidos, ex: ATA" -> DATA
  for (const [k, v] of entries) {
    const nk = normKey(k);
    if (target.some((t) => nk.includes(t) || t.includes(nk))) return v;
  }
  return "";
};

const excelSerialToIso = (n) => {
  const parsed = XLSX.SSF.parse_date_code(Number(n));
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return "";
  const y = String(parsed.y).padStart(4, "0");
  const m = String(parsed.m).padStart(2, "0");
  const d = String(parsed.d).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const toInt = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const hhmmToMin = (hhmm) => {
  const txt = clean(hhmm);
  if (!txt.includes(":")) return 0;
  const [h, m] = txt.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
};

const duracaoMin = (inicio, fim) => {
  const i = hhmmToMin(inicio);
  const f = hhmmToMin(fim);
  const d = f - i;
  return d > 0 ? d : 0;
};

const normalizeDate = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) {
    return excelSerialToIso(v);
  }
  const txt = clean(v);
  if (!txt) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
    const [dd, mm, yyyy] = txt.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return txt;
};

const parseSheetRows = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo nao encontrado: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath, { raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
};

const buildProducao = (rows) =>
  rows
    .map((r) => {
      const data = normalizeDate(getField(r, ["DATA"]));
      const codRaw = getField(r, ["CODIGO", "COD"]);
      const codNum = toInt(codRaw);
      const cod = clean(codRaw) || (codNum > 0 ? String(codNum).padStart(5, "0") : "");
      const qtd = toInt(getField(r, ["QTD", "QUANTIDADE"]));
      const desc = clean(getField(r, ["DESCRICAO", "DESC"])) || "Item s/ descricao";
      const destino = clean(getField(r, ["DESTINO"])) || "Estoque";
      if (!data || !cod || qtd <= 0) return null;
      return { data, cod, qtd, desc, destino, maquinaId, origem: "ACCESS_SYNC" };
    })
    .filter(Boolean);

const buildParadas = (rows) =>
  rows
    .map((r) => {
      const data = normalizeDate(getField(r, ["DATA"]));
      const inicio = clean(getField(r, ["INICIO"]));
      const fim = clean(getField(r, ["FIM"]));
      const codMotivo = clean(getField(r, ["COD_MOTIVO", "CODMOTIVO", "CODIGO"])).toUpperCase();
      const descMotivo = clean(getField(r, ["DESC", "DESCRICAO"])) || codMotivo || "Motivo nao informado";
      const grupo = clean(getField(r, ["GRUPO"])) || "Geral";
      const obs = clean(getField(r, ["OBS"]));
      const duracao = duracaoMin(inicio, fim);
      if (!data || !inicio || !fim || !codMotivo || duracao <= 0) return null;
      return {
        data,
        inicio,
        fim,
        duracao,
        codMotivo,
        descMotivo,
        grupo,
        obs,
        maquinaId,
        origem: "ACCESS_SYNC",
      };
    })
    .filter(Boolean);

const makeId = (prefix, payload, idx) => {
  const base = [
    payload.data,
    payload.cod || payload.codMotivo || "",
    payload.qtd || payload.duracao || "",
    payload.inicio || "",
    payload.fim || "",
    idx,
  ]
    .map((x) => String(x))
    .join("_");
  return `${prefix}_${base}`.replace(/[^a-zA-Z0-9_\-]/g, "");
};

const run = async () => {
  const prodFile = path.resolve(inputDir, "import_producao.xlsx");
  const parFile = path.resolve(inputDir, "import_paradas.xlsx");
  const producao = buildProducao(parseSheetRows(prodFile));
  const paradas = buildParadas(parseSheetRows(parFile));

  if (!producao.length && !paradas.length) {
    throw new Error("Nenhum dado valido para sincronizar.");
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, senha);
  const db = getFirestore(app);

  let prodOk = 0;
  let parOk = 0;
  const ops = [];
  for (let i = 0; i < producao.length; i += 1) {
    const row = producao[i];
    const id = makeId("acc_prod", row, i);
    ops.push({ ref: doc(db, "producao", id), data: row });
  }
  for (let i = 0; i < paradas.length; i += 1) {
    const row = paradas[i];
    const id = makeId("acc_par", row, i);
    ops.push({ ref: doc(db, "paradas", id), data: row });
  }

  const CHUNK = 400; // abaixo do limite de 500 por batch
  for (let i = 0; i < ops.length; i += CHUNK) {
    const slice = ops.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const op of slice) {
      batch.set(op.ref, op.data, { merge: true });
    }
    await batch.commit();
    const done = Math.min(i + CHUNK, ops.length);
    console.log(`progresso: ${done}/${ops.length}`);
  }

  prodOk = producao.length;
  parOk = paradas.length;

  const totalPecas = producao.reduce((acc, p) => acc + Number(p.qtd || 0), 0);
  console.log(`Sincronizacao concluida.`);
  console.log(`producao: ${prodOk} registros | pecas: ${totalPecas}`);
  console.log(`paradas: ${parOk} registros`);
};

run().catch((err) => {
  console.error("Falha na sincronizacao:", err?.message || err);
  process.exit(1);
});
