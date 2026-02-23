import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 1) {
  const t = args[i];
  if (!t.startsWith("--")) continue;
  const key = t.slice(2);
  const next = args[i + 1];
  argMap.set(key, next && !next.startsWith("--") ? next : "true");
}

const email = argMap.get("email") || "";
const senha = argMap.get("senha") || "";
const maquinaId = argMap.get("maquinaId") || "CONFORMADORA_TELHAS";
const inputDir = argMap.get("inputDir") || "data-import";
if (!email || !senha) {
  console.error("Uso: node scripts/sync-access-rest.mjs --email <email> --senha <senha>");
  process.exit(1);
}

const parseEnvFile = (filePath) => {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
};

const env = parseEnvFile(path.resolve(".env.local"));
const apiKey = env.VITE_FIREBASE_API_KEY_PROD;
const projectId = env.VITE_FIREBASE_PROJECT_ID_PROD;
if (!apiKey || !projectId) {
  console.error("Env de producao nao encontrada em .env.local");
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
  const targets = candidates.map((c) => normKey(c));
  for (const [k, v] of Object.entries(row || {})) {
    const nk = normKey(k);
    if (targets.includes(nk)) return v;
  }
  for (const [k, v] of Object.entries(row || {})) {
    const nk = normKey(k);
    if (targets.some((t) => nk.includes(t) || t.includes(nk))) return v;
  }
  return "";
};

const toInt = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const excelSerialToIso = (n) => {
  const parsed = XLSX.SSF.parse_date_code(Number(n));
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return "";
  return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
};

const normalizeDate = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return excelSerialToIso(v);
  const t = clean(v);
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
    const [dd, mm, yyyy] = t.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return t;
};

const hhmmToMin = (hhmm) => {
  const t = clean(hhmm);
  if (!t.includes(":")) return 0;
  const [h, m] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
};

const duracaoMin = (inicio, fim) => {
  const d = hhmmToMin(fim) - hhmmToMin(inicio);
  return d > 0 ? d : 0;
};

const readRows = (filePath) => {
  const wb = XLSX.readFile(filePath, { raw: true, codepage: 65001 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
};

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

const normalizeMachineId = (raw) => {
  const txt = clean(raw).toUpperCase();
  if (!txt) return maquinaId;
  if (txt.includes("CONFORMADORA")) return "CONFORMADORA_TELHAS";
  if (txt.includes("BR200")) return "PERFIL_U_BR200_REGIANE";
  if (txt.includes("MARAFON")) return "PERFIL_U_MARAFON";
  if (txt.includes("\"U\" ZL") || txt.includes(" U ZL") || txt.endsWith(" ZL") || txt.includes("PERFIL \"U\" ZL")) {
    return "PERFIL_U_ZL";
  }
  return maquinaId;
};

const machineDisplayById = {
  CONFORMADORA_TELHAS: "Conformadora de Telhas",
  PERFIL_U_BR200_REGIANE: 'Perfil "U" BR200 Regiane',
  PERFIL_U_MARAFON: 'Perfil "U" Marafon',
  PERFIL_U_ZL: 'Perfil "U" ZL',
};

const normalizeCode = (raw) => {
  const txt = clean(raw);
  if (!txt) return "";
  if (/^\d+$/.test(txt)) return txt.padStart(5, "0");
  return txt;
};

const toFields = (obj) => {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number" && Number.isInteger(v)) {
      fields[k] = { integerValue: String(v) };
    } else if (typeof v === "number") {
      fields[k] = { doubleValue: v };
    } else {
      fields[k] = { stringValue: String(v ?? "") };
    }
  }
  return fields;
};

