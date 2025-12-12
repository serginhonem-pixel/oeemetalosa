import React, { useState, useMemo, useEffect } from "react";
import { AlertTriangle, Clock, Trash2, Timer, AlertOctagon } from "lucide-react";

import { CATALOGO_MAQUINAS } from "../data/catalogoMaquinas";
import { DICIONARIO_PARADAS } from "../data/dicionarioParadas";

// --- Helpers ---

const formatarDataVisual = (dataISO) => {
  if (!dataISO) return "-";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
};

const hojeISOcorrigido = () => {
  const hoje = new Date();
  const offset = hoje.getTimezoneOffset() * 60000;
  return new Date(hoje.getTime() - offset).toISOString().slice(0, 10);
};

const horaParaMinutos = (hhmm) => {
  if (!hhmm || !hhmm.includes(":")) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const calcularDuracao = (inicio, fim) => {
  if (!inicio || !fim) return 0;
  return horaParaMinutos(fim) - horaParaMinutos(inicio);
};

// -----------------------------------------------------------------------------
//  COMPONENTE
// -----------------------------------------------------------------------------

export const ParadasScreen = ({
  eventosParada = [],
  onRegistrarParada,
  deletarParada,
}) => {
  const [dataSelecionada, setDataSelecionada] = useState(hojeISOcorrigido);
  const [maquinaId, setMaquinaId] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [motivoCodigo, setMotivoCodigo] = useState("");

  const motivosDisponiveis = useMemo(() => DICIONARIO_PARADAS, []);
  const maquinasAtivas = useMemo(
    () => CATALOGO_MAQUINAS.filter((m) => m.ativo),
    []
  );

  const getDescricaoMotivo = (codigo) =>
    motivosDisponiveis.find((m) => m.codigo === codigo || m.cod === codigo)?.evento || "-";

  const getNomeMaquina = (id) =>
    maquinasAtivas.find((m) => m.id === id)?.nomeExibicao || id || "-";

  // --- LÓGICA DE LISTA ---

  const paradasDoDia = useMemo(() => {
    // Filtro
    const filtradas = (eventosParada || []).filter(
      (p) => p.data === dataSelecionada
    );

    // Normalização
    const processadas = filtradas.map((p) => {
      const inicioNorm = p.horaInicio || p.inicio || "";
      const fimNorm = p.horaFim || p.fim || "";
      const maquinaNorm = p.maquinaId || p.maquina || "";
      const motivoNorm = p.motivoCodigo || p.codMotivo || "";
      const descNorm = p.descMotivo || getDescricaoMotivo(motivoNorm);
      const duracao = calcularDuracao(inicioNorm, fimNorm);
      
      // Regra: TU001 é produção (verde). O resto é parada (incluindo TU002, TU003...)
      const isProducao = String(motivoNorm).toUpperCase() === "TU001";
      
      // Crítico se não for produção e demorar >= 30 min
      const isCritico = !isProducao && duracao >= 30;

      return {
        ...p,
        inicioNorm,
        fimNorm,
        maquinaNorm,
        motivoNorm,
        descNorm,
        duracaoMinutos: duracao,
        isProducao,
        isCritico
      };
    });

    // Ordenação
    return processadas.sort((a, b) =>
      a.inicioNorm.localeCompare(b.inicioNorm)
    );
  }, [eventosParada, dataSelecionada]);

  // Total (excluindo TU001)
  const totalMinutosParados = useMemo(() => {
    return paradasDoDia.reduce((acc, p) => {
      if (p.isProducao) return acc;
      return acc + p.duracaoMinutos;
    }, 0);
  }, [paradasDoDia]);

  // Auto-preencher horário
  const ultimaParadaDaMaquina = useMemo(() => {
    if (!maquinaId) return null;
    const listaMaquina = paradasDoDia.filter((p) => p.maquinaNorm === maquinaId);
    if (listaMaquina.length === 0) return null;
    return listaMaquina.sort((a, b) => a.fimNorm.localeCompare(b.fimNorm))[listaMaquina.length - 1];
  }, [paradasDoDia, maquinaId]);

  useEffect(() => {
    if (!horaInicio && ultimaParadaDaMaquina?.fimNorm) {
      setHoraInicio(ultimaParadaDaMaquina.fimNorm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimaParadaDaMaquina]);


  // Ação Confirmar
  const handleConfirmar = () => {
    if (!maquinaId || !horaInicio || !horaFim || !motivoCodigo) {
      alert("Preencha todos os campos.");
      return;
    }

    if (horaFim <= horaInicio) {
      alert("Horário final deve ser maior que o inicial.");
      return;
    }

    // Conflito simples
    const temConflito = paradasDoDia.some((p) => 
      p.maquinaNorm === maquinaId && 
      ((horaInicio >= p.inicioNorm && horaInicio < p.fimNorm) ||
       (horaFim > p.inicioNorm && horaFim <= p.fimNorm))
    );

    if (temConflito) {
      if (!window.confirm("Conflito de horário nesta máquina. Salvar mesmo assim?")) return;
    }

    const duracaoMin = calcularDuracao(horaInicio, horaFim);
    if (duracaoMin <= 0) {
      alert("NÇõo foi possÇ­vel calcular a duraÇõÇœo da parada.");
      return;
    }

    const novaParada = {
      data: dataSelecionada,
      maquinaId,
      horaInicio,
      horaFim,
      inicio: horaInicio,
      fim: horaFim,
      duracao: duracaoMin,
      duracaoMinutos: duracaoMin,
      motivoCodigo,
      descMotivo: getDescricaoMotivo(motivoCodigo),
    };

    if (onRegistrarParada) onRegistrarParada(novaParada);

    setHoraInicio(horaFim);
    setHoraFim("");
    setMotivoCodigo("");
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden">
      
      {/* --- ESQUERDA: FORMULÁRIO --- */}
      <div className="w-full md:w-[380px] flex-shrink-0 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl">
        
        <header className="flex items-center gap-4 border-b border-zinc-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Apontar</h1>
            <p className="text-xs text-zinc-500">Registo de inatividade ou produção</p>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Máquina</label>
            <select
              value={maquinaId}
              onChange={(e) => { setMaquinaId(e.target.value); setHoraInicio(""); }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none"
            >
              <option value="">Selecione...</option>
              {maquinasAtivas.map((m) => (
                <option key={m.id} value={m.id}>{m.nomeExibicao}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Data</label>
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Início</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none text-center"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Fim</label>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none text-center"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Motivo</label>
            <select
              value={motivoCodigo}
              onChange={(e) => setMotivoCodigo(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none"
            >
              <option value="">Selecione...</option>
              {motivosDisponiveis.map((m) => (
                <option key={m.codigo} value={m.codigo}>{m.codigo} - {m.evento}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleConfirmar}
            className="mt-4 w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
          >
            <Clock size={20} /> Confirmar
          </button>
        </div>
      </div>

      {/* --- DIREITA: LISTA (AMPLIADA) --- */}
      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header Lista */}
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
               Histórico do Dia
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              {paradasDoDia.length} registro(s) em {formatarDataVisual(dataSelecionada)}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900 px-5 py-3 rounded-xl border border-zinc-800">
            <AlertOctagon size={20} className="text-red-500" />
            <span className="text-base font-mono font-bold text-zinc-200">
              Total Parado: {Math.floor(totalMinutosParados / 60)}h {totalMinutosParados % 60}m
            </span>
          </div>
        </div>

        {/* Tabela Cabeçalho (Maior) */}
        <div className="grid grid-cols-[140px_1fr_180px_60px] gap-4 px-6 py-3 bg-zinc-900/30 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider shrink-0">
          <div>Horário / Dur.</div>
          <div>Motivo</div>
          <div className="text-right">Máquina</div>
          <div className="text-center">#</div>
        </div>

        {/* Lista Scrollável */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {paradasDoDia.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
              <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                <Clock size={32} opacity={0.5} />
              </div>
              <p className="text-sm font-medium">Nenhum registro encontrado.</p>
            </div>
          ) : (
            paradasDoDia.map((p, idx) => (
              <div
                key={`${p.data}-${p.inicioNorm}-${idx}`}
                className={`group grid grid-cols-[140px_1fr_180px_60px] gap-4 items-center px-4 py-4 rounded-xl border transition-all
                  ${p.isCritico 
                    ? "bg-red-950/20 border-red-500/30 hover:border-red-500/50" 
                    : p.isProducao 
                        ? "bg-emerald-950/10 border-emerald-900/30 hover:border-emerald-700/50" 
                        : "bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-800/60 hover:border-zinc-700"
                  }`}
              >
                {/* Coluna 1: Horário Grande + Badge */}
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-mono font-medium text-zinc-200">
                    {p.inicioNorm} - {p.fimNorm}
                  </span>
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded w-fit text-xs font-bold
                    ${p.isCritico ? 'bg-red-500/20 text-red-400' : p.isProducao ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                    <Timer size={12} /> {p.duracaoMinutos} min
                  </div>
                </div>

                {/* Coluna 2: Motivo */}
                <div className="min-w-0 flex flex-col justify-center">
                  <span className={`text-sm font-semibold block truncate ${p.isCritico ? 'text-red-200' : p.isProducao ? 'text-emerald-200' : 'text-zinc-200'}`}>
                    {p.descNorm}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono mt-0.5">
                    {p.motivoNorm}
                  </span>
                </div>

                {/* Coluna 3: Máquina */}
                <div className="text-right truncate flex items-center justify-end">
                  <span className="text-xs font-medium text-zinc-400 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 truncate max-w-full">
                    {getNomeMaquina(p.maquinaNorm)}
                  </span>
                </div>

                {/* Coluna 4: Ação */}
                <div className="flex justify-center">
                  {deletarParada && (
                    <button
                      onClick={() => deletarParada(p.id)}
                      className="p-2.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Excluir Registro"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
