// src/components/OeeDashboard.jsx
import React from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Factory,
  PieChart,
  Scale,
} from 'lucide-react';

// Gauge simples
const GaugeCard = ({ value = 0, label, color, icon: Icon }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-zinc-900 rounded-2xl border border-white/10 shadow-lg">
      <div className="relative w-24 h-24 flex items-center justify-center">
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
        {Icon && <Icon className="w-4 h-4 mr-2 text-zinc-400" />}
        <span className="text-xs text-zinc-400 uppercase font-bold">
          {label}
        </span>
      </div>
    </div>
  );
};

// Converte HH:MM para minutos desde 07:00
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const startHour = 7;
  const totalMinutes = h * 60 + m;
  const minutesSinceStart = totalMinutes - startHour * 60;
  return minutesSinceStart > 0 ? minutesSinceStart : 0;
};

export default function OeeDashboard({
  historicoProducaoReal = [],
  historicoParadas = [],
  dataInicioInd,
  dataFimInd,
  capacidadeDiaria,
  turnoHoras,
}) {
  // ---------- 1. Preparação básica ----------
  const capDiaria = Number(capacidadeDiaria) || 0;
  const turnoHorasNum = Number(turnoHoras) || 0;

  const inicio = dataInicioInd
    ? new Date(`${dataInicioInd}T00:00:00`)
    : null;
  const fim = dataFimInd ? new Date(`${dataFimInd}T23:59:59`) : null;

  const dentroPeriodo = (dataStr) => {
    if (!inicio || !fim) return true;
    const d = new Date(`${dataStr}T00:00:00`);
    return d >= inicio && d <= fim;
  };

  const prodFiltrada = (Array.isArray(historicoProducaoReal)
    ? historicoProducaoReal
    : []
  ).filter((p) => dentroPeriodo(p.data));

  const paradasFiltradas = (Array.isArray(historicoParadas)
    ? historicoParadas
    : []
  ).filter((p) => dentroPeriodo(p.data));

  const diasNoPeriodo =
    inicio && fim
      ? Math.floor((fim - inicio) / (1000 * 60 * 60 * 24)) + 1
      : 1;

  // ---------- 2. KPIs OEE ----------
  const tempoTotalTurnoMin = turnoHorasNum * 60 * diasNoPeriodo;

  const tempoParadoMin = paradasFiltradas.reduce(
    (acc, p) => acc + (Number(p.duracao) || 0),
    0
  );

  const producaoRealTotal = prodFiltrada.reduce(
    (acc, p) => acc + (Number(p.qtd) || 0),
    0
  );

  const metaTotal = capDiaria * diasNoPeriodo;
  const itensBons = Math.round(producaoRealTotal * 0.98);
  const totalProduzido = producaoRealTotal;

  const tempoOperacional = Math.max(0, tempoTotalTurnoMin - tempoParadoMin);

  const disponibilidade =
    tempoTotalTurnoMin > 0
      ? (tempoOperacional / tempoTotalTurnoMin) * 100
      : 0;

  const performance =
    metaTotal > 0 ? (producaoRealTotal / metaTotal) * 100 : 0;

  const qualidade =
    totalProduzido > 0 ? (itensBons / totalProduzido) * 100 : 0;

  const oeeGlobal =
    (disponibilidade / 100) *
    (performance / 100) *
    (qualidade / 100) *
    100;

  // ---------- 3. Pareto de paradas ----------
  const mapaParadas = {};
  paradasFiltradas.forEach((p) => {
    const key = p.descMotivo || 'Motivo não informado';
    mapaParadas[key] = (mapaParadas[key] || 0) + (Number(p.duracao) || 0);
  });

  const listaPareto = Object.entries(mapaParadas)
    .map(([motivo, duracao]) => ({ motivo, duracao }))
    .sort((a, b) => b.duracao - a.duracao)
    .slice(0, 5);

  const maxPareto =
    listaPareto.length > 0
      ? Math.max(...listaPareto.map((p) => p.duracao))
      : 1;

  // ---------- 4. Timeline por hora 07–17 ----------
  const horas = [];
  for (let h = 7; h <= 17; h++) {
    const label = `${String(h).padStart(2, '0')}:00`;
    horas.push({ hora: label, producao: 0, paradas: 0 });
  }
  const horasMap = Object.fromEntries(horas.map((h) => [h.hora, h]));

  const horasTrabalhadas = horas.length || 1;
  const prodPorHora = Math.floor(producaoRealTotal / horasTrabalhadas);
  Object.values(horasMap).forEach((h) => {
    h.producao = prodPorHora;
  });

  paradasFiltradas.forEach((p) => {
    const startMin = timeToMinutes(p.inicio);
    const hourReal = 7 + Math.floor(startMin / 60);
    const key = `${String(hourReal).padStart(2, '0')}:00`;
    if (horasMap[key]) {
      horasMap[key].paradas += Number(p.duracao) || 0;
    }
  });

  let acumulado = 0;
  const historicoPorHora = Object.values(horasMap).map((h) => {
    acumulado += h.producao;
    return { ...h, acumulado };
  });

  const maxProdHora =
    historicoPorHora.length > 0
      ? Math.max(...historicoPorHora.map((h) => h.producao))
      : 1;

  const maxParadasHora =
    historicoPorHora.length > 0
      ? Math.max(...historicoPorHora.map((h) => h.paradas))
      : 1;

  // ---------- RENDER ----------
  return (
    <div className="flex-1 bg-[#09090b] p-8 overflow-y-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex gap-3 text-white">
          <Factory className="text-blue-400" size={32} />
          Dashboard OEE
        </h1>
        <div className="text-xs text-zinc-500">
          Período:{' '}
          <span className="text-zinc-300 font-mono">
            {dataInicioInd} → {dataFimInd}
          </span>
        </div>
      </header>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <GaugeCard
          value={oeeGlobal}
          label="OEE GLOBAL"
          color={oeeGlobal >= 85 ? '#10b981' : oeeGlobal >= 65 ? '#60a5fa' : '#f97373'}
          icon={PieChart}
        />
        <GaugeCard
          value={disponibilidade}
          label="DISPONIBILIDADE"
          color={disponibilidade >= 90 ? '#10b981' : disponibilidade >= 70 ? '#60a5fa' : '#f97373'}
          icon={Clock}
        />
        <GaugeCard
          value={performance}
          label="PERFORMANCE"
          color={performance >= 95 ? '#10b981' : performance >= 75 ? '#60a5fa' : '#f97373'}
          icon={TrendingUp}
        />
        <GaugeCard
          value={qualidade}
          label="QUALIDADE"
          color={qualidade >= 99 ? '#10b981' : qualidade >= 90 ? '#60a5fa' : '#f97373'}
          icon={CheckCircle2}
        />
      </div>

      {/* Cards extras */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 bg-zinc-900 rounded-2xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center">
            <Scale className="w-6 h-6 mr-3 text-blue-400" />
            <div>
              <p className="text-xs text-zinc-400 uppercase font-bold">
                Produção Total
              </p>
              <p className="text-xl font-bold text-white">
                {producaoRealTotal.toLocaleString('pt-BR')} un.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 rounded-2xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center">
            <AlertOctagon className="w-6 h-6 mr-3 text-red-400" />
            <div>
              <p className="text-xs text-zinc-400 uppercase font-bold">
                Tempo Parado
              </p>
              <p className="text-xl font-bold text-white">
                {tempoParadoMin} min
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 rounded-2xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="w-6 h-6 mr-3 text-emerald-400" />
            <div>
              <p className="text-xs text-zinc-400 uppercase font-bold">
                Meta Diária
              </p>
              <p className="text-xl font-bold text-white">
                {capDiaria.toLocaleString('pt-BR')} un.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Linha do tempo x Pareto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline por hora */}
        <div className="bg-zinc-900 p-6 rounded-2xl border border-white/10">
          <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Produção x Paradas por Hora (07h–17h)
          </h2>

          <div className="flex items-end gap-2 h-56">
            {historicoPorHora.map((h) => (
              <div
                key={h.hora}
                className="flex-1 flex flex-col items-center justify-end"
              >
                <div className="flex flex-col items-center justify-end h-44 w-full">
                  {/* barra de produção */}
                  <div
                    className="w-3 rounded-t bg-emerald-500"
                    style={{
                      height: `${
                        maxProdHora > 0
                          ? (h.producao / maxProdHora) * 100
                          : 0
                      }%`,
                    }}
                  ></div>

                  {/* barrinha de parada abaixo, se tiver */}
                  {h.paradas > 0 && (
                    <div
                      className="w-3 mt-1 rounded bg-red-500"
                      style={{
                        height: `${
                          maxParadasHora > 0
                            ? (h.paradas / maxParadasHora) * 100
                            : 0
                        }%`,
                      }}
                    ></div>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1">
                  {h.hora}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-zinc-500 mt-2">
            *Como os apontamentos de produção não têm hora, a produção foi
            distribuída de forma uniforme no turno. As barras vermelhas
            representam minutos de parada em cada faixa de horário.
          </p>
        </div>

        {/* Pareto */}
        <div className="bg-zinc-900 p-6 rounded-2xl border border-white/10">
          <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-400" />
            Top 5 Motivos de Parada
          </h2>

          <div className="space-y-3">
            {listaPareto.length === 0 && (
              <div className="text-xs text-zinc-500 italic">
                Sem paradas no período selecionado.
              </div>
            )}
            {listaPareto.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-500 w-6">
                  #{idx + 1}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">{item.motivo}</span>
                    <span className="text-red-400 font-bold">
                      {item.duracao} min
                    </span>
                  </div>
                  <div className="w-full bg-black h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-red-500 h-full"
                      style={{
                        width: `${
                          maxPareto > 0
                            ? (item.duracao / maxPareto) * 100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <div className="text-3xl font-black text-white mb-1">
              {tempoParadoMin}{' '}
              <span className="text-lg text-zinc-500 font-normal">
                min
              </span>
            </div>
            <p className="text-zinc-400 text-xs uppercase font-bold tracking-widest">
              Tempo total parado no período
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
