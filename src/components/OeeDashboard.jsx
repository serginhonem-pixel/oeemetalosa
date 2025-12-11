import React, { useEffect, useMemo, useState } from "react";
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
  LabelList,
} from "recharts";

import { CATALOGO_PRODUTOS } from "../data/catalogoProdutos";
import { CATALOGO_MAQUINAS } from "../data/catalogoMaquinas";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------- HELPERS ----------

const formatDateBR = (iso) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const clampPercent = (v) => {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
};

const todayISO = () => new Date().toISOString().split("T")[0];

// ---------- CARDS ----------
const GaugeCard = ({ label, value, accent, helper }) => {
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
  dataInicioInd,
  dataFimInd,
  capacidadeDiaria,
  turnoHoras,
}) {
  const [rangeStart, setRangeStart] = useState(dataInicioInd);
  const [rangeEnd, setRangeEnd] = useState(dataFimInd);
  const [metricMode, setMetricMode] = useState("pieces"); // 'pieces' | 'weight'
  const [preset, setPreset] = useState("custom"); 
  
  // NOVO: Estado para filtro de máquina
  const [maquinaId, setMaquinaId] = useState(""); 

  // sincroniza com filtros externos
  useEffect(() => {
    setRangeStart(dataInicioInd);
    setRangeEnd(dataFimInd);
    setPreset("custom");
  }, [dataInicioInd, dataFimInd]);

  // Lista de máquinas ativas
  const maquinasAtivas = useMemo(
    () => CATALOGO_MAQUINAS.filter((m) => m.ativo),
    []
  );

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
    setRangeStart(start.toISOString().split("T")[0]);
    setRangeEnd(end.toISOString().split("T")[0]);
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
  } = useMemo(() => {
    let start = rangeStart || dataInicioInd || todayISO();
    let end = rangeEnd || dataFimInd || todayISO();

    if (start && end && start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T23:59:59`);

    let diasNoPeriodo = 0;
    if (endDate >= startDate) {
      diasNoPeriodo = Math.floor((endDate - startDate) / MS_PER_DAY) + 1;
    }

    // --- FUNÇÃO DE FILTRO CENTRALIZADA ---
    const filterData = (item) => {
        // 1. Filtro de Data
        if (!item.data) return false;
        const d = new Date(`${item.data}T00:00:00`);
        const dataOk = d >= startDate && d <= endDate;
        
        // 2. Filtro de Máquina
        // Se maquinaId estiver vazio, aceita tudo. 
        // Se item não tiver máquina (legado), aceita também para não sumir do gráfico geral.
        // Se item tiver máquina, tem que bater com o filtro.
        const itemMaq = item.maquinaId || item.maquina;
        const maquinaOk = !maquinaId || !itemMaq || itemMaq === maquinaId;
  
        return dataOk && maquinaOk;
    };

    const prodFiltrada = Array.isArray(historicoProducaoReal)
      ? historicoProducaoReal.filter(filterData)
      : [];

    const paradasFiltradas = Array.isArray(historicoParadas)
      ? historicoParadas.filter(filterData)
      : [];

    // --- CÁLCULO DE PARADAS ---
    // Filtra apenas perdas reais (exclui TU001 que é produção)
    const perdasDeDisponibilidade = paradasFiltradas.filter(p => {
      const codMotivo = String(p.codMotivo || p.motivoCodigo || '').toUpperCase(); 
      return codMotivo !== 'TU001'; 
    });

    const tempoTotalTurnoMin = diasNoPeriodo * (Number(turnoHoras) || 0) * 60;
    
    const tempoParadoMin = perdasDeDisponibilidade.reduce(
      (acc, p) => acc + (Number(p.duracao) || Number(p.duracaoMinutos) || 0),
      0
    );

    const tempoRodandoMin = Math.max(0, tempoTotalTurnoMin - tempoParadoMin);
    const disponibilidade =
      tempoTotalTurnoMin > 0
        ? (tempoRodandoMin / tempoTotalTurnoMin) * 100
        : 0;
            
    // --- CÁLCULO DE PRODUÇÃO ---
    let producaoTotalPcs = 0;
    let producaoTotalKg = 0;
    const dailyMap = {};

    if (endDate >= startDate) {
      for (
        let dt = new Date(startDate);
        dt <= endDate;
        dt = new Date(dt.getTime() + MS_PER_DAY)
      ) {
        const iso = dt.toISOString().split("T")[0];
        dailyMap[iso] = { date: iso, pieces: 0, weightKg: 0 };
      }
    }

    prodFiltrada.forEach((item) => {
      const iso = (item.data || "").slice(0, 10);
      const qtd = Number(item.qtd) || 0;
      producaoTotalPcs += qtd;

      let peso = 0;
      const prodInfo = CATALOGO_PRODUTOS.find((p) => p.cod === item.cod);
      if (prodInfo && prodInfo.pesoUnit) {
        peso = qtd * Number(prodInfo.pesoUnit || 0);
      }
      producaoTotalKg += peso;

      if (dailyMap[iso]) {
        dailyMap[iso].pieces += qtd;
        dailyMap[iso].weightKg += peso;
      }
    });

    const dailyProductionData = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        label: formatDateBR(d.date).slice(0, 5),
        weightKg: Number(d.weightKg.toFixed(1)),
      }));

    // --- PARETO (TOP 5) ---
    const motivosMap = {};
    
    perdasDeDisponibilidade.forEach((p) => { 
      const key = p.descMotivo || p.descNorm || "Motivo não informado";
      const dur = Number(p.duracao) || Number(p.duracaoMinutos) || 0;
      motivosMap[key] = (motivosMap[key] || 0) + dur;
    });

    const paretoParadasData = Object.entries(motivosMap)
      .map(([motivo, duracao]) => ({ motivo, duracao }))
      .sort((a, b) => b.duracao - a.duracao)
      .slice(0, 5);

    // OEE
    const performance = 100;
    const qualidade = 100;
    const oeeGlobal =
      (disponibilidade / 100) * (performance / 100) * (qualidade / 100) * 100;

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
    };
  }, [
    rangeStart,
    rangeEnd,
    dataInicioInd,
    dataFimInd,
    historicoProducaoReal,
    historicoParadas,
    turnoHoras,
    maquinaId // IMPORTANTE: Recalcula tudo quando troca a máquina
  ]);

  const metricLabel =
    metricMode === "pieces" ? "Peças produzidas" : "Peso produzido (kg)";
  const metricKey = metricMode === "pieces" ? "pieces" : "weightKg";

  // --- LABEL CUSTOMIZADO (BARRAS) ---
  const renderProdLabel = (props) => {
    const { x, y, width, value } = props;
    if (!value) return null;
    const display = value.toLocaleString("pt-BR");
    return (
      <text
        x={x + width / 2}
        y={y - 4}
        textAnchor="middle"
        fill="#e4e4e7"
        fontSize={10}
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
        
        {/* TITULO + SELETOR MÁQUINA (JUNTOS) */}
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

            {/* SELETOR DE MÁQUINA (Aqui do lado, como pediu) */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg">
                <Filter size={14} className="text-blue-400" />
                <select 
                    value={maquinaId}
                    onChange={(e) => setMaquinaId(e.target.value)}
                    className="bg-transparent text-white text-sm font-medium outline-none cursor-pointer min-w-[140px]"
                >
                    <option value="" className="bg-zinc-900">Todas as Máquinas</option>
                    {maquinasAtivas.map(m => (
                        <option key={m.id} value={m.id} className="bg-zinc-900">
                            {m.nomeExibicao}
                        </option>
                    ))}
                </select>
            </div>
        </div>

        {/* CONTROLES DE DATA (DIREITA) */}
        <div className="flex flex-col gap-3 items-stretch md:items-end">
          
          {/* BOTÕES DE ATALHO (PRESETS) - MANTIDOS */}
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

          {/* INPUTS DE DATA (VISUAL MELHORADO) */}
          <div className="flex items-center gap-3 bg-zinc-900 px-4 py-2 rounded-2xl border border-white/10 text-xs shadow-sm">
            <CalendarDays className="text-zinc-400" size={16} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.16em]">
                Período Selecionado
              </span>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={rangeStart || ""}
                  onChange={(e) => {
                    setRangeStart(e.target.value);
                    setPreset("custom");
                  }}
                  className="bg-transparent border border-zinc-700 hover:border-zinc-500 rounded px-2 py-1 text-xs text-white outline-none transition-colors"
                />
                <span className="text-zinc-500 text-[10px]">até</span>
                <input
                  type="date"
                  value={rangeEnd || ""}
                  onChange={(e) => {
                    setRangeEnd(e.target.value);
                    setPreset("custom");
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
          helper="Reflete disponibilidade real"
        />
        <GaugeCard
          label="Disponibilidade"
          value={disponibilidade}
          accent="blue"
          helper={`${tempoRodandoMin.toFixed(0)} min produzindo`}
        />
        <GaugeCard
          label="Performance"
          value={performance}
          accent="yellow"
          helper="Meta fixa (100%)"
        />
        <GaugeCard
          label="Qualidade"
          value={qualidade}
          accent="pink"
          helper="Sem refugo"
        />
      </div>

      {/* RESUMO NUMÉRICO */}
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

      {/* OBSERVAÇÃO */}
      <div className="flex items-start gap-2 text-[11px] text-zinc-500 mb-6">
        <AlertCircle size={14} className="mt-[2px] text-yellow-400" />
        <p>
          <span className="font-semibold text-emerald-400">Nota:</span> Ao filtrar por máquina, a produção pode aparecer zerada se os registros antigos não tiverem o campo de máquina preenchido.
        </p>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* PRODUÇÃO DIÁRIA */}
        <div className="xl:col-span-2 bg-[#050509] border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" />
                Produção diária
              </h2>
            </div>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyProductionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid #3f3f46",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#e4e4e7" }}
                  formatter={(value) => [
                    metricMode === "pieces"
                      ? `${value.toLocaleString("pt-BR")} un.`
                      : `${value.toLocaleString("pt-BR")} kg`,
                    metricLabel,
                  ]}
                />
                <Legend />
                <Bar
                  dataKey={metricKey}
                  name={metricLabel}
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                >
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
            <ResponsiveContainer width="100%" height="100%">
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
                    {/* RÓTULOS ADICIONADOS AQUI */}
                   <LabelList content={renderParetoLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">
            *Motivos que mais impactam a disponibilidade.
          </p>
        </div>
      </div>
    </div>
  );
}