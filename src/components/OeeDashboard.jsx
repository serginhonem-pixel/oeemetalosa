import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock,
  TrendingUp,
  AlertOctagon,
  AlertCircle,
  BarChart3,
  Filter
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LabelList,
} from "recharts";

import { CATALOGO_PRODUTOS } from "../data/catalogoProdutos";
import { CATALOGO_MAQUINAS } from "../data/catalogoMaquinas";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_VELOCIDADE_M_POR_MIN = 25;
const META_KPIS = {
  oeeGlobal: 70,
  disponibilidade: 85,
  performance: 75,
  qualidade: 99,
};
const ORIGENS_PERMITIDAS_OEE = new Set([
  "",
  "ACCESS_IMPORT",
  "ACCESS_SYNC",
]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

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
  const candidates = [
    item.data,
    item.date,
    item.dataProducao,
    item.dataApontamento,
    item.createdAt,
  ];
  for (const value of candidates) {
    const iso = normalizeISODateInput(value);
    if (ISO_DATE_RE.test(iso)) return iso;
  }
  return "";
};

const normalizeMachineToken = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();

const normalizeProductCode = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

const normalizeTextToken = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

// ---------- HELPERS ----------

const formatDateBR = (iso) => {
  if (!iso) return "-";
  const normalized = normalizeISODateInput(iso);
  if (!ISO_DATE_RE.test(normalized)) return String(iso);
  const [y, m, d] = normalized.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const clampPercent = (v) => {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
};

const clampNonNegative = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
};

