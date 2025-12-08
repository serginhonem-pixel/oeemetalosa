// src/components/OeeDashboard.jsx
import React, { useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Factory,
  PieChart,
  Scale,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
} from "recharts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// GAUGE SIMPLES
// -----------------------------------------------------------------------------
const GaugeCard = ({ value, label, color, icon: Icon }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;

  const num = Number(value);
  const rawValue = Number.isFinite(num) ? num : 0;
  const clamped = Math.min(100, Math.max(0, rawValue));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-zinc-800 rounded-xl shadow-lg">
      <div className="flex items-center justify-center relative w-24 h-24">
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
            stroke="#27272a"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-xl font-bold text-white">
            {clamped.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex items-center mt-2">
        {Icon && <Icon className="w-4 h-4 mr-2 text-zinc-300" />}
        <span className="text-sm text-zinc-400 uppercase font-bold">
          {label}
        </span>
      </div>
    </div>
  );
};

// Converte HH:MM em minutos desde 07:00
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) {
    return 0;
  }
  const [h, m] = timeStr.split(":").map((n) => Number(n) || 0);
  const startHour = 7;
  const totalMinutes = h * 60 + m;
  const diff = totalMinutes - startHour * 60;
  return diff > 0 ? diff : 0;
};

const formatISOtoBR = (iso) => {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// Botão de filtro (Dia / Semana / Mês / Ano)
const FiltroButton = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
      active
        ? "bg-emerald-500 text-black border-emerald-400"
        : "bg-zinc-900 text-zinc-400 border-zinc-600 hover:bg-zinc-800"
    }`}
  >
    {label}
  </button>
);

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------
export default function OeeDashboard({
  historicoProducaoReal = [],
  historicoParadas = [],
  dataInicioInd, // ainda aceito mas não uso mais pra filtrar
  dataFimInd, // idem
  capacidadeDiaria,
  turnoHoras,
}) {
  const [filtroPeriodo, setFiltroPeriodo] = useState("mes"); // 'dia' | 'semana' | 'mes' | 'ano'

  const capacidadeNum = Number(capacidadeDiaria) || 0;
  const turnoHorasNum = Number(turnoHoras) || 0;

  const {
    oeeGlobal,
    disponibilidade,
    performance,
    qualidade,
    tempoTotalTurnoMin,
    tempoParadoMin,
    producaoRealTotal,
    paretoParadasData,
    historicoProducaoHora,
    periodoInicioBR,
    periodoFimBR,
  } = useMemo(() => {
    const safeProd = Array.isArray(historicoProducaoReal)
      ? historicoProducaoReal
      : [];
    const safeStops = Array.isArray(historicoParadas)
      ? historicoParadas
      : [];

    // --- pega a última data disponível (produção ou parada) ---
    const todasDatas = [
      ...safeProd.map((p) => p.data).filter(Boolean),
      ...safeStops.map((p) => p.data).filter(Boolean),
    ].sort();

    const hojeISO = new Date().toISOString().slice(0, 10);
    const ultimaData =
      todasDatas.length > 0
        ? todasDatas[todasDatas.length - 1]
        : hojeISO;

    let refDate = new Date(`${ultimaData}T00:00:00`);
    if (Number.isNaN(refDate.getTime())) {
      refDate = new Date(`${hojeISO}T00:00:00`);
    }

    // --- monta período em função do filtro ---
    let startDate;
    let endDate;

    switch (filtroPeriodo) {
      case "dia":
        startDate = new Date(refDate);
        endDate = new Date(refDate);
        break;
      case "semana":
        startDate = new Date(refDate);
        startDate.setDate(refDate.getDate() - 6); // últimos 7 dias
        endDate = new Date(refDate);
        break;
      case "ano":
        startDate = new Date(refDate.getFullYear(), 0, 1);
        endDate = new Date(refDate.getFullYear(), 11, 31);
        break;
      case "mes":
      default:
        startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
        endDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
        break;
    }

    const startISO = startDate.toISOString().slice(0, 10);
    const endISO = endDate.toISOString().slice(0, 10);

    const dataInicio = new Date(`${startISO}T00:00:00`);
    const dataFim = new Date(`${endISO}T23:59:59`);

    let diasNoPeriodo = 1;
    if (!Number.isNaN(dataInicio.getTime()) && !Number.isNaN(dataFim.getTime())) {
      const diff = dataFim.getTime() - dataInicio.getTime();
      diasNoPeriodo = Math.max(1, Math.round(diff / MS_PER_DAY) + 1);
    }

    // --- filtra por data ---
    const producaoFiltrada = safeProd.filter((item) => {
      if (!item?.data) return false;
      const d = new Date(`${item.data}T00:00:00`);
      if (Number.isNaN(d.getTime())) return false;
      return d >= dataInicio && d <= dataFim;
    });

    const paradasFiltradas = safeStops.filter((item) => {
      if (!item?.data) return false;
      const d = new Date(`${item.data}T00:00:00`);
      if (Number.isNaN(d.getTime())) return false;
      return d >= dataInicio && d <= dataFim;
    });

    // --- cálculos do OEE ---
    const tempoTotalTurnoMin =
      turnoHorasNum > 0 ? turnoHorasNum * 60 * diasNoPeriodo : 0;

    const tempoParadoMin = paradasFiltradas.reduce(
      (acc, parada) => acc + (Number(parada.duracao) || 0),
      0
    );

    const producaoRealTotal = producaoFiltrada.reduce(
      (acc, prod) => acc + (Number(prod.qtd) || 0),
      0
    );

    const itensBons = Math.round(producaoRealTotal * 0.98);
    const totalProduzido = producaoRealTotal;

    const tempoOperacionalMin = tempoTotalTurnoMin - tempoParadoMin;

    const disponibilidade =
      tempoTotalTurnoMin > 0
        ? (tempoOperacionalMin / tempoTotalTurnoMin) * 100
        : 0;

    const metaTotal =
      capacidadeNum > 0 ? capacidadeNum * diasNoPeriodo : 0;
    const performance =
      metaTotal > 0 ? (producaoRealTotal / metaTotal) * 100 : 0;

    const qualidade =
      totalProduzido > 0 ? (itensBons / totalProduzido) * 100 : 0;

    const oeeGlobal =
      (disponibilidade / 100) *
      (performance / 100) *
      (qualidade / 100) *
      100;

    // --- Pareto de paradas ---
    const paradasPorMotivo = paradasFiltradas.reduce((acc, parada) => {
      const motivo = parada.descMotivo || "Motivo Desconhecido";
      acc[motivo] = (acc[motivo] || 0) + (Number(parada.duracao) || 0);
      return acc;
    }, {});

    const paretoParadasData = Object.entries(paradasPorMotivo)
      .map(([motivo, duracao]) => ({ motivo, duracao }))
      .sort((a, b) => b.duracao - a.duracao)
      .slice(0, 5);

    // --- Produção por hora (distribuição uniforme só pra visual) ---
    const horasLabels = [];
    for (let h = 7; h <= 17; h++) {
      const horaStr = `${String(h).padStart(2, "0")}:00`;
      horasLabels.push(horaStr);
    }

    const historicoProducaoHoraMap = {};
    horasLabels.forEach((horaStr) => {
      historicoProducaoHoraMap[horaStr] = {
        hora: horaStr,
        producao: 0,
        acumulado: 0,
        paradas: 0,
      };
    });

    const totalHoras = horasLabels.length || 1;
    const prodPorHora = producaoRealTotal / totalHoras;
    horasLabels.forEach((horaStr) => {
      historicoProducaoHoraMap[horaStr].producao = prodPorHora;
    });

    paradasFiltradas.forEach((p) => {
      const startMin = timeToMinutes(p.inicio);
      const startHour = 7 + Math.floor(startMin / 60);
      const horaStr = `${String(startHour).padStart(2, "0")}:00`;
      if (historicoProducaoHoraMap[horaStr]) {
        historicoProducaoHoraMap[horaStr].paradas +=
          Number(p.duracao) || 0;
      }
    });

    let acumulado = 0;
    const historicoProducaoHora = horasLabels.map((horaStr) => {
      const base = historicoProducaoHoraMap[horaStr];
      acumulado += base.producao;
      return { ...base, acumulado };
    });

    return {
      oeeGlobal,
      disponibilidade,
      performance,
      qualidade,
      tempoTotalTurnoMin,
      tempoParadoMin,
      producaoRealTotal,
      paretoParadasData,
      historicoProducaoHora,
      periodoInicioBR: formatISOtoBR(startISO),
      periodoFimBR: formatISOtoBR(endISO),
    };
  }, [
    historicoProducaoReal,
    historicoParadas,
    capacidadeNum,
    turnoHorasNum,
    filtroPeriodo,
  ]);

  const textoPeriodo =
    filtroPeriodo === "dia"
      ? "do dia"
      : filtroPeriodo === "semana"
      ? "da semana"
      : filtroPeriodo === "mes"
      ? "do mês"
      : "do ano";

  return (
    <div className="flex-1 bg-[#09090b] p-8 overflow-y-auto">
      {/* CABEÇALHO + FILTROS */}
      <header className="flex justify-between items-start mb-8">
        <h1 className="text-3xl font-bold flex gap-3 text-white">
          <Factory className="text-emerald-500" size={32} />
          Dashboard OEE
        </h1>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <FiltroButton
              label="Dia"
              active={filtroPeriodo === "dia"}
              onClick={() => setFiltroPeriodo("dia")}
            />
            <FiltroButton
              label="Semana"
              active={filtroPeriodo === "semana"}
              onClick={() => setFiltroPeriodo("semana")}
            />
            <FiltroButton
              label="Mês"
              active={filtroPeriodo === "mes"}
              onClick={() => setFiltroPeriodo("mes")}
            />
            <FiltroButton
              label="Ano"
              active={filtroPeriodo === "ano"}
              onClick={() => setFiltroPeriodo("ano")}
            />
          </div>
          <div className="text-[11px] text-zinc-400">
            Período analisado:{" "}
            <span className="font-semibold text-zinc-200">
              {periodoInicioBR} — {periodoFimBR}
            </span>{" "}
            (acumulado {textoPeriodo})
          </div>
        </div>
      </header>

      {/* GAUGES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <GaugeCard
          value={oeeGlobal}
          label="OEE GLOBAL"
          color="#10b981"
          icon={PieChart}
        />
        <GaugeCard
          value={disponibilidade}
          label="DISPONIBILIDADE"
          color="#3b82f6"
          icon={Clock}
        />
        <GaugeCard
          value={performance}
          label="PERFORMANCE"
          color="#f59e0b"
          icon={TrendingUp}
        />
        <GaugeCard
          value={qualidade}
          label="QUALIDADE"
          color="#ec4899"
          icon={CheckCircle2}
        />
      </div>

      {/* CARDS RESUMO (ACUMULADO DO PERÍODO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 bg-zinc-800 rounded-xl shadow-lg flex items-center justify-between">
          <div className="flex items-center">
            <Scale className="w-6 h-6 mr-3 text-blue-400" />
            <div>
              <p className="text-sm text-zinc-400 uppercase font-bold">
                Produção acumulada {textoPeriodo}
              </p>
              <p className="text-xl font-bold text-white">
                {producaoRealTotal.toLocaleString("pt-BR")} un.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-800 rounded-xl shadow-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertOctagon className="w-6 h-6 mr-3 text-red-400" />
            <div>
              <p className="text-sm text-zinc-400 uppercase font-bold">
                Tempo parado {textoPeriodo}
              </p>
              <p className="text-xl font-bold text-white">
                {tempoParadoMin} min
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-800 rounded-xl shadow-lg flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="w-6 h-6 mr-3 text-emerald-400" />
            <div>
              <p className="text-sm text-zinc-400 uppercase font-bold">
                Tempo total de turno {textoPeriodo}
              </p>
              <p className="text-xl font-bold text-white">
                {tempoTotalTurnoMin} min
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PRODUÇÃO X PARADAS POR HORA */}
      <div className="bg-zinc-800 p-6 rounded-xl shadow-lg mb-8">
        <h2 className="text-xl font-semibold mb-4 text-white border-b border-zinc-700 pb-2">
          <TrendingUp className="w-5 h-5 mr-2 inline text-emerald-400" />
          Produção x Paradas por Hora (07:00 - 17:00)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={historicoProducaoHora}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey="hora" stroke="#a1a1aa" />
            <YAxis
              yAxisId="left"
              stroke="#a1a1aa"
              label={{
                value: "Produção (un.)",
                angle: -90,
                position: "insideLeft",
                fill: "#a1a1aa",
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#f87171"
              label={{
                value: "Paradas (min)",
                angle: 90,
                position: "insideRight",
                fill: "#f87171",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                border: "1px solid #52525b",
              }}
              labelStyle={{ color: "#60a5fa" }}
              formatter={(value, name) => {
                if (name === "Paradas (min)") return [`${value} min`, name];
                if (name === "Produção Acumulada")
                  return [`${Math.round(value)} un.`, name];
                return [value, name];
              }}
            />
            <Legend />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="acumulado"
              name="Produção Acumulada"
              stroke="#10b981"
              fill="#10b98133"
              strokeWidth={2}
            />
            <Bar
              yAxisId="right"
              dataKey="paradas"
              name="Paradas (min)"
              barSize={14}
              fill="#f87171"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-zinc-500 mt-2">
          * A produção por hora é distribuída de forma uniforme apenas para
          visualização, já que os apontamentos atuais não possuem horário.
        </p>
      </div>

      {/* PARETO DE PARADAS */}
      <div className="bg-zinc-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-white border-b border-zinc-700 pb-2">
          <AlertOctagon className="w-5 h-5 mr-2 inline text-red-400" />
          Top 5 Motivos de Parada (Pareto)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={paretoParadasData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis type="number" stroke="#a1a1aa" />
            <YAxis dataKey="motivo" type="category" stroke="#a1a1aa" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                border: "1px solid #52525b",
              }}
              labelStyle={{ color: "#60a5fa" }}
              formatter={(value) => [`${value} min`, "Duração"]}
            />
            <Legend />
            <Bar dataKey="duracao" fill="#f87171" name="Duração (min)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
