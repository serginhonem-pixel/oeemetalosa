import React, { useState, useMemo } from "react";
import { AlertOctagon, Clock, History, Trash2, AlertTriangle } from "lucide-react";

// Garante que está voltando a pasta corretamente com "../"
import { CATALOGO_MAQUINAS } from "../data/catalogoMaquinas";
import { DICIONARIO_PARADAS } from "../data/dicionarioParadas";

// --- HELPER PARA CORRIGIR O BUG VISUAL DA DATA ---
// (Evita que o fuso horário jogue a data para o dia anterior)



const formatarDataVisual = (dataISO) => {
  if (!dataISO) return "-";
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;


};


export const ParadasScreen = ({ eventosParada = [], onRegistrarParada, deletarParada }) => {



  // Ajuste para iniciar com a data Local correta (sem ser UTC)
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    const offset = hoje.getTimezoneOffset() * 60000;
    return new Date(hoje - offset).toISOString().slice(0, 10);
  });

  const [maquinaId, setMaquinaId] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [motivoCodigo, setMotivoCodigo] = useState("");

  const motivosDisponiveis = useMemo(() => DICIONARIO_PARADAS, []);
  const maquinasAtivas = useMemo(
    () => CATALOGO_MAQUINAS.filter((m) => m.ativo),
    []
  );

  const paradasDoDia = useMemo(
    () => eventosParada.filter((p) => p.data === dataSelecionada),
    [eventosParada, dataSelecionada]
  );

  const getDescricaoMotivo = (codigo) =>
    motivosDisponiveis.find((m) => m.codigo === codigo)?.evento || "-";

  const getNomeMaquina = (id) =>
    maquinasAtivas.find((m) => m.id === id)?.nomeExibicao || id || "-";

  const handleConfirmar = () => {
    if (!maquinaId || !horaInicio || !horaFim || !motivoCodigo) {
      alert("Preencha máquina, horários e motivo.");
      return;
    }

    const novaParada = {
      data: dataSelecionada,
      maquinaId,
      horaInicio,
      horaFim,
      motivoCodigo,
    };

    if (onRegistrarParada) {
      onRegistrarParada(novaParada);
    }

    // Limpa apenas os campos de horário e motivo, mantém a máquina e data
    setHoraInicio("");
    setHoraFim("");
    setMotivoCodigo("");
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* COLUNA ESQUERDA - FORMULÁRIO */}
      <div className="w-full md:w-[360px] bg-zinc-950 border border-red-900/40 rounded-2xl p-4 flex flex-col gap-4">
        <header className="flex items-center gap-2 pb-2 border-b border-red-900/30">
          <div className="w-7 h-7 rounded-full bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-red-400">Paradas</h1>
            <p className="text-[11px] text-zinc-500">
              Registrar paradas da linha de produção
            </p>
          </div>
        </header>

        <div className="rounded-2xl border border-red-900/30 bg-zinc-950/60 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-900/20 flex items-center justify-center">
                <Clock className="w-3 h-3 text-red-400" />
              </span>
              <span className="text-sm font-semibold text-zinc-200">
                Registrar
              </span>
            </div>
            {/* USO DA FUNÇÃO DE CORREÇÃO VISUAL DA DATA */}
            <span className="text-[11px] text-zinc-500">
              {formatarDataVisual(dataSelecionada)}
            </span>
          </div>

          <div className="space-y-2">
            {/* MÁQUINA */}
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">
                Máquina
              </label>
              <select
                value={maquinaId}
                onChange={(e) => setMaquinaId(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/60"
              >
                <option value="">Máquina...</option>
                {maquinasAtivas.map((maq) => (
                  <option key={maq.id} value={maq.id}>
                    {maq.nomeExibicao}
                  </option>
                ))}
              </select>
            </div>

            {/* DATA */}
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">
                Data
              </label>
              <input
                type="date"
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/60"
              />
            </div>

            {/* HORÁRIOS */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">
                  Início
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">
                  Fim
                </label>
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                />
              </div>
            </div>

            {/* MOTIVO */}
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">
                Motivo
              </label>
              <select
                value={motivoCodigo}
                onChange={(e) => setMotivoCodigo(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/60"
              >
                <option value="">Motivo...</option>
                {motivosDisponiveis.map((motivo) => (
                  <option key={motivo.codigo} value={motivo.codigo}>
                    {motivo.codigo} - {motivo.evento}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmar}
            className="mt-2 w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-bold text-white tracking-wide transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>

      {/* COLUNA DIREITA - LISTA */}
      <div className="flex-1 bg-zinc-950 border border-zinc-800/60 rounded-2xl p-4 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">
              Paradas do dia
            </h2>
            <p className="text-[11px] text-zinc-500">
              {paradasDoDia.length} registro(s) em{" "}
              {formatarDataVisual(dataSelecionada)}
            </p>
          </div>
        </header>

        <div className="flex justify-between text-[11px] text-zinc-500 mb-2 px-1">
          <span className="w-24">HORÁRIO</span>
          <span className="flex-1">MOTIVO</span>
          <span className="w-24 text-right pr-2">MÁQUINA</span>
          <span className="w-8 text-center">#</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {paradasDoDia.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-zinc-600">
              Nenhuma parada registrada para esta data.
            </div>
          ) : (
            <ul className="space-y-1 text-xs">
              {paradasDoDia.map((p, idx) => (
                <li
                  key={`${p.data}-${p.horaInicio}-${idx}`}
                  className="grid grid-cols-[90px,1fr,100px,30px] items-center text-zinc-300 bg-zinc-900/70 rounded-lg px-2 py-1.5 border border-zinc-800/60"
                >
                  <span className="font-mono text-[11px] text-zinc-400">
                    {p.horaInicio} - {p.horaFim}
                  </span>
                  <span className="truncate pr-2 text-zinc-200">
                    {getDescricaoMotivo(p.motivoCodigo)}
                  </span>
                  <span className="text-[11px] text-zinc-500 text-right truncate">
                    {getNomeMaquina(p.maquinaId)}
                  </span>
                  
                  {/* BOTÃO DE DELETAR RESTAURADO */}
                  <div className="flex justify-center">
                    {deletarParada && (
                      <button 
                        onClick={() => deletarParada(p.id)}
                        className="text-zinc-600 hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};