const formatDelta = (value) => {
  if (!Number.isFinite(value)) return "--";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)} p.p.`;
};

const formatTrend = (value) => {
  if (!Number.isFinite(value)) return "sem base anterior";
  if (Math.abs(value) < 0.1) return "estável vs período anterior";
  return value > 0
    ? `subiu ${value.toFixed(1)} p.p. vs período anterior`
    : `caiu ${Math.abs(value).toFixed(1)} p.p. vs período anterior`;
};

const todayISO = () => new Date().toISOString().split("T")[0];

// ---------- CARDS ----------
const GaugeCard = ({ label, value, accent, helper, target, trend }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const safe = clampPercent(value);
  const offset = circumference - (safe / 100) * circumference;

  const accentMap = {
    green: "#22c55e",
    blue: "#60a5fa",
    pink: "#ec4899",
    yellow: "#eab308",
  };
  const color = accentMap[accent] || "#a855f7";

  return (
    <div className="bg-[#050509] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-4 shadow-[0_8px_25px_rgba(0,0,0,0.60)]">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          className="-rotate-90"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="#18181b"
            strokeWidth="7"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={color}
            strokeWidth="7"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-lg font-bold text-white">
            {safe.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex-1">
        <p className="text-[11px] text-zinc-400 uppercase tracking-[0.18em] font-semibold mb-1">
          {label}
        </p>
        {Number.isFinite(target) ? (
          <p className="text-[11px] text-zinc-500 leading-snug">
            Meta {target.toFixed(0)}% | Desvio {formatDelta(safe - target)}
          </p>
        ) : null}
        {trend ? (
          <p className="text-[11px] text-zinc-500 leading-snug">{trend}</p>
        ) : null}
        {helper && (
          <p className="text-[11px] text-zinc-500 leading-snug">{helper}</p>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, helper }) => (
  <div className="bg-[#050509] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-4 shadow-[0_6px_20px_rgba(0,0,0,0.55)]">
    <div className="p-2.5 rounded-xl bg-black/80 border border-white/10">
      <Icon size={18} className="text-emerald-400" />
    </div>
    <div>
      <p className="text-[11px] text-zinc-400 uppercase tracking-[0.18em] font-semibold">
        {label}
      </p>
      <p className="text-xl font-bold text-white leading-tight">{value}</p>
      {helper && (
        <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
          {helper}
        </p>
      )}
    </div>
  </div>
);

// ---------- DASHBOARD ----------
export default function OeeDashboard({
  historicoProducaoReal,
  historicoParadas,
  maquinasExtras = [],
  dataInicioInd,
  dataFimInd,
  capacidadeDiaria,
  turnoHoras,
}) {
  const [rangeStart, setRangeStart] = useState(dataInicioInd);
  const [rangeEnd, setRangeEnd] = useState(dataFimInd);
  const [rangeStartDraft, setRangeStartDraft] = useState(dataInicioInd);
  const [rangeEndDraft, setRangeEndDraft] = useState(dataFimInd);
  const lastValidStartRef = useRef(normalizeISODateInput(dataInicioInd || todayISO()));
  const lastValidEndRef = useRef(normalizeISODateInput(dataFimInd || todayISO()));
  const [selectedDayISO, setSelectedDayISO] = useState("");
  const lastRangeStartRef = useRef(dataInicioInd || todayISO());
  const lastRangeEndRef = useRef(dataFimInd || todayISO());
  const [metricMode, setMetricMode] = useState("pieces"); // 'pieces' | 'weight'
  const [preset, setPreset] = useState("custom"); 
  const [velocidadeMpm, setVelocidadeMpm] = useState(
    DEFAULT_VELOCIDADE_M_POR_MIN
  );
  const [velocidadeDraft, setVelocidadeDraft] = useState(
    String(DEFAULT_VELOCIDADE_M_POR_MIN)
  );
  
  // NOVO: Estado para filtro de mÃ¡quina
  const [maquinaId, setMaquinaId] = useState(""); 

  // sincroniza com filtros externos
  useEffect(() => {
    setRangeStart(dataInicioInd);
    setRangeEnd(dataFimInd);
    setRangeStartDraft(formatDateBR(dataInicioInd || ""));
    setRangeEndDraft(formatDateBR(dataFimInd || ""));
    setSelectedDayISO("");
    lastRangeStartRef.current = dataInicioInd || todayISO();
    lastRangeEndRef.current = dataFimInd || todayISO();
    if (ISO_DATE_RE.test(normalizeISODateInput(dataInicioInd || ""))) {
      lastValidStartRef.current = normalizeISODateInput(dataInicioInd);
    }
    if (ISO_DATE_RE.test(normalizeISODateInput(dataFimInd || ""))) {
      lastValidEndRef.current = normalizeISODateInput(dataFimInd);
    }
    setPreset("custom");
  }, [dataInicioInd, dataFimInd]);

  useEffect(() => {
    const nextStart = normalizeISODateInput(rangeStartDraft);
    const nextEnd = normalizeISODateInput(rangeEndDraft);
    if (
      (nextStart && !ISO_DATE_RE.test(nextStart)) ||
      (nextEnd && !ISO_DATE_RE.test(nextEnd))
    ) {
      return;
    }
    const id = setTimeout(() => {
      setRangeStart(nextStart);
      setRangeEnd(nextEnd);
      if (!selectedDayISO) {
        lastRangeStartRef.current = nextStart || todayISO();
        lastRangeEndRef.current = nextEnd || todayISO();
      }
    }, 250);
    return () => clearTimeout(id);
  }, [rangeStartDraft, rangeEndDraft]);

  // Lista de mÃ¡quinas ativas
  const maquinasCatalogo = useMemo(() => {
    const base = CATALOGO_MAQUINAS.filter((m) => m.ativo);
    const extras = (Array.isArray(maquinasExtras) ? maquinasExtras : []).map((m, idx) => {
      const nome = String(
        m?.nomeExibicao || m?.nome || m?.maquina || m?.maquinaNome || ""
      ).trim();
      const id = String(m?.maquinaId || m?.id || nome || `EXTRA_${idx + 1}`).trim();
      return {
        maquinaId: id,
        nomeExibicao: nome || id,
        ativo: true,
      };
    });

    const byKey = new Map();
    [...base, ...extras].forEach((m) => {
      const id = String(m?.maquinaId || m?.id || "").trim();
      const nome = String(m?.nomeExibicao || m?.nome || "").trim();
      const key = normalizeMachineToken(id || nome);
      if (!key) return;
      if (!byKey.has(key)) {
        byKey.set(key, {
          maquinaId: id || nome,
          nomeExibicao: nome || id,
          ativo: true,
        });
      }
    });

    return Array.from(byKey.values());
  }, [maquinasExtras]);

  const maquinasDisponiveis = useMemo(
    () =>
      maquinasCatalogo
        .map((m) => {
          const id = String(m.maquinaId || m.id || m.nomeExibicao || "").trim();
          if (!id) return null;
          return {
            id,
            nomeExibicao: String(m.nomeExibicao || id),
          };
        })
        .filter(Boolean)
        .sort((a, b) =>
          String(a.nomeExibicao).localeCompare(String(b.nomeExibicao), "pt-BR")
        ),
    [maquinasCatalogo]
  );

  const applyVelocidade = () => {
    const parsed = Number(velocidadeDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setVelocidadeMpm(parsed);
  };

  const handleSelectDay = (entry) => {
    const iso = entry?.date;
    if (!ISO_DATE_RE.test(String(iso || ""))) return;

    if (selectedDayISO === iso) {
      const restoreStart = lastRangeStartRef.current || todayISO();
      const restoreEnd = lastRangeEndRef.current || todayISO();
      setRangeStart(restoreStart);
      setRangeEnd(restoreEnd);
      setRangeStartDraft(formatDateBR(restoreStart));
      setRangeEndDraft(formatDateBR(restoreEnd));
      setSelectedDayISO("");
      return;
    }

    if (!selectedDayISO) {
      lastRangeStartRef.current = rangeStart || todayISO();
      lastRangeEndRef.current = rangeEnd || todayISO();
    }

    setSelectedDayISO(iso);
    setRangeStart(iso);
    setRangeEnd(iso);
    setRangeStartDraft(formatDateBR(iso));
    setRangeEndDraft(formatDateBR(iso));
  };

  const handlePreset = (type) => {
    const hoje = new Date();
    let start, end;

    if (type === "today") {
      start = hoje;
      end = hoje;
    } else if (type === "7d") {
      end = hoje;
      start = new Date(hoje.getTime() - 6 * MS_PER_DAY);
    } else if (type === "month") {
      end = hoje;
      start = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    } else if (type === "year") {
      end = hoje;
      start = new Date(hoje.getFullYear(), 0, 1);
    } else {
      setPreset("custom");
      return;
    }

    setPreset(type);
    const startISO = start.toISOString().split("T")[0];
    const endISO = end.toISOString().split("T")[0];
    setRangeStart(startISO);
    setRangeEnd(endISO);
    setRangeStartDraft(startISO);
    setRangeEndDraft(endISO);
  };

  const {
    diasNoPeriodo,
    oeeGlobal,
    disponibilidade,
    performance,
    qualidade,
    tempoTotalTurnoMin,
    tempoParadoMin,
    tempoRodandoMin,
    producaoTotalPcs,
    producaoTotalKg,
    dailyProductionData,
    paretoParadasData,
    previousSnapshot,
    principalParada,
    coberturaParetoTop2,
    ganhoPotencialKg,
  } = useMemo(() => {
    let startISO = normalizeISODateInput(
      rangeStart || dataInicioInd || todayISO()
    );
    let endISO = normalizeISODateInput(rangeEnd || dataFimInd || todayISO());

    if (ISO_DATE_RE.test(startISO) && ISO_DATE_RE.test(endISO) && startISO > endISO) {
      const tmp = startISO;
      startISO = endISO;
      endISO = tmp;
    }

    const startDate = parseISODate(startISO);
    const endDate = parseISODate(endISO);
    if (!startDate || !endDate) {
      return {
        diasNoPeriodo: 0,
        oeeGlobal: 0,
        disponibilidade: 0,
        performance: 0,
        qualidade: 0,
        tempoTotalTurnoMin: 0,
        tempoParadoMin: 0,
        tempoRodandoMin: 0,
        producaoTotalPcs: 0,
        producaoTotalKg: 0,
        dailyProductionData: [],
        paretoParadasData: [],
        previousSnapshot: null,
        principalParada: null,
        coberturaParetoTop2: 0,
        ganhoPotencialKg: 0,
      };
    }

    const maquinaSelecionadaObj = maquinaId
      ? maquinasDisponiveis.find(
          (m) =>
            m.id === maquinaId ||
            m.maquinaId === maquinaId ||
            m.id === maquinaId ||
            m.nomeExibicao === maquinaId
        )
      : null;
    const nomeSelecionado = maquinaSelecionadaObj?.nomeExibicao || "";
    const turnoMin = (Number(turnoHoras) || 0) * 60;
    const capacidadeKgDia = Number(capacidadeDiaria) || 0;
    const capacidadeKgMin = turnoMin > 0 ? capacidadeKgDia / turnoMin : 0;
    const produtoByCode = new Map(
      (Array.isArray(CATALOGO_PRODUTOS) ? CATALOGO_PRODUTOS : []).map((p) => [
        normalizeProductCode(p?.cod),
        p,
      ])
    );
    const produtoByDesc = new Map(
      (Array.isArray(CATALOGO_PRODUTOS) ? CATALOGO_PRODUTOS : []).map((p) => [
        normalizeTextToken(p?.desc),
        p,
      ])
    );
    const getProdutoInfo = (cod) => produtoByCode.get(normalizeProductCode(cod));
    const getProdutoFromItem = (item) => {
      const codeCandidates = [
        item?.cod,
        item?.codigo,
        item?.CODIGO,
        item?.codProduto,
        item?.produtoCodigo,
      ];
      for (const code of codeCandidates) {
        const foundByCode = getProdutoInfo(code);
        if (foundByCode) return foundByCode;
      }
      const descCandidates = [item?.desc, item?.descricao, item?.DESCRICAO];
      for (const desc of descCandidates) {
        const foundByDesc = produtoByDesc.get(normalizeTextToken(desc));
        if (foundByDesc) return foundByDesc;
      }
      return null;
    };
    const calcPerformancePercent = (metros, kg, tempoMin) => {
      const idealMetros = tempoMin * velocidadeMpm;
      if (idealMetros > 0 && metros > 0) {
        return (metros / idealMetros) * 100;
      }
      const idealKg = tempoMin * capacidadeKgMin;
      if (idealKg > 0 && kg > 0) {
        return (kg / idealKg) * 100;
      }
      return 0;
    };

    // --- FUNÃ‡ÃƒO DE FILTRO CENTRALIZADA (CORRIGIDA) ---
    const filterData = (
      item,
      rangeStartFilter = startISO,
      rangeEndFilter = endISO,
      options = {}
    ) => {
        const { ignoreOriginExclusion = false } = options;
        // 1. Filtro de Data
        const itemISO = getItemDateISO(item);
        if (!itemISO) return false;
        const dataOk =
          ISO_DATE_RE.test(itemISO) && itemISO >= rangeStartFilter && itemISO <= rangeEndFilter;
        
        // 2. Filtro de MÃ¡quina (aceita id ou nome)
        const machineCandidates = [
          item.maquinaId,
          item.maquinaid,
          item.maquina,
          item.maquinaNome,
          item.maquinaExibicao,
          item.nomeMaquina,
          item.equipamento,
          item.eqp,
        ];
        const machineTokens = machineCandidates
          .map((value) => normalizeMachineToken(value))
          .filter(Boolean);
        const tokenSelecionado = normalizeMachineToken(maquinaId);
        const tokenNomeSelecionado = normalizeMachineToken(nomeSelecionado);
        const selectedTokens = [tokenSelecionado, tokenNomeSelecionado].filter(Boolean);

        const maquinaOk =
          !maquinaId ||
          selectedTokens.some((tkSel) => machineTokens.some((tkReg) => tkReg === tkSel));

        const isProducao =
          "cod" in item || "qtd" in item || "pesoTotal" in item || "pesoPorPeca" in item;
        const origem = String(item.origem || "").toUpperCase();
        const origemOk =
          ignoreOriginExclusion ||
          !isProducao ||
          ORIGENS_PERMITIDAS_OEE.has(origem);

        return dataOk && maquinaOk && origemOk;
    };

    const prodFiltradaPrincipal = Array.isArray(historicoProducaoReal)
      ? historicoProducaoReal.filter(filterData)
      : [];
    const prodFiltradaComOrigens = Array.isArray(historicoProducaoReal)
      ? historicoProducaoReal.filter((item) =>
          filterData(item, startISO, endISO, { ignoreOriginExclusion: true })
        )
      : [];
    const prodFiltrada =
      prodFiltradaPrincipal.length > 0 ? prodFiltradaPrincipal : prodFiltradaComOrigens;

    const prodDiasSet = new Set(
      prodFiltrada
        .map((item) => getItemDateISO(item))
        .filter((iso) => ISO_DATE_RE.test(iso))
    );

    const diasContados = new Set();
    if (endDate >= startDate) {
      for (
        let dt = new Date(startDate);
        dt <= endDate;
        dt = new Date(dt.getTime() + MS_PER_DAY)
      ) {
        const iso = dt.toISOString().split("T")[0];
        const day = dt.getDay();
        const isWeekend = day === 0 || day === 6;
        if (!isWeekend || prodDiasSet.has(iso)) {
          diasContados.add(iso);
        }
      }
    }

    const paradasFiltradas = Array.isArray(historicoParadas)
      ? historicoParadas.filter(filterData)
      : [];

    // --- CÃLCULO DE PARADAS ---
    // Filtra apenas perdas reais (exclui TU001 que é produção)
    const isPerdaReal = (p) => {
      const codMotivo = String(p.codMotivo || p.motivoCodigo || "")
        .trim()
        .toUpperCase();
      return codMotivo !== "TU001";
    };
    const perdasDeDisponibilidade = paradasFiltradas.filter(isPerdaReal);

    const getDuracaoMin = (p) => {
      const parseMinutes = (value) => {
        if (value == null) return 0;
        if (typeof value === "number" && Number.isFinite(value)) return value;
        const raw = String(value).trim().replace(",", ".");
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

      const inicio = p.horaInicio || p.inicio;
      const fim = p.horaFim || p.fim;
      const diff = paraMin(fim) - paraMin(inicio);
      return diff > 0 ? diff : 0;
    };

    const perdasBase = perdasDeDisponibilidade.length
      ? perdasDeDisponibilidade
      : (Array.isArray(historicoParadas)
          ? historicoParadas.filter((item) =>
              filterData(item, startISO, endISO, { ignoreOriginExclusion: true })
            )
          : []
        ).filter(isPerdaReal);

    const summarizePeriod = (snapshotStartISO, snapshotEndISO) => {
      const snapshotStart = parseISODate(snapshotStartISO);
      const snapshotEnd = parseISODate(snapshotEndISO);
      if (!snapshotStart || !snapshotEnd) return null;

      const prodPrincipal = Array.isArray(historicoProducaoReal)
        ? historicoProducaoReal.filter((item) =>
            filterData(item, snapshotStartISO, snapshotEndISO)
          )
        : [];
      const prodComOrigens = Array.isArray(historicoProducaoReal)
        ? historicoProducaoReal.filter((item) =>
            filterData(item, snapshotStartISO, snapshotEndISO, {
              ignoreOriginExclusion: true,
            })
          )
        : [];
      const prod = prodPrincipal.length > 0 ? prodPrincipal : prodComOrigens;

      const prodDays = new Set(
        prod
          .map((item) => getItemDateISO(item))
          .filter((iso) => ISO_DATE_RE.test(iso))
      );

      const diasContadosSnapshot = new Set();
      if (snapshotEnd >= snapshotStart) {
        for (
          let dt = new Date(snapshotStart);
          dt <= snapshotEnd;
          dt = new Date(dt.getTime() + MS_PER_DAY)
        ) {
          const iso = dt.toISOString().split("T")[0];
          const day = dt.getDay();
          const isWeekend = day === 0 || day === 6;
          if (!isWeekend || prodDays.has(iso)) {
            diasContadosSnapshot.add(iso);
          }
        }
      }

      const paradas = Array.isArray(historicoParadas)
        ? historicoParadas.filter((item) =>
            filterData(item, snapshotStartISO, snapshotEndISO)
          )
        : [];

      const perdas = paradas.filter((p) => {
        const codMotivo = String(p.codMotivo || p.motivoCodigo || "").toUpperCase();
        return codMotivo !== "TU001";
      });

      const paradasPorDiaSnapshot = new Map();
      perdas.forEach((p) => {
        const iso = getItemDateISO(p);
        if (!ISO_DATE_RE.test(iso)) return;
        paradasPorDiaSnapshot.set(
          iso,
          (paradasPorDiaSnapshot.get(iso) || 0) + getDuracaoMin(p)
        );
      });

      const diasNoPeriodoSnapshot = new Set([
        ...prodDays,
        ...paradasPorDiaSnapshot.keys(),
      ]).size;
      const tempoTotalTurnoSnapshot = diasNoPeriodoSnapshot * turnoMin;
      const tempoParadoSnapshot = perdas.reduce(
        (acc, p) => acc + getDuracaoMin(p),
        0
      );
      const tempoRodandoSnapshot = Math.max(
        0,
        tempoTotalTurnoSnapshot - tempoParadoSnapshot
      );
      const disponibilidadeSnapshot =
        tempoTotalTurnoSnapshot > 0
          ? (tempoRodandoSnapshot / tempoTotalTurnoSnapshot) * 100
          : 0;

      let producaoTotalMetrosSnapshot = 0;
      let producaoTotalKgSnapshot = 0;
      prod.forEach((item) => {
        const qtd = clampNonNegative(Number(item.qtd) || 0);
        const prodInfo = getProdutoFromItem(item);
        const compRegistro = Number(item.comp || item.compMetros || 0);
        const compCatalogo = Number(prodInfo?.comp || 0);
        const comp =
          clampNonNegative(
            prodInfo && prodInfo.custom ? compRegistro : compCatalogo || compRegistro
          );
        producaoTotalMetrosSnapshot += qtd * comp;

        let peso = clampNonNegative(Number(item.pesoTotal) || 0);
        if (!peso && prodInfo) {
          if (prodInfo.custom) {
            const kgMetro = clampNonNegative(Number(prodInfo.kgMetro || 0));
            peso = qtd * comp * kgMetro;
          } else {
            peso = qtd * clampNonNegative(Number(prodInfo.pesoUnit || 0));
          }
        }
        producaoTotalKgSnapshot += peso;
      });

      const performanceSnapshot = calcPerformancePercent(
        producaoTotalMetrosSnapshot,
        producaoTotalKgSnapshot,
        tempoRodandoSnapshot
      );
      const qualidadeSnapshot = 100;
      const oeeSnapshot =
        (disponibilidadeSnapshot / 100) *
        (performanceSnapshot / 100) *
        (qualidadeSnapshot / 100) *
        100;

      return {
        oeeGlobal: oeeSnapshot,
        disponibilidade: disponibilidadeSnapshot,
        performance: performanceSnapshot,
        qualidade: qualidadeSnapshot,
        producaoTotalKg: producaoTotalKgSnapshot,
      };
    };

    const paradasPorDia = new Map();
    perdasBase.forEach((p) => {
      const iso = getItemDateISO(p);
      if (!ISO_DATE_RE.test(iso)) return;
      paradasPorDia.set(iso, (paradasPorDia.get(iso) || 0) + getDuracaoMin(p));
    });

    const diasNoPeriodo = new Set([...prodDiasSet, ...paradasPorDia.keys()]).size;
    const tempoTotalTurnoMin = diasNoPeriodo * (Number(turnoHoras) || 0) * 60;

    const tempoParadoMin = perdasBase.reduce(
      (acc, p) => acc + getDuracaoMin(p),
      0
    );

    const tempoRodandoMin = Math.max(0, tempoTotalTurnoMin - tempoParadoMin);
    const disponibilidade =
      tempoTotalTurnoMin > 0
        ? (tempoRodandoMin / tempoTotalTurnoMin) * 100
        : 0;
            
    // --- CÃLCULO DE PRODUÃ‡ÃƒO ---
    let producaoTotalPcs = 0;
    let producaoTotalKg = 0;
    let producaoTotalMetros = 0;
    const dailyMap = {};

    if (endDate >= startDate) {
      for (
        let dt = new Date(startDate);
        dt <= endDate;
        dt = new Date(dt.getTime() + MS_PER_DAY)
      ) {
        const iso = dt.toISOString().split("T")[0];
        dailyMap[iso] = {
          date: iso,
          pieces: 0,
          weightKg: 0,
          meters: 0,
          paradasMin: paradasPorDia.get(iso) || 0,
          counted: diasContados.has(iso),
          turnoMin,
        };
      }
    }

    prodFiltrada.forEach((item) => {
      const iso = getItemDateISO(item);
      const qtd = clampNonNegative(Number(item.qtd) || 0);
      const prodInfo = getProdutoFromItem(item);
      const compRegistro = Number(item.comp || item.compMetros || 0);
      const compCatalogo = Number(prodInfo?.comp || 0);
      const comp =
        clampNonNegative(
          prodInfo && prodInfo.custom ? compRegistro : compCatalogo || compRegistro
        );

      producaoTotalPcs += qtd;
      producaoTotalMetros += qtd * comp;

      // Usa peso jÃ¡ salvo no registro; se nÃ£o houver, calcula a partir do catÃ¡logo
      let peso = clampNonNegative(Number(item.pesoTotal) || 0);
      if (!peso) {
        if (prodInfo) {
          if (prodInfo.custom) {
            const kgMetro = clampNonNegative(Number(prodInfo.kgMetro || 0));
            peso = qtd * comp * kgMetro;
          } else {
            peso = qtd * clampNonNegative(Number(prodInfo.pesoUnit || 0));
          }
        }
      }

      producaoTotalKg += peso;

      if (dailyMap[iso]) {
        dailyMap[iso].pieces += qtd;
        dailyMap[iso].weightKg += peso;
        dailyMap[iso].meters += qtd * comp;
      }
    });

    const dailyProductionData = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        label: formatDateBR(d.date).slice(0, 5),
        disponibilidadeDia:
          d.counted && d.turnoMin > 0
            ? ((Math.max(0, d.turnoMin - d.paradasMin) / d.turnoMin) * 100)
            : 0,
        performanceDia:
          d.counted && Math.max(0, d.turnoMin - d.paradasMin) > 0
            ? (d.meters / (Math.max(0, d.turnoMin - d.paradasMin) * velocidadeMpm)) * 100
            : 0,
        qualidadeDia: 100,
        weightKg: Number(d.weightKg.toFixed(1)),
      }));

    // --- PARETO (TOP 5) ---
    const motivosMap = {};
    const perdasParaPareto = perdasBase;

    perdasParaPareto.forEach((p) => {
      const key = p.descMotivo || p.descNorm || "Motivo não informado";
      const dur = getDuracaoMin(p);
      motivosMap[key] = (motivosMap[key] || 0) + dur;
    });

    const paretoParadasData = Object.entries(motivosMap)
      .map(([motivo, duracao]) => ({ motivo, duracao }))
      .sort((a, b) => b.duracao - a.duracao)
      .slice(0, 5);

    // OEE
    const diasPerformance = new Set([...prodDiasSet, ...paradasPorDia.keys()]);
    const tempoTotalTurnoMinPerf = diasPerformance.size * turnoMin;
    const tempoParadoMinPerf = Array.from(diasPerformance).reduce(
      (acc, iso) => acc + (paradasPorDia.get(iso) || 0),
      0
    );
    const tempoRodandoMinPerf = Math.max(0, tempoTotalTurnoMinPerf - tempoParadoMinPerf);
    const performance = calcPerformancePercent(
      producaoTotalMetros,
      producaoTotalKg,
      tempoRodandoMinPerf
    );
    const qualidade = 100;
    const oeeGlobal =
      (disponibilidade / 100) * (performance / 100) * (qualidade / 100) * 100;

    const diasSpan = Math.max(
      1,
      Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1
    );
    const prevEndDate = new Date(startDate.getTime() - MS_PER_DAY);
    const prevStartDate = new Date(prevEndDate.getTime() - (diasSpan - 1) * MS_PER_DAY);
    const prevStartISO = normalizeISODateInput(prevStartDate);
    const prevEndISO = normalizeISODateInput(prevEndDate);
    const previousSnapshot = summarizePeriod(prevStartISO, prevEndISO);

    const totalParetoMin = paretoParadasData.reduce(
      (acc, item) => acc + Number(item.duracao || 0),
      0
    );
    const principalParada = paretoParadasData.length ? paretoParadasData[0] : null;
    const coberturaParetoTop2 =
      totalParetoMin > 0
        ? ((Number(paretoParadasData[0]?.duracao || 0) +
            Number(paretoParadasData[1]?.duracao || 0)) /
            totalParetoMin) *
          100
        : 0;
    const ganhoPotencialKg =
      performance > 0
        ? Math.max(0, ((40 / performance) - 1) * producaoTotalKg)
        : 0;

    return {
      diasNoPeriodo,
      oeeGlobal,
      disponibilidade,
      performance,
      qualidade,
      tempoTotalTurnoMin,
      tempoParadoMin,
      tempoRodandoMin,
      producaoTotalPcs,
      producaoTotalKg,
      dailyProductionData,
      paretoParadasData,
      previousSnapshot,
      principalParada,
      coberturaParetoTop2,
      ganhoPotencialKg,
    };
  }, [
    rangeStart,
    rangeEnd,
    dataInicioInd,
    dataFimInd,
    historicoProducaoReal,
    historicoParadas,
    capacidadeDiaria,
    turnoHoras,
    velocidadeMpm,
    maquinaId, // IMPORTANTE: Recalcula tudo quando troca a mÃ¡quina
    maquinasDisponiveis
  ]);

  const metricLabel =
    metricMode === "pieces" ? "Peças produzidas" : "Peso produzido (kg)";
  const metricKey = metricMode === "pieces" ? "pieces" : "weightKg";
  const deltaOee = oeeGlobal - Number(previousSnapshot?.oeeGlobal || 0);
  const deltaDisp = disponibilidade - Number(previousSnapshot?.disponibilidade || 0);
  const deltaPerf = performance - Number(previousSnapshot?.performance || 0);
  const deltaQual = qualidade - Number(previousSnapshot?.qualidade || 0);

  // --- LABEL CUSTOMIZADO (BARRAS) ---
  const renderProdLabel = (props) => {
    const { x, y, width, height, value, payload } = props;
    if (!value) return null;
    const display = value.toLocaleString("pt-BR");
    const isSelected =
      selectedDayISO &&
      payload?.date &&
      normalizeISODateInput(payload.date) === selectedDayISO;
    const labelY = isSelected ? y + height / 2 + 4 : y - 4;
    const labelFill = isSelected ? "#0f172a" : "#e4e4e7";
    return (
      <text
        x={x + width / 2}
        y={labelY}
        textAnchor="middle"
        fill={labelFill}
        fontSize={10}
        fontWeight={isSelected ? 800 : 400}
      >
        {display}
      </text>
    );
  };

  // --- LABEL CUSTOMIZADO (PARETO) ---
  const renderParetoLabel = (props) => {
    const { x, y, width, height, value } = props;
    if (!value) return null;
    return (
      <text
        x={x + width + 5} 
        y={y + height / 2 + 3}
        textAnchor="start"
        fill="#e4e4e7"
        fontSize={10}
        fontWeight="bold"
      >
        {`${value}m`}
      </text>
    );
  };

  return (
    <div className="flex-1 bg-[#09090b] p-8 overflow-y-auto">
      {/* HEADER */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        
        {/* TITULO + SELETOR MÃQUINA (JUNTOS) */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
                    <Activity className="text-emerald-500" size={30} />
                    Dashboard OEE
                </h1>
                <p className="text-xs text-zinc-500 mt-1">
                    Análise de performance industrial
                </p>
            </div>

            {/* SELETOR DE MÃQUINA (Aqui do lado, como pediu) */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg">
                <Filter size={14} className="text-blue-400" />
                <select 
                    value={maquinaId}
                    onChange={(e) => setMaquinaId(e.target.value)}
                    className="bg-transparent text-white text-sm font-medium outline-none cursor-pointer min-w-[140px]"
                >
                    <option value="" className="bg-zinc-900">Todas as Máquinas</option>
                    {maquinasDisponiveis.map(m => {
                        const val = m.maquinaId || m.id || m.nomeExibicao;
                        return (
                          <option key={val} value={val} className="bg-zinc-900">
                              {m.nomeExibicao}
                          </option>
                        );
                    })}
                </select>
            </div>
        </div>

        {/* CONTROLES DE DATA (DIREITA) */}
        <div className="flex flex-col gap-3 items-stretch md:items-end">
          
          {/* BOTÃ•ES DE ATALHO (PRESETS) - MANTIDOS */}
          <div className="inline-flex rounded-full bg-black/70 border border-white/10 text-[11px] overflow-hidden self-end">
            <button
              onClick={() => handlePreset("today")}
              className={`px-3 py-1.5 ${
                preset === "today"
                  ? "bg-emerald-500 text-black font-semibold"
                  : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => handlePreset("7d")}
              className={`px-3 py-1.5 ${
                preset === "7d"
                  ? "bg-emerald-500 text-black font-semibold"
                  : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              7 Dias
            </button>
            <button
              onClick={() => handlePreset("month")}
              className={`px-3 py-1.5 ${
                preset === "month"
                  ? "bg-emerald-500 text-black font-semibold"
                  : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => handlePreset("year")}
              className={`px-3 py-1.5 ${
                preset === "year"
                  ? "bg-emerald-500 text-black font-semibold"
                  : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              Ano
            </button>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg self-end">
            <span className="text-[10px] text-zinc-400 uppercase tracking-[0.18em] font-semibold">
              Velocidade
            </span>
            <input
              type="number"
              min="1"
              step="0.1"
              value={velocidadeDraft}
              onChange={(e) => setVelocidadeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyVelocidade();
              }}
              className="w-16 bg-transparent text-white text-sm font-medium outline-none text-right"
            />
            <span className="text-zinc-500 text-[11px]">m/min</span>
            <button
              onClick={applyVelocidade}
              className="px-2 py-1 text-[10px] rounded bg-emerald-500 text-black font-semibold hover:bg-emerald-400"
            >
              Aplicar
            </button>
          </div>

          {/* INPUTS DE DATA (VISUAL MELHORADO) */}
          <div className="flex items-center gap-3 bg-zinc-900 px-4 py-2 rounded-2xl border border-white/10 text-xs shadow-sm">
            <CalendarDays className="text-zinc-400" size={16} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.16em]">
                Período Selecionado
              </span>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  inputMode="text"
                  placeholder="DD/MM/AAAA"
                  value={rangeStartDraft || ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRangeStartDraft(next);
                    if (ISO_DATE_RE.test(next)) {
                      lastValidStartRef.current = next;
                    }
                    setPreset("custom");
                  }}
                  onBlur={() => {
                    const normalized = normalizeISODateInput(rangeStartDraft);
                    if (!ISO_DATE_RE.test(normalized)) {
                      const fallback = lastValidStartRef.current || "";
                      setRangeStartDraft(formatDateBR(fallback));
                    } else {
                      lastValidStartRef.current = normalized;
                      setRangeStartDraft(formatDateBR(normalized));
                    }
                  }}
                  className="bg-transparent border border-zinc-700 hover:border-zinc-500 rounded px-2 py-1 text-xs text-white outline-none transition-colors"
                />
                <span className="text-zinc-500 text-[10px]">até</span>
                <input
                  type="text"
                  inputMode="text"
                  placeholder="DD/MM/AAAA"
                  value={rangeEndDraft || ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRangeEndDraft(next);
                    if (ISO_DATE_RE.test(next)) {
                      lastValidEndRef.current = next;
                    }
                    setPreset("custom");
                  }}
                  onBlur={() => {
                    const normalized = normalizeISODateInput(rangeEndDraft);
                    if (!ISO_DATE_RE.test(normalized)) {
                      const fallback = lastValidEndRef.current || "";
                      setRangeEndDraft(formatDateBR(fallback));
                    } else {
                      lastValidEndRef.current = normalized;
                      setRangeEndDraft(formatDateBR(normalized));
                    }
                  }}
                  className="bg-transparent border border-zinc-700 hover:border-zinc-500 rounded px-2 py-1 text-xs text-white outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* GAUGES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <GaugeCard
          label="OEE Global"
          value={oeeGlobal}
          accent="green"
          target={META_KPIS.oeeGlobal}
          trend={formatTrend(deltaOee)}
          helper="Reflete disponibilidade real"
        />
        <GaugeCard
          label="Disponibilidade"
          value={disponibilidade}
          accent="blue"
          target={META_KPIS.disponibilidade}
          trend={formatTrend(deltaDisp)}
          helper={`${tempoRodandoMin.toFixed(0)} min produzindo`}
        />
        <GaugeCard
          label="Performance"
          value={performance}
          accent="yellow"
          target={META_KPIS.performance}
          trend={formatTrend(deltaPerf)}
          helper={`Base ${velocidadeMpm} m/min`}
        />
        <GaugeCard
          label="Qualidade"
          value={qualidade}
          accent="pink"
          target={META_KPIS.qualidade}
          trend={formatTrend(deltaQual)}
          helper="Sem refugo"
        />
      </div>

      {/* RESUMO NUMÃ‰RICO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
        <StatCard
          icon={BarChart3}
          label="Produção (período)"
          value={`${producaoTotalPcs.toLocaleString("pt-BR")} un.`}
          helper={
            producaoTotalKg > 0
              ? `${producaoTotalKg.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })} kg estimados`
              : "Peso estimado n/d"
          }
        />
        <StatCard
          icon={AlertOctagon}
          label="Tempo parado"
          value={`${tempoParadoMin.toFixed(0)} min`}
          helper={`Exclui horário de almoço/produção`}
        />
        <StatCard
          icon={Clock}
          label="Tempo total de turno"
          value={`${tempoTotalTurnoMin.toFixed(0)} min`}
          helper={`${turnoHoras}h × ${diasNoPeriodo || 0} dia(s)`}
        />
      </div>

      {/* OBSERVAÃ‡ÃƒO */}
      <div className="flex items-start gap-2 text-[11px] text-zinc-500 mb-6">
        <AlertCircle size={14} className="mt-[2px] text-yellow-400" />
        <p>
          <span className="font-semibold text-emerald-400">Nota:</span> Ao filtrar por máquina, a produção pode aparecer zerada se os registros antigos não tiverem o campo de máquina preenchido.
        </p>
      </div>

      {/* GRÃFICOS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* PRODUÃ‡ÃƒO DIÃRIA */}
        <div className="xl:col-span-2 bg-[#050509] border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" />
                Produção diária
              </h2>
            </div>
            {selectedDayISO ? (
              <button
                type="button"
                onClick={() => handleSelectDay({ date: selectedDayISO })}
                className="text-[11px] px-2 py-1 rounded-full border border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                title="Limpar filtro do dia"
              >
                Dia {formatDateBR(selectedDayISO)}
              </button>
            ) : null}
            <div className="inline-flex rounded-full bg-black/70 border border-white/10 text-[11px] overflow-hidden">
              <button
                onClick={() => setMetricMode("pieces")}
                className={`px-3 py-1.5 ${
                  metricMode === "pieces"
                    ? "bg-emerald-500 text-black font-semibold"
                    : "text-zinc-400 hover:bg-white/5"
                }`}
              >
                Peças
              </button>
              <button
                onClick={() => setMetricMode("weight")}
                className={`px-3 py-1.5 ${
                  metricMode === "weight"
                    ? "bg-emerald-500 text-black font-semibold"
                    : "text-zinc-400 hover:bg-white/5"
                }`}
              >
                Peso (kg)
              </button>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
              <BarChart data={dailyProductionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const point = payload[0]?.payload || {};
                    const pesoText = `${Number(point.weightKg || 0).toLocaleString("pt-BR")} kg`;
                    const pecasText = `${Number(point.pieces || 0).toLocaleString("pt-BR")} un.`;
                    const destaqueLabel = metricMode === "pieces" ? "Peças produzidas" : "Peso produzido";
                    const destaqueValue = metricMode === "pieces" ? pecasText : pesoText;

                    return (
                      <div className="bg-[#020617] border border-zinc-700 rounded-lg shadow-xl p-3 min-w-[220px]">
                        <div className="text-[11px] text-zinc-400 mb-2 border-b border-zinc-800 pb-1">
                          {label}
                        </div>
                        <div className="text-sm text-zinc-200 font-semibold mb-2">
                          {destaqueLabel}: <span className="text-emerald-300">{destaqueValue}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mb-2">
                          {metricMode === "pieces" ? "Peso" : "Peças"}:{" "}
                          <span className="text-emerald-300">
                            {metricMode === "pieces" ? pesoText : pecasText}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
                          <div>
                            <div className="uppercase text-[10px] text-zinc-500">Perf</div>
                            <div className="text-emerald-300 font-semibold">
                              {Number(payload[0]?.payload?.performanceDia || 0).toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="uppercase text-[10px] text-zinc-500">Disp</div>
                            <div className="text-sky-300 font-semibold">
                              {Number(payload[0]?.payload?.disponibilidadeDia || 0).toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="uppercase text-[10px] text-zinc-500">Qual</div>
                            <div className="text-pink-300 font-semibold">
                              {Number(payload[0]?.payload?.qualidadeDia || 0).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar
                  dataKey={metricKey}
                  name={metricLabel}
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  onClick={(data) => handleSelectDay(data?.payload)}
                >
                  {dailyProductionData.map((entry) => (
                    <Cell
                      key={`cell-${entry.date}`}
                      fill="#22c55e"
                      fillOpacity={
                        selectedDayISO && entry.date !== selectedDayISO ? 0.35 : 1
                      }
                    />
                  ))}
                  <LabelList content={renderProdLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PARETO DE PARADAS (TOP 5) */}
        <div className="bg-[#050509] border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <AlertOctagon size={18} className="text-red-400" />
            Top 5 motivos de parada
          </h2>
          <div className="h-72">
            {paretoParadasData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-zinc-500">
                Sem paradas no período/filtro
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                <BarChart
                  data={paretoParadasData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#27272a"
                  />
                  <XAxis type="number" stroke="#a1a1aa" hide />
                  <YAxis
                    type="category"
                    dataKey="motivo"
                    stroke="#a1a1aa"
                    width={140}
                    fontSize={10}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #3f3f46",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#e4e4e7" }}
                    formatter={(value) => [`${value} min`, "Duração"]}
                  />
                  <Bar
                    dataKey="duracao"
                    name="Duração (min)"
                    fill="#f87171"
                    radius={[0, 4, 4, 0]}
                    barSize={30}
                  >
                    <LabelList content={renderParetoLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">
            *Motivos que mais impactam a disponibilidade.
          </p>
        </div>
      </div>
    </div>
  );
}

