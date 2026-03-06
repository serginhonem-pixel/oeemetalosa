import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertOctagon,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Clock,
  Factory,
  Filter,
  Layers,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  LineChart,
  Line,
  Legend,
} from "recharts";

import { CATALOGO_MAQUINAS } from "../data/catalogoMaquinas";
import { CATALOGO_PRODUTOS } from "../data/catalogoProdutos";
import { GRUPOS_MAQUINAS } from "../data/gruposMaquinas";
import { DICIONARIO_PARADAS } from "../data/dicionarioParadas";

// ── helpers ────────────────────────────────────────────
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ORIGENS_EXCLUIDAS_OEE = new Set(["FINALIZACAO_ORDEM", "FINALIZACAO_RAPIDA"]);
const DEFAULT_VELOCIDADE = 25;

const normalizeISODateInput = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  const base = raw.includes("T") ? raw.slice(0, 10) : raw;
  if (ISO_DATE_RE.test(base)) return base;
  const br = base.match(BR_DATE_RE);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return base;
};

const parseISODate = (value) => {
  const iso = normalizeISODateInput(value);
  if (!ISO_DATE_RE.test(iso)) return null;
  const dt = new Date(`${iso}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const getItemDateISO = (item) => {
  if (!item || typeof item !== "object") return "";
  const candidates = [item.data, item.date, item.dataProducao, item.dataApontamento, item.createdAt];
  for (const v of candidates) {
    const iso = normalizeISODateInput(v);
    if (ISO_DATE_RE.test(iso)) return iso;
  }
  return "";
};

const normalizeMachineToken = (value) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();

const normalizeProductCode = (value) =>
  String(value || "").trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const normalizeTextToken = (value) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

const clampPercent = (v) => (!Number.isFinite(v) ? 0 : Math.max(0, Math.min(100, v)));

const formatDateBR = (iso) => {
  if (!iso) return "-";
  const n = normalizeISODateInput(iso);
  if (!ISO_DATE_RE.test(n)) return String(iso);
  const [y, m, d] = n.split("-");
  return `${d}/${m}/${y}`;
};

const todayISO = () => new Date().toISOString().split("T")[0];

const getDuracaoMin = (p) => {
  const parseMinutes = (v) => {
    if (v == null) return 0;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const raw = String(v).trim().replace(",", ".");
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
    const match = raw.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };
  const direto = parseMinutes(p.duracao) || parseMinutes(p.duracaoMinutos);
  if (direto) return direto;
  const paraMin = (hhmm) => {
    if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return 0;
    const [h, m] = hhmm.split(":").map((v) => Number(v));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  };
  const diff = paraMin(p.horaFim || p.fim) - paraMin(p.horaInicio || p.inicio);
  return diff > 0 ? diff : 0;
};

const getItemMachineToken = (item) => {
  const candidates = [item.maquinaId, item.maquinaid, item.maquina, item.maquinaNome, item.maquinaExibicao, item.nomeMaquina, item.equipamento, item.eqp];
  for (const c of candidates) {
    const tk = normalizeMachineToken(c);
    if (tk) return tk;
  }
  return "";
};

const getWeekKey = (isoDate) => {
  const dt = new Date(`${isoDate}T00:00:00`);
  const day = dt.getDay();
  const monday = new Date(dt.getTime() - ((day === 0 ? 6 : day - 1) * MS_PER_DAY));
  return monday.toISOString().split("T")[0];
};

// ── color palette ──────────────────────────────
const ACCENT_COLORS = ["#22c55e", "#3b82f6", "#eab308", "#ec4899", "#a855f7", "#f97316", "#14b8a6", "#ef4444", "#6366f1", "#84cc16"];
const getBarColor = (idx) => ACCENT_COLORS[idx % ACCENT_COLORS.length];

// ── grupo color map ──
const GRUPO_COLORS = { IND: "#ef4444", PP: "#3b82f6", RET: "#eab308", TU: "#22c55e" };
const GRUPO_LABELS = { IND: "Industrial", PP: "Planej. Produção", RET: "Regulagem", TU: "Turno" };

// ────────────────────────────────────────────────
export default function InsightsScreen({
  historicoProducaoReal,
  historicoParadas,
  maquinasExtras = [],
  dataInicioInd,
  dataFimInd,
  turnoHoras,
  capacidadeDiaria,
}) {
  const [preset, setPreset] = useState("7d");
  const [velocidadeMpm] = useState(DEFAULT_VELOCIDADE);

  const resolvedRange = useMemo(() => {
    const hoje = new Date();
    let start, end;
    if (preset === "today") { start = hoje; end = hoje; }
    else if (preset === "7d") { end = hoje; start = new Date(hoje.getTime() - 6 * MS_PER_DAY); }
    else if (preset === "month") { end = hoje; start = new Date(hoje.getFullYear(), hoje.getMonth(), 1); }
    else if (preset === "year") { end = hoje; start = new Date(hoje.getFullYear(), 0, 1); }
    else { return { startISO: normalizeISODateInput(dataInicioInd || todayISO()), endISO: normalizeISODateInput(dataFimInd || todayISO()) }; }
    return { startISO: start.toISOString().split("T")[0], endISO: end.toISOString().split("T")[0] };
  }, [preset, dataInicioInd, dataFimInd]);

  // ── machine catalog (merge extras) ──
  const maquinasCatalogo = useMemo(() => {
    const base = CATALOGO_MAQUINAS.filter((m) => m.ativo);
    const extras = (Array.isArray(maquinasExtras) ? maquinasExtras : []).map((m, idx) => {
      const nome = String(m?.nomeExibicao || m?.nome || m?.maquina || m?.maquinaNome || "").trim();
      const id = String(m?.maquinaId || m?.id || nome || `EXTRA_${idx + 1}`).trim();
      return { maquinaId: id, nomeExibicao: nome || id, ativo: true };
    });
    const byKey = new Map();
    [...base, ...extras].forEach((m) => {
      const id = String(m?.maquinaId || m?.id || "").trim();
      const nome = String(m?.nomeExibicao || m?.nome || "").trim();
      const key = normalizeMachineToken(id || nome);
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, { maquinaId: id || nome, nomeExibicao: nome || id, ativo: true });
    });
    return Array.from(byKey.values());
  }, [maquinasExtras]);

  const machineTokenToName = useMemo(() => {
    const map = new Map();
    maquinasCatalogo.forEach((m) => {
      map.set(normalizeMachineToken(m.maquinaId), m.nomeExibicao);
    });
    return map;
  }, [maquinasCatalogo]);

  const getMachineName = (token) => machineTokenToName.get(token) || token;

  // ── produto lookup ──
  const produtoByCode = useMemo(() => new Map((Array.isArray(CATALOGO_PRODUTOS) ? CATALOGO_PRODUTOS : []).map((p) => [normalizeProductCode(p?.cod), p])), []);
  const produtoByDesc = useMemo(() => new Map((Array.isArray(CATALOGO_PRODUTOS) ? CATALOGO_PRODUTOS : []).map((p) => [normalizeTextToken(p?.desc), p])), []);

  const getProdutoFromItem = (item) => {
    for (const code of [item?.cod, item?.codigo, item?.CODIGO, item?.codProduto, item?.produtoCodigo]) {
      const found = produtoByCode.get(normalizeProductCode(code));
      if (found) return found;
    }
    for (const desc of [item?.desc, item?.descricao, item?.DESCRICAO]) {
      const found = produtoByDesc.get(normalizeTextToken(desc));
      if (found) return found;
    }
    return null;
  };

  // ── BIG COMPUTE ──────────────────────────────────
  const insights = useMemo(() => {
    const { startISO, endISO } = resolvedRange;
    const startDate = parseISODate(startISO);
    const endDate = parseISODate(endISO);
    if (!startDate || !endDate) return null;

    const turnoMin = (Number(turnoHoras) || 0) * 60;
    const capacidadeKgMin = turnoMin > 0 ? (Number(capacidadeDiaria) || 0) / turnoMin : 0;

    // filter helpers
    const inRange = (item) => {
      const iso = getItemDateISO(item);
      return ISO_DATE_RE.test(iso) && iso >= startISO && iso <= endISO;
    };

    const prodAll = (Array.isArray(historicoProducaoReal) ? historicoProducaoReal : []).filter(inRange);
    const prodFiltered = prodAll.filter((item) => {
      const origem = String(item.origem || "").toUpperCase();
      return !ORIGENS_EXCLUIDAS_OEE.has(origem);
    });
    const prod = prodFiltered.length > 0 ? prodFiltered : prodAll;

    const paradas = (Array.isArray(historicoParadas) ? historicoParadas : []).filter(inRange);
    const isPerdaReal = (p) => {
      const cod = String(p.codMotivo || p.motivoCodigo || "").trim().toUpperCase();
      return cod !== "TU001";
    };
    const perdas = paradas.filter(isPerdaReal);

    // ── per-machine stats ──
    const machineStats = new Map(); // token → { nomeExibicao, totalParadasMin, totalProdPcs, totalProdKg, totalMetros, diasComRegistro: Set }

    const ensureMachine = (token) => {
      if (!machineStats.has(token)) {
        machineStats.set(token, {
          nomeExibicao: getMachineName(token),
          totalParadasMin: 0,
          totalProdPcs: 0,
          totalProdKg: 0,
          totalMetros: 0,
          diasComRegistro: new Set(),
        });
      }
      return machineStats.get(token);
    };

    prod.forEach((item) => {
      const tk = getItemMachineToken(item);
      if (!tk) return;
      const st = ensureMachine(tk);
      const iso = getItemDateISO(item);
      if (iso) st.diasComRegistro.add(iso);
      const qtd = Number(item.qtd) || 0;
      st.totalProdPcs += qtd;

      const prodInfo = getProdutoFromItem(item);
      const compRegistro = Number(item.comp || item.compMetros || 0);
      const compCatalogo = Number(prodInfo?.comp || 0);
      const comp = prodInfo && prodInfo.custom ? compRegistro : compCatalogo || compRegistro;
      st.totalMetros += qtd * comp;

      let peso = Number(item.pesoTotal) || 0;
      if (!peso && prodInfo) {
        if (prodInfo.custom) peso = qtd * comp * Number(prodInfo.kgMetro || 0);
        else peso = qtd * Number(prodInfo.pesoUnit || 0);
      }
      st.totalProdKg += peso;
    });

    perdas.forEach((p) => {
      const tk = getItemMachineToken(p);
      if (!tk) return;
      const st = ensureMachine(tk);
      const iso = getItemDateISO(p);
      if (iso) st.diasComRegistro.add(iso);
      st.totalParadasMin += getDuracaoMin(p);
    });

    // compute per-machine KPIs
    const machineKPIs = [];
    machineStats.forEach((st, token) => {
      const dias = st.diasComRegistro.size;
      if (dias === 0) return;
      const tempoTurno = dias * turnoMin;
      const tempoParado = st.totalParadasMin;
      const tempoRodando = Math.max(0, tempoTurno - tempoParado);
      const disponibilidade = tempoTurno > 0 ? (tempoRodando / tempoTurno) * 100 : 0;

      // performance
      const idealMetros = tempoRodando * velocidadeMpm;
      let performance = 0;
      if (idealMetros > 0 && st.totalMetros > 0) performance = (st.totalMetros / idealMetros) * 100;
      else {
        const idealKg = tempoRodando * capacidadeKgMin;
        if (idealKg > 0 && st.totalProdKg > 0) performance = (st.totalProdKg / idealKg) * 100;
      }

      const qualidade = 100;
      const oee = (disponibilidade / 100) * (performance / 100) * (qualidade / 100) * 100;

      machineKPIs.push({
        token,
        nome: st.nomeExibicao,
        disponibilidade: clampPercent(disponibilidade),
        performance: clampPercent(performance),
        qualidade,
        oee: clampPercent(oee),
        totalParadasMin: tempoParado,
        totalProdPcs: st.totalProdPcs,
        totalProdKg: st.totalProdKg,
        dias,
      });
    });

    // rank
    const rankDisp = [...machineKPIs].sort((a, b) => b.disponibilidade - a.disponibilidade);
    const rankOEE = [...machineKPIs].sort((a, b) => b.oee - a.oee);

    // ── TOP 10 motivos (todas as máquinas) ──
    const motivosMap = {};
    perdas.forEach((p) => {
      const key = p.descMotivo || p.descNorm || "Motivo não informado";
      motivosMap[key] = (motivosMap[key] || 0) + getDuracaoMin(p);
    });
    const paretoGeral = Object.entries(motivosMap)
      .map(([motivo, duracao]) => ({ motivo, duracao: Math.round(duracao) }))
      .sort((a, b) => b.duracao - a.duracao)
      .slice(0, 10);

    // ── Paradas por grupo (IND, PP, RET, TU) ──
    const grupoPerdas = {};
    perdas.forEach((p) => {
      const cod = String(p.codMotivo || p.motivoCodigo || "").trim().toUpperCase();
      const entry = DICIONARIO_PARADAS.find((d) => d.codigo === cod);
      const grupo = entry?.grupo || "OUTRO";
      grupoPerdas[grupo] = (grupoPerdas[grupo] || 0) + getDuracaoMin(p);
    });
    const paradasPorGrupo = Object.entries(grupoPerdas)
      .map(([grupo, duracao]) => ({ grupo, duracao: Math.round(duracao), label: GRUPO_LABELS[grupo] || grupo, color: GRUPO_COLORS[grupo] || "#71717a" }))
      .sort((a, b) => b.duracao - a.duracao);

    // ── Heatmap: maquina x motivo ──
    const heatmapMotivos = paretoGeral.slice(0, 6).map((p) => p.motivo);
    const heatmapMachines = rankDisp.map((m) => m.token);
    const heatmapData = [];
    heatmapMachines.forEach((tk) => {
      const row = { maquina: getMachineName(tk) };
      heatmapMotivos.forEach((motivo) => { row[motivo] = 0; });
      heatmapData.push(row);
    });

    perdas.forEach((p) => {
      const tk = getItemMachineToken(p);
      const motivo = p.descMotivo || p.descNorm || "Motivo não informado";
      if (!heatmapMotivos.includes(motivo)) return;
      const rowIdx = heatmapMachines.indexOf(tk);
      if (rowIdx < 0) return;
      heatmapData[rowIdx][motivo] += getDuracaoMin(p);
    });

    // ── evolução temporal OEE (adaptativa: diário / semanal / mensal) ──
    const diasSpan = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1);
    const granularity = diasSpan <= 14 ? "day" : diasSpan <= 90 ? "week" : "month";

    const getBucketKey = (isoDate) => {
      if (granularity === "day") return isoDate;
      if (granularity === "week") return getWeekKey(isoDate);
      return isoDate.slice(0, 7); // YYYY-MM
    };

    const bucketMap = new Map(); // bucketKey → { prod[], paradas[] }
    prod.forEach((item) => {
      const iso = getItemDateISO(item);
      if (!iso) return;
      const bk = getBucketKey(iso);
      if (!bucketMap.has(bk)) bucketMap.set(bk, { prod: [], paradas: [] });
      bucketMap.get(bk).prod.push(item);
    });
    perdas.forEach((p) => {
      const iso = getItemDateISO(p);
      if (!iso) return;
      const bk = getBucketKey(iso);
      if (!bucketMap.has(bk)) bucketMap.set(bk, { prod: [], paradas: [] });
      bucketMap.get(bk).paradas.push(p);
    });

    const formatBucketLabel = (key) => {
      if (granularity === "day") return formatDateBR(key).slice(0, 5);
      if (granularity === "week") return `Sem ${formatDateBR(key).slice(0, 5)}`;
      const [y, m] = key.split("-");
      const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      return `${meses[Number(m) - 1]}/${y.slice(2)}`;
    };

    const timelineOEE = Array.from(bucketMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bk, data]) => {
        const diasProd = new Set(data.prod.map((i) => getItemDateISO(i)).filter(Boolean));
        const diasParadas = new Set(data.paradas.map((i) => getItemDateISO(i)).filter(Boolean));
        const dias = new Set([...diasProd, ...diasParadas]).size || 1;
        const tt = dias * turnoMin;
        const tp = data.paradas.reduce((acc, p) => acc + getDuracaoMin(p), 0);
        const tr = Math.max(0, tt - tp);
        const disp = tt > 0 ? (tr / tt) * 100 : 0;

        let metros = 0;
        let kg = 0;
        data.prod.forEach((item) => {
          const qtd = Number(item.qtd) || 0;
          const info = getProdutoFromItem(item);
          const comp = info && info.custom ? Number(item.comp || item.compMetros || 0) : Number(info?.comp || item.comp || item.compMetros || 0);
          metros += qtd * comp;
          let peso = Number(item.pesoTotal) || 0;
          if (!peso && info) peso = info.custom ? qtd * comp * Number(info.kgMetro || 0) : qtd * Number(info.pesoUnit || 0);
          kg += peso;
        });

        const idealM = tr * velocidadeMpm;
        let perf = 0;
        if (idealM > 0 && metros > 0) perf = (metros / idealM) * 100;
        else { const idealKg = tr * capacidadeKgMin; if (idealKg > 0 && kg > 0) perf = (kg / idealKg) * 100; }

        const oee = (disp / 100) * (perf / 100) * 1 * 100;
        return {
          label: formatBucketLabel(bk),
          disponibilidade: Number(clampPercent(disp).toFixed(1)),
          performance: Number(clampPercent(perf).toFixed(1)),
          oee: Number(clampPercent(oee).toFixed(1)),
        };
      });
    const granularityLabel = granularity === "day" ? "Diária" : granularity === "week" ? "Semanal" : "Mensal";

    // ── summary cards ──
    const totalHorasParadas = perdas.reduce((acc, p) => acc + getDuracaoMin(p), 0) / 60;
    const maquinaMaisProdutiva = rankOEE.length ? rankOEE[0] : null;
    const maquinaMaisParada = [...machineKPIs].sort((a, b) => b.totalParadasMin - a.totalParadasMin)[0] || null;
    const totalProdPcs = prod.reduce((acc, i) => acc + (Number(i.qtd) || 0), 0);
    const totalProdKg = machineKPIs.reduce((acc, m) => acc + m.totalProdKg, 0);
    const mediaDisp = machineKPIs.length ? machineKPIs.reduce((acc, m) => acc + m.disponibilidade, 0) / machineKPIs.length : 0;
    const mediaOEE = machineKPIs.length ? machineKPIs.reduce((acc, m) => acc + m.oee, 0) / machineKPIs.length : 0;

    return {
      rankDisp,
      rankOEE,
      paretoGeral,
      paradasPorGrupo,
      heatmapData,
      heatmapMotivos,
      timelineOEE,
      granularityLabel,
      totalHorasParadas,
      maquinaMaisProdutiva,
      maquinaMaisParada,
      totalProdPcs,
      totalProdKg,
      mediaDisp,
      mediaOEE,
      machineKPIs,
    };
  }, [resolvedRange, historicoProducaoReal, historicoParadas, turnoHoras, capacidadeDiaria, velocidadeMpm, maquinasCatalogo]);

  if (!insights) {
    return (
      <div className="flex-1 bg-[#09090b] p-8 flex items-center justify-center text-zinc-500">
        Selecione um período válido
      </div>
    );
  }

  const {
    rankDisp, rankOEE, paretoGeral, paradasPorGrupo, heatmapData, heatmapMotivos,
    timelineOEE, granularityLabel, totalHorasParadas, maquinaMaisProdutiva, maquinaMaisParada,
    totalProdPcs, totalProdKg, mediaDisp, mediaOEE, machineKPIs,
  } = insights;

  // ── RENDER ──────────────────────────────────────
  return (
    <div className="flex-1 bg-[#09090b] p-4 md:p-8 overflow-y-auto">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
            <Zap className="text-yellow-400" size={30} />
            Insights Industriais
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Visão analítica consolidada de todas as máquinas
          </p>
        </div>
        <div className="inline-flex rounded-full bg-black/70 border border-white/10 text-[11px] overflow-hidden">
          {[
            { key: "today", label: "Hoje" },
            { key: "7d", label: "7 Dias" },
            { key: "month", label: "Mês" },
            { key: "year", label: "Ano" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 ${preset === p.key ? "bg-yellow-500 text-black font-semibold" : "text-zinc-400 hover:bg-white/5"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* CARDS RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={Clock} label="Total Horas Paradas" value={`${totalHorasParadas.toFixed(1)}h`} desc={`${(totalHorasParadas * 60).toFixed(0)} min no período`} accent="red" />
        <SummaryCard icon={Activity} label="OEE Médio Geral" value={`${mediaOEE.toFixed(1)}%`} desc={`Disp. média: ${mediaDisp.toFixed(1)}%`} accent="green" />
        <SummaryCard icon={Trophy} label="Máq. Mais Produtiva" value={maquinaMaisProdutiva ? maquinaMaisProdutiva.nome : "–"} desc={maquinaMaisProdutiva ? `OEE ${maquinaMaisProdutiva.oee.toFixed(1)}% | ${maquinaMaisProdutiva.totalProdPcs.toLocaleString("pt-BR")} pç` : ""} accent="blue" />
        <SummaryCard icon={AlertOctagon} label="Máq. Mais Parada" value={maquinaMaisParada ? maquinaMaisParada.nome : "–"} desc={maquinaMaisParada ? `${maquinaMaisParada.totalParadasMin.toFixed(0)} min parados` : ""} accent="orange" />
      </div>

      {/* SEGUNDA LINHA DE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <SummaryCard icon={BarChart3} label="Produção Total" value={`${totalProdPcs.toLocaleString("pt-BR")} pç`} desc={`${totalProdKg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg estimados`} accent="emerald" />
        <SummaryCard icon={Factory} label="Máquinas Ativas" value={`${machineKPIs.length}`} desc={`Com registros no período`} accent="purple" />
        <SummaryCard icon={Layers} label="Motivos de Parada" value={`${paretoGeral.length}`} desc={`distintos registrados`} accent="yellow" />
      </div>

      {/* RANKING DISPONIBILIDADE + RANKING OEE */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Ranking Disponibilidade */}
        <div className="bg-[#050509] border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Clock size={18} className="text-blue-400" />
            Ranking de Disponibilidade
          </h2>
          {rankDisp.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem dados no período</p>
          ) : (
            <div className="space-y-2">
              {rankDisp.map((m, idx) => (
                <RankBar key={m.token} rank={idx + 1} label={m.nome} value={m.disponibilidade} suffix="%" color={m.disponibilidade >= 85 ? "#22c55e" : m.disponibilidade >= 60 ? "#eab308" : "#ef4444"} />
              ))}
            </div>
          )}
        </div>

        {/* Ranking OEE */}
        <div className="bg-[#050509] border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Activity size={18} className="text-emerald-400" />
            Ranking de OEE
          </h2>
          {rankOEE.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem dados no período</p>
          ) : (
            <div className="space-y-2">
              {rankOEE.map((m, idx) => (
                <RankBar key={m.token} rank={idx + 1} label={m.nome} value={m.oee} suffix="%" color={m.oee >= 70 ? "#22c55e" : m.oee >= 40 ? "#eab308" : "#ef4444"} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PARETO GERAL + PARADAS POR GRUPO */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Top 10 motivos */}
        <div className="xl:col-span-2 bg-[#050509] border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <AlertOctagon size={18} className="text-red-400" />
            Top 10 Motivos de Parada (Geral)
          </h2>
          {paretoGeral.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">Sem paradas no período</div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paretoGeral} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                  <XAxis type="number" stroke="#a1a1aa" hide />
                  <YAxis type="category" dataKey="motivo" width={180} stroke="#a1a1aa" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#020617] border border-zinc-700 rounded-lg shadow-xl p-3 text-xs">
                          <div className="text-zinc-200 font-semibold mb-1">{d.motivo}</div>
                          <div className="text-red-300">{d.duracao} min ({(d.duracao / 60).toFixed(1)}h)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="duracao" radius={[0, 4, 4, 0]}>
                    {paretoGeral.map((_, idx) => (
                      <Cell key={idx} fill={idx < 3 ? "#ef4444" : "#f87171"} fillOpacity={1 - idx * 0.06} />
                    ))}
                    <LabelList dataKey="duracao" position="right" fill="#e4e4e7" fontSize={10} formatter={(v) => `${v}m`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Paradas por Categoria */}
        <div className="bg-[#050509] border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Filter size={18} className="text-purple-400" />
            Paradas por Categoria
          </h2>
          {paradasPorGrupo.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem dados</p>
          ) : (
            <div className="space-y-3 mt-2">
              {paradasPorGrupo.map((g) => {
                const totalMin = paradasPorGrupo.reduce((a, x) => a + x.duracao, 0);
                const pct = totalMin > 0 ? (g.duracao / totalMin) * 100 : 0;
                return (
                  <div key={g.grupo}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300 font-medium">{g.label}</span>
                      <span className="text-zinc-400">{g.duracao}min ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* EVOLUÇÃO TEMPORAL */}
      <div className="bg-[#050509] border border-white/10 rounded-2xl p-5 mb-8">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-emerald-400" />
          Evolução {granularityLabel}
        </h2>
        {timelineOEE.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">Sem dados suficientes</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineOEE} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={10} />
                <YAxis stroke="#a1a1aa" domain={[0, 100]} fontSize={10} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-[#020617] border border-zinc-700 rounded-lg shadow-xl p-3 text-xs min-w-[160px]">
                        <div className="text-zinc-400 mb-2 border-b border-zinc-800 pb-1">{label}</div>
                        {payload.map((p) => (
                          <div key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
                            <span>{p.name}</span>
                            <span className="font-semibold">{p.value}%</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="oee" name="OEE" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="disponibilidade" name="Disponibilidade" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="performance" name="Performance" stroke="#eab308" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* HEATMAP − MÁQUINA × MOTIVO */}
      <div className="bg-[#050509] border border-white/10 rounded-2xl p-5 mb-8 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Layers size={18} className="text-orange-400" />
          Mapa de Paradas: Máquina × Motivo
        </h2>
        {heatmapData.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem dados no período</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-zinc-400 font-semibold py-2 px-2 sticky left-0 bg-[#050509]">Máquina</th>
                {heatmapMotivos.map((m) => (
                  <th key={m} className="text-center text-zinc-400 font-semibold py-2 px-2 max-w-[120px]" title={m}>
                    {m.length > 20 ? m.slice(0, 18) + "…" : m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, idx) => (
                <tr key={idx} className="border-t border-white/5">
                  <td className="text-zinc-300 py-2 px-2 whitespace-nowrap sticky left-0 bg-[#050509]">{row.maquina}</td>
                  {heatmapMotivos.map((motivo) => {
                    const val = Math.round(row[motivo] || 0);
                    const maxVal = Math.max(...heatmapData.map((r) => r[motivo] || 0), 1);
                    const intensity = val / maxVal;
                    return (
                      <td key={motivo} className="text-center py-2 px-2">
                        <div
                          className="rounded px-2 py-1 mx-auto inline-block min-w-[40px] font-medium"
                          style={{
                            backgroundColor: val > 0 ? `rgba(239, 68, 68, ${0.15 + intensity * 0.65})` : "transparent",
                            color: val > 0 ? "#fecaca" : "#3f3f46",
                          }}
                        >
                          {val > 0 ? `${val}m` : "–"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* TABELA DETALHADA POR MÁQUINA */}
      <div className="bg-[#050509] border border-white/10 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Factory size={18} className="text-cyan-400" />
          Resumo Detalhado por Máquina
        </h2>
        {machineKPIs.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem dados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-400 uppercase text-[10px] tracking-wider">
                  <th className="text-left py-2 px-3">Máquina</th>
                  <th className="text-center py-2 px-3">Dias</th>
                  <th className="text-center py-2 px-3">Produção (pç)</th>
                  <th className="text-center py-2 px-3">Peso (kg)</th>
                  <th className="text-center py-2 px-3">Paradas (min)</th>
                  <th className="text-center py-2 px-3">Disp.</th>
                  <th className="text-center py-2 px-3">Perf.</th>
                  <th className="text-center py-2 px-3">OEE</th>
                </tr>
              </thead>
              <tbody>
                {[...machineKPIs].sort((a, b) => b.oee - a.oee).map((m) => (
                  <tr key={m.token} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="text-zinc-200 font-medium py-2 px-3 whitespace-nowrap">{m.nome}</td>
                    <td className="text-center text-zinc-400 py-2 px-3">{m.dias}</td>
                    <td className="text-center text-zinc-300 py-2 px-3">{m.totalProdPcs.toLocaleString("pt-BR")}</td>
                    <td className="text-center text-zinc-300 py-2 px-3">{m.totalProdKg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                    <td className="text-center text-zinc-300 py-2 px-3">{m.totalParadasMin.toFixed(0)}</td>
                    <td className="text-center py-2 px-3">
                      <KpiPill value={m.disponibilidade} thresholds={[85, 60]} />
                    </td>
                    <td className="text-center py-2 px-3">
                      <KpiPill value={m.performance} thresholds={[75, 50]} />
                    </td>
                    <td className="text-center py-2 px-3">
                      <KpiPill value={m.oee} thresholds={[70, 40]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── sub-components ─────────────────────────────
const SummaryCard = ({ icon: Icon, label, value, desc, accent = "green" }) => {
  const colors = {
    green: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    blue: "text-blue-400 bg-blue-500/15 border-blue-500/30",
    red: "text-red-400 bg-red-500/15 border-red-500/30",
    orange: "text-orange-400 bg-orange-500/15 border-orange-500/30",
    emerald: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    purple: "text-purple-400 bg-purple-500/15 border-purple-500/30",
    yellow: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
  };
  const c = colors[accent] || colors.green;
  return (
    <div className="bg-[#050509] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-4 shadow-[0_6px_20px_rgba(0,0,0,0.55)]">
      <div className={`p-2.5 rounded-xl border ${c}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-500 uppercase tracking-[0.18em] font-semibold">{label}</p>
        <p className="text-lg font-bold text-white leading-tight truncate">{value}</p>
        {desc && <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug truncate">{desc}</p>}
      </div>
    </div>
  );
};

const RankBar = ({ rank, label, value, suffix = "", color = "#22c55e" }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-zinc-500 font-bold w-5 text-right">{rank}º</span>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-zinc-300 truncate">{label}</span>
        <span className="text-zinc-200 font-semibold ml-2">{value.toFixed(1)}{suffix}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  </div>
);

const KpiPill = ({ value, thresholds = [70, 40] }) => {
  const color = value >= thresholds[0] ? "text-emerald-400 bg-emerald-500/10" : value >= thresholds[1] ? "text-yellow-400 bg-yellow-500/10" : "text-red-400 bg-red-500/10";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>{value.toFixed(1)}%</span>;
};