const buildData = () => {
  const prodCsv = path.resolve(inputDir, "import_producao.csv");
  const parCsv = path.resolve(inputDir, "import_paradas.csv");
  const prodXlsx = path.resolve(inputDir, "import_producao.xlsx");
  const parXlsx = path.resolve(inputDir, "import_paradas.xlsx");
  const prodRows = readRows(fs.existsSync(prodCsv) ? prodCsv : prodXlsx);
  const parRows = readRows(fs.existsSync(parCsv) ? parCsv : parXlsx);

  const producao = prodRows
    .map((r) => {
      const data = normalizeDate(getField(r, ["DATA"]));
      const codRaw = getField(r, ["CODIGO", "COD"]);
      const codNum = toInt(codRaw);
      const cod = normalizeCode(codRaw) || (codNum > 0 ? String(codNum).padStart(5, "0") : "");
      const qtd = toInt(getField(r, ["QTD", "QUANTIDADE"]));
      const desc = clean(getField(r, ["DESCRICAO", "DESC"])) || "Item s/ descricao";
      const destino = clean(getField(r, ["DESTINO"])) || "Estoque";
      const maqRaw = getField(r, ["MAQUINA"]);
      const maqId = normalizeMachineId(maqRaw);
      const createdAt = `${data}T12:00:00.000Z`;
      if (!data || !cod || qtd <= 0) return null;
      return {
        data,
        cod,
        qtd,
        desc,
        destino,
        maquinaId: maqId,
        maquina: machineDisplayById[maqId] || clean(maqRaw) || maqId,
        createdAt,
        origem: "ACCESS_SYNC",
      };
    })
    .filter(Boolean);

  const paradas = parRows
    .map((r) => {
      const data = normalizeDate(getField(r, ["DATA"]));
      const inicio = clean(getField(r, ["INICIO"]));
      const fim = clean(getField(r, ["FIM"]));
      const codMotivo = clean(getField(r, ["COD_MOTIVO", "CODIGO", "COD"])).toUpperCase();
      const descMotivo = clean(getField(r, ["DESC", "DESCRICAO"])) || codMotivo || "Motivo nao informado";
      const grupo = clean(getField(r, ["GRUPO"])) || "Geral";
      const obs = clean(getField(r, ["OBS"]));
      const maqRaw = getField(r, ["MAQUINA"]);
      const maqId = normalizeMachineId(maqRaw);
      const duracao = duracaoMin(inicio, fim);
      const createdAt = `${data}T12:00:00.000Z`;
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
        maquinaId: maqId,
        maquina: machineDisplayById[maqId] || clean(maqRaw) || maqId,
        createdAt,
        origem: "ACCESS_SYNC",
      };
    })
    .filter(Boolean);

  return { producao, paradas };
};

const login = async () => {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`login falhou: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.idToken;
};

const commitWrites = async (idToken, writes) => {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`commit falhou: ${res.status} ${await res.text()}`);
};

const queryAccessSyncDocNames = async (idToken, collectionId) => {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: "origem" },
          op: "EQUAL",
          value: { stringValue: "ACCESS_SYNC" },
        },
      },
      limit: 2000,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`runQuery ${collectionId} falhou: ${res.status} ${await res.text()}`);
  }
  const arr = await res.json();
  return arr.filter((x) => x.document?.name).map((x) => x.document.name);
};

const cleanupExistingAccessSync = async (idToken) => {
  const [prodNames, parNames] = await Promise.all([
    queryAccessSyncDocNames(idToken, "producao"),
    queryAccessSyncDocNames(idToken, "paradas"),
  ]);
  const deletes = [...prodNames, ...parNames].map((name) => ({ delete: name }));
  const CHUNK = 450;
  for (let i = 0; i < deletes.length; i += CHUNK) {
    await commitWrites(idToken, deletes.slice(i, i + CHUNK));
  }
  return { prodDeleted: prodNames.length, parDeleted: parNames.length };
};

const run = async () => {
  const { producao, paradas } = buildData();
  const totalPecas = producao.reduce((acc, p) => acc + Number(p.qtd || 0), 0);
  const writes = [];

  for (let i = 0; i < producao.length; i += 1) {
    const row = producao[i];
    const id = makeId("acc_prod", row, i);
    writes.push({
      update: {
        name: `projects/${projectId}/databases/(default)/documents/producao/${id}`,
        fields: toFields(row),
      },
    });
  }

  for (let i = 0; i < paradas.length; i += 1) {
    const row = paradas[i];
    const id = makeId("acc_par", row, i);
    writes.push({
      update: {
        name: `projects/${projectId}/databases/(default)/documents/paradas/${id}`,
        fields: toFields(row),
      },
    });
  }

  const idToken = await login();
  const cleanup = await cleanupExistingAccessSync(idToken);
  console.log(`limpeza ACCESS_SYNC: producao=${cleanup.prodDeleted} paradas=${cleanup.parDeleted}`);
  const CHUNK = 450;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const slice = writes.slice(i, i + CHUNK);
    await commitWrites(idToken, slice);
    console.log(`progresso: ${Math.min(i + CHUNK, writes.length)}/${writes.length}`);
  }

  console.log("Sincronizacao concluida.");
  console.log(`producao: ${producao.length} | pecas: ${totalPecas}`);
  console.log(`paradas: ${paradas.length}`);
};

run().catch((err) => {
  console.error("Falha:", err?.message || err);
  process.exit(1);
});
