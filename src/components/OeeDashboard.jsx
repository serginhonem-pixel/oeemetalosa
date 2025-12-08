// src/components/OeeDashboard.jsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  Factory,
  BarChart3,
  TrendingUp,
  AlertOctagon,
  Clock,
  CheckCircle2,
  PieChart,
  Scale,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';

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
} from 'recharts';

// ----------------- HELPERS -----------------
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m;
  const startHour = 7; // turno começa 07:00
  const sinceStart = total - startHour * 60;
  return sinceStart > 0 ? sinceStart : 0;
};

const isoToday = () => new Date().toISOString().split('T')[0];

const addDays = (baseIso, delta) => {
  const d = baseIso ? new Date(baseIso + 'T00:00:00') : new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString().split('T')[0];
};

const formatBR = (iso) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Gauge simples
// Gauge mais "corporativo"
const GaugeCard = ({ value, label, color, icon: Icon }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.max(0, Math.min(100, value || 0));
  const offset = circumference - (safe / 100) * circumference;

  // Status visual (Crítico / Atenção / Saudável)
  let statusLabel = 'Crítico';
  let statusClasses = 'bg-red-500/10 text-red-400 border-red-500/40';

  if (safe >= 90) {
    statusLabel = 'Excelente';
    statusClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40';
  } else if (safe >= 75) {
    statusLabel = 'Saudável';
    statusClasses = 'bg-sky-500/10 text-sky-400 border-sky-500/40';
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-950 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      {/* Glow lateral */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl"
        style={{ background: color }}
      />

      <div className="relative flex h-full flex-col gap-3 p-4">
        {/* Header do card */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 border border-white/10">
                <Icon size={18} className="text-zinc-200" />
              </div>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {label}
            </span>
          </div>

          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClasses}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Corpo: Gauge + número grande */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              className="rotate-[-90deg]"
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
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {safe.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col">
            <span className="text-[11px] text-zinc-400">Resultado no período</span>
            <span className="text-sm text-zinc-300">
              Quanto mais perto de <span className="font-semibold">100%</span>, melhor
              a saúde desse pilar.
            </span>
          </div>
        </div>

        {/* Rodapé fino */}
        <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-zinc-500">
          <span>Atualizado com base nos apontamentos de produção e paradas.</span>
        </div>
      </div>
    </div>
  );
};
const MetricCard = ({ icon: Icon, label, value, subtitle, accent = 'emerald' }) => {
  const accentMap = {
    emerald: {
      pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40',
      icon: 'text-emerald-400',
    },
    red: {
      pill: 'bg-red-500/10 text-red-400 border-red-500/40',
      icon: 'text-red-400',
    },
    blue: {
      pill: 'bg-sky-500/10 text-sky-400 border-sky-500/40',
      icon: 'text-sky-400',
    },
  };

  const a = accentMap[accent] || accentMap.emerald;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-zinc-950 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <div className="absolute -right-8 top-2 h-20 w-20 rounded-full bg-white/5 blur-2xl opacity-30 pointer-events-none" />
      <div className="relative flex items-center gap-4 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/70 border border-white/10">
          <Icon size={22} className={a.icon} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {label}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${a.pill}`}
            >
              Acumulado
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-white">{value}</div>
          {subtitle && (
            <div className="mt-1 text-[11px] text-zinc-500">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
};



// ----------------- COMPONENTE PRINCIPAL -----------------
export default function OeeDashboard({
  historicoProducaoReal,
  historicoParadas,
  dataInicioInd,
  dataFimInd,
  capacidadeDiaria,
  turnoHoras,
}) {
  const hoje = isoToday();

  // range de datas interno do dashboard
  const [inicio, setInicio] = useState(dataInicioInd || hoje);
  const [fim, setFim] = useState(dataFimInd || hoje);
  const [quick, setQuick] = useState('today'); // today | 7d | 30d | 12m | custom

  useEffect(() => {
    if (dataInicioInd) setInicio(dataInicioInd);
  }, [dataInicioInd]);

  useEffect(() => {
    if (dataFimInd) setFim(dataFimInd);
  }, [dataFimInd]);

  const handleQuick = (tipo) => {
    setQuick(tipo);
    const end = hoje;
    let start = end;

    if (tipo === 'today') start = end;
    if (tipo === '7d') start = addDays(end, -6);
    if (tipo === '30d') start = addDays(end, -29);
    if (tipo === '12m') start = addDays(end, -365);
    if (tipo === 'custom') return; // deixa o usuário mexer no input

    setInicio(start);
    setFim(end);
  };

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
  } = useMemo(() => {
    const startDate = new Date(inicio + 'T00:00:00');
    const endDate = new Date(fim + 'T23:59:59');

    const prodFiltrada = (historicoProducaoReal || []).filter((item) => {
      if (!item.data) return false;
      const d = new Date(item.data + 'T00:00:00');
      return d >= startDate && d <= endDate;
    });

    const paradasFiltradas = (historicoParadas || []).filter((item) => {
      if (!item.data) return false;
      const d = new Date(item.data + 'T00:00:00');
      return d >= startDate && d <= endDate;
    });

    // dias no período
    const diasNoPeriodo =
      Math.max(
        1,
        Math.round(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1,
      );

    const horasTurno = Number(turnoHoras) || 0;
    const tempoTotalTurnoMin = diasNoPeriodo * horasTurno * 60;

    const tempoParadoMin = paradasFiltradas.reduce(
      (acc, p) => acc + (Number(p.duracao) || 0),
      0,
    );

    const tempoOperandoMin = Math.max(0, tempoTotalTurnoMin - tempoParadoMin);

    // Disponibilidade REAL: (tempo operando / tempo planejado)
    const disponibilidade =
      tempoTotalTurnoMin > 0
        ? (tempoOperandoMin / tempoTotalTurnoMin) * 100
        : 0;

    // Produção total (peças)
    const producaoRealTotal = prodFiltrada.reduce(
      (acc, p) => acc + (Number(p.qtd) || 0),
      0,
    );

    // *** IMPORTANTE ***
    // Enquanto você NÃO tem:
    //   - tempo de ciclo configurado
    //   - apontamento de refugo das telhas
    // a gente fixa Performance=100% e Qualidade=100%.
    // Assim, o OEE passa a ser exatamente a Disponibilidade.
    const performance = 100;
    const qualidade = 100;

    const oeeGlobal =
      (disponibilidade / 100) *
      (performance / 100) *
      (qualidade / 100) *
      100;

    // Pareto de paradas (top 5 motivos)
    const paradasPorMotivo = {};
    paradasFiltradas.forEach((p) => {
      const motivo = p.descMotivo || 'Motivo desconhecido';
      paradasPorMotivo[motivo] =
        (paradasPorMotivo[motivo] || 0) + (Number(p.duracao) || 0);
    });

    const paretoParadasData = Object.entries(paradasPorMotivo)
      .map(([motivo, duracao]) => ({ motivo, duracao }))
      .sort((a, b) => b.duracao - a.duracao)
      .slice(0, 5);

    // Produção x Paradas por hora (07:00 – 17:00)
    const historicoProducaoHoraMap = {};
    for (let h = 7; h <= 17; h++) {
      const horaStr = String(h).padStart(2, '0') + ':00';
      historicoProducaoHoraMap[horaStr] = {
        hora: horaStr,
        producao: 0,
        acumulado: 0,
        paradas: 0,
      };
    }

    // Distribui a produção total uniformemente pelas horas do turno
    const horasTrabalhadas = 17 - 7 + 1; // 11 horas
    const prodPorHora =
      horasTrabalhadas > 0 ? producaoRealTotal / horasTrabalhadas : 0;

    Object.keys(historicoProducaoHoraMap).forEach((h) => {
      historicoProducaoHoraMap[h].producao = prodPorHora;
    });

    // Paradas por hora (pelo horário de início)
    paradasFiltradas.forEach((p) => {
      const startMin = timeToMinutes(p.inicio);
      const startHour = 7 + Math.floor(startMin / 60);
      const horaStr = String(startHour).padStart(2, '0') + ':00';
      if (historicoProducaoHoraMap[horaStr]) {
        historicoProducaoHoraMap[horaStr].paradas += Number(p.duracao) || 0;
      }
    });

    // Acumulado
    let acum = 0;
    const historicoProducaoHora = Object.values(historicoProducaoHoraMap)
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((row) => {
        acum += row.producao;
        return { ...row, acumulado: acum };
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
    };
  }, [inicio, fim, historicoProducaoReal, historicoParadas, capacidadeDiaria, turnoHoras]);

  // ----------------- RENDER -----------------
  return (
    <div className="flex-1 bg-[#09090b] p-8 overflow-y-auto">
      {/* Cabeçalho */}
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1 text-white flex items-center gap-3">
            <Factory className="text-emerald-500" size={32} />
            Dashboard OEE
          </h1>
          <p className="text-xs text-zinc-500 flex items-center gap-2">
            <BarChart3 size={14} className="text-zinc-500" />
            Período analisado:{" "}
            <span className="font-semibold text-zinc-200">
              {formatBR(inicio)} até {formatBR(fim)}
            </span>
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => handleQuick('today')}
              className={`px-3 py-1 rounded-full border ${
                quick === 'today'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => handleQuick('7d')}
              className={`px-3 py-1 rounded-full border ${
                quick === '7d'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              7 dias
            </button>
            <button
              onClick={() => handleQuick('30d')}
              className={`px-3 py-1 rounded-full border ${
                quick === '30d'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              30 dias
            </button>
            <button
              onClick={() => handleQuick('12m')}
              className={`px-3 py-1 rounded-full border ${
                quick === '12m'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              12 meses
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <CalendarDays size={14} className="text-zinc-500" />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={inicio}
                onChange={(e) => {
                  setQuick('custom');
                  setInicio(e.target.value);
                }}
                className="bg-black border border-white/10 rounded px-2 py-1 text-xs text-white"
              />
              <span className="text-zinc-500">até</span>
              <input
                type="date"
                value={fim}
                onChange={(e) => {
                  setQuick('custom');
                  setFim(e.target.value);
                }}
                className="bg-black border border-white/10 rounded px-2 py-1 text-xs text-white"
              />
            </div>
          </div>
        </div>
      </header>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
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
          label="PERFORMANCE (FIXA)"
          color="#f59e0b"
          icon={TrendingUp}
        />
        <GaugeCard
          value={qualidade}
          label="QUALIDADE (FIXA)"
          color="#ec4899"
          icon={CheckCircle2}
        />
      </div>

      {/* Observação */}
      <div className="mb-8 bg-zinc-900/70 border border-amber-500/40 rounded-lg p-4 flex gap-3 text-xs text-zinc-300">
        <AlertCircle size={16} className="text-amber-400 mt-[2px]" />
        <p>
          <span className="font-semibold text-white">Atenção:</span> enquanto
          você ainda não tiver <span className="font-semibold">tempo de ciclo</span> das telhas
          e apontamento de <span className="font-semibold">refugo</span>, a{" "}
          <span className="font-semibold text-emerald-400">Performance</span> e a{" "}
          <span className="font-semibold text-emerald-400">Qualidade</span> estão
          fixadas em <span className="font-semibold">100%</span>. Nesse cenário, o{" "}
          <span className="font-semibold text-white">OEE</span> passa a refletir
          só a <span className="font-semibold">Disponibilidade</span>{" "}
          (tempo parado x tempo de turno). Quando começar a apontar ciclo e refugo,
          a gente liga os três pilares.
        </p>
      </div>

      {/* Cards resumo */}
            {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          icon={Scale}
          label="Produção Total (Período)"
          value={`${producaoRealTotal.toLocaleString('pt-BR')} un.`}
          subtitle="Peças efetivamente apontadas na produção."
          accent="blue"
        />

        <MetricCard
          icon={AlertOctagon}
          label="Tempo Parado (Período)"
          value={`${tempoParadoMin} min`}
          subtitle="Soma de todos os eventos de parada cadastrados."
          accent="red"
        />

        <MetricCard
          icon={Clock}
          label="Tempo Total de Turno"
          value={`${tempoTotalTurnoMin} min`}
          subtitle={`Turno de ${turnoHoras}h multiplicado pelos dias do período selecionado.`}
          accent="emerald"
        />
      </div>


      {/* Produção x Paradas por hora */}
      <div className="bg-zinc-800 p-6 rounded-xl shadow-lg mb-8 border border-white/10">
        <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2 border-b border-zinc-700 pb-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Produção x Paradas por Hora (07:00 - 17:00)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={historicoProducaoHora}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey="hora" stroke="#a1a1aa" />
            <YAxis
              yAxisId="left"
              stroke="#a1a1aa"
              tickFormatter={(v) => v.toLocaleString('pt-BR')}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#f87171"
              tickFormatter={(v) => `${v}m`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#020617',
                border: '1px solid #52525b',
                fontSize: 12,
              }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value, name) => {
                if (name === 'Paradas') return [`${value} min`, name];
                if (name === 'Produção acumulada')
                  return [`${value.toLocaleString('pt-BR')} un.`, name];
                return value;
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="acumulado"
              name="Produção acumulada"
              yAxisId="left"
              stroke="#22c55e"
              fill="#22c55e33"
              strokeWidth={2}
            />
            <Bar
              dataKey="paradas"
              name="Paradas"
              yAxisId="right"
              fill="#f87171"
              barSize={18}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-zinc-500 mt-2">
          *A produção por hora está distribuída de forma uniforme ao longo do turno, porque
          hoje o apontamento não traz o horário exato das peças. As colunas vermelhas
          mostram o total de minutos de parada em cada faixa de hora.
        </p>
      </div>

      {/* Pareto de perdas */}
      <div className="bg-zinc-800 p-6 rounded-xl shadow-lg border border-white/10">
        <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2 border-b border-zinc-700 pb-2">
          <AlertOctagon className="w-5 h-5 text-red-400" />
          Top 5 Motivos de Parada (Pareto)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={paretoParadasData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              type="number"
              stroke="#a1a1aa"
              tickFormatter={(v) => `${v}m`}
            />
            <YAxis
              type="category"
              dataKey="motivo"
              stroke="#a1a1aa"
              width={200}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#020617',
                border: '1px solid #52525b',
                fontSize: 12,
              }}
              formatter={(value) => [`${value} min`, 'Duração']}
            />
            <Legend />
            <Bar dataKey="duracao" fill="#f97373" name="Duração (min)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
