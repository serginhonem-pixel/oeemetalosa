// src/components/ColunaKanban.jsx
import React from "react";
import { Layers, CalendarDays, Pencil, Factory } from "lucide-react";
import { CATALOGO_MAQUINAS } from "../data/catalogoMaquinas";


const CardRomaneio = ({ romaneio, onEdit }) => (
  <div className="bg-black/40 border border-white/5 rounded-xl p-3 hover:border-white/20 group relative">
    <div className="flex justify-between mb-1">
      <span className="text-[10px] font-bold bg-zinc-800 px-1 rounded text-zinc-400">
        #{romaneio.id}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100"
      >
        <Pencil size={12} className="text-zinc-500" />
      </button>
    </div>

    <div className="font-bold text-white text-sm truncate">
      {romaneio.cliente}
    </div>

    <div className="flex justify-between mt-2 text-[10px] text-zinc-500">
      <span>{romaneio.itens.length} itens</span>
      <span className="text-zinc-300">
        {romaneio.itens
          .reduce(
            (a, b) => a + parseFloat(b.pesoTotal || 0),
            0
          )
          .toFixed(0)}
        kg
      </span>
    </div>
  </div>
);


const formatarDataBR = (data) => {
  if (!data) return "-";

  // Se já vier em formato brasileiro, só retorna
  if (typeof data === "string") {
    // dd/mm/aaaa
    if (data.includes("/")) return data;

    // yyyy-mm-dd → dd/mm/yyyy
    if (data.includes("-")) {
      const partes = data.split("-");
      if (partes.length === 3) {
        const [ano, mes, dia] = partes;
        return `${dia}/${mes}/${ano}`;
      }
    }
  }

  // Se vier como Date mesmo, aí pode usar toLocaleDateString
  if (data instanceof Date && !isNaN(data.getTime())) {
    return data.toLocaleDateString("pt-BR");
  }

  // fallback
  return String(data);
};


export const ColunaKanban = ({ titulo, data, cor, lista, resumo, onEdit }) => {
  const safeLista = Array.isArray(lista) ? lista : [];
  const totalPeso = resumo?.peso ?? 0;
  const totalRomaneios = resumo?.total ?? safeLista.length;

  const bgMap = {
    emerald: "border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-zinc-950",
    blue: "border-sky-500/40 bg-gradient-to-b from-sky-500/10 to-zinc-950",
    purple: "border-purple-500/40 bg-gradient-to-b from-purple-500/10 to-zinc-950",
  };

  const chipMap = {
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    blue: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  };

  const colunaBg =
    bgMap[cor] ?? "border-white/10 bg-zinc-900/60";
  const chipClass =
    chipMap[cor] ?? "bg-zinc-800 text-zinc-200 border-white/10";

  // Ordena por hora se tiver
  const listaOrdenada = [...safeLista].sort((a, b) => {
    const hA = String(a.horaJanela ?? a.hora ?? "");
    const hB = String(b.horaJanela ?? b.hora ?? "");
    if (hA && hB && hA !== hB) return hA.localeCompare(hB);
    const cA = String(a.cliente ?? a.destino ?? "");
    const cB = String(b.cliente ?? b.destino ?? "");
    return cA.localeCompare(cB);
  });

      // calcula o peso do romaneio para exibir no card
  const getPesoRomaneio = (r) => {
    if (!r) return 0;

    // 1) tenta usar campos diretos
    const direto = parseFloat(r.pesoTotalKg ?? r.peso ?? 0);
    let peso = !Number.isNaN(direto) ? direto : 0;

    // 2) se não tiver peso direto, tenta somar itens (igual ao CardRomaneio antigo)
    if (peso <= 0 && Array.isArray(r.itens) && r.itens.length > 0) {
      peso = r.itens.reduce(
        (acc, item) => acc + parseFloat(item?.pesoTotal || 0),
        0
      );
      if (Number.isNaN(peso)) peso = 0;
    }

    // 3) Fallback esperto:
    //    se ainda deu 0, mas o resumo diz que tem só 1 romaneio na coluna,
    //    usa o peso do resumo (que é o que aparece lá em cima em toneladas)
    if (peso <= 0 && resumo && totalRomaneios === 1) {
      const fromResumo = parseFloat(resumo.peso ?? 0);
      if (!Number.isNaN(fromResumo) && fromResumo > 0) {
        peso = fromResumo;
      }
    }

    return peso;
  };

  const getMaquinaNome = (r) => {
    const id = r.maquinaId || r.maquina || r.maquinaProgramada;
    const found = CATALOGO_MAQUINAS.find(
      (m) => m.maquinaId === id || m.id === id || m.nomeExibicao === id
    );
    return found?.nomeExibicao || id || "Máquina não informada";
  };

  const getResumoItens = (r) => {
    let qtd = 0;
    let m2 = 0;
    if (Array.isArray(r.itens)) {
      r.itens.forEach((item) => {
        const q = Number(item?.qtd) || 0;
        const comp = Number(item?.comp ?? item?.comprimento ?? 0) || 0;
        qtd += q;
        m2 += q * comp;
      });
    }
    return { qtd, m2 };
  };

  const listaRender = listaOrdenada.filter((r) => {
    const peso = getPesoRomaneio(r);
    const { qtd, m2 } = getResumoItens(r);
    return peso > 0 || qtd > 0 || m2 > 0;
  });



  return (
    <div
      className={`
        flex flex-col min-h-[500px] md:h-full 
        rounded-2xl border overflow-hidden shadow-lg shrink-0
        ${colunaBg}
      `}
    >
      {/* Cabeçalho */}
      <div className="p-4 border-b border-white/5 bg-zinc-900/80">
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-black/40 border border-white/5">
              <Layers size={18} className="text-zinc-300" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
                Agenda
              </div>
              <h2
                className={`text-lg font-black ${
                  cor === "emerald"
                    ? "text-emerald-400"
                    : cor === "blue"
                    ? "text-sky-400"
                    : "text-purple-400"
                }`}
              >
                {titulo}
              </h2>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {data && (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                <CalendarDays size={13} />
                {formatarDataBR(data)}
              </span>
            )}
            <div className="flex gap-1.5">
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] border ${chipClass}`}
              >
                {totalRomaneios} romaneio
                {totalRomaneios === 1 ? "" : "s"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] border border-white/10 text-zinc-300">
                {(totalPeso / 1000).toFixed(1)} t
              </span>
            </div>
          </div>
        </div>

        {/* Linha extra se quiser qualquer info a mais */}
        <div className="text-[11px] text-zinc-500">
          Visualização dos romaneios programados para este período.
        </div>
      </div>

      {/* Lista de cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {listaRender.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 text-xs gap-2">
            <div className="w-8 h-8 rounded-full border border-dashed border-zinc-600 flex items-center justify-center text-[10px]">
              0
            </div>
            <p>Nenhum romaneio programado.</p>
          </div>
        )}

        {listaRender.map((r) => {
          const peso = getPesoRomaneio(r);
          const { qtd, m2 } = getResumoItens(r);
          const maquina = getMaquinaNome(r);

          return (
          <button
            key={r.sysId}
            onClick={() => onEdit && onEdit(r)}
            className={`
              w-full text-left rounded-xl border border-white/5 bg-zinc-900/80 
              hover:border-white/25 hover:bg-zinc-800/80 transition-colors
              px-3 py-2.5 flex flex-col gap-1.5
            `}
          >
            {/* Topo: cliente + máquina + peso */}
            <div className="flex justify-between gap-2">
              <div className="flex flex-col gap-1">
                <div className="text-sm font-semibold text-zinc-100 truncate max-w-[200px]">
                  {r.cliente ?? r.destino ?? "Cliente não informado"}
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                  <Factory size={12} />
                  <span className="truncate max-w-[180px]">{maquina}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-zinc-500">Peso</div>
                <div className="text-sm font-bold text-zinc-100">
                  {peso.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg
                </div>
              </div>
            </div>

            {/* Resumo produção */}
            <div className="flex items-center gap-2 text-[11px] text-zinc-300">
              <span className="px-1.5 py-0.5 rounded bg-zinc-800/60 border border-white/10">
                {qtd.toLocaleString("pt-BR")} un
              </span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800/60 border border-white/10">
                {m2.toFixed(2)} m²
              </span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800/60 border border-white/10">
                {r.itens?.length || 0} itens
              </span>
            </div>

            {/* Base: placa + status */}
            <div className="flex justify-between items-center gap-2 mt-1">
              <div className="inline-flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30">
                  {r.placa ?? "Sem placa"}
                </span>
                {r.tipoCarga && (
                  <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                    {r.tipoCarga}
                  </span>
                )}
              </div>
              {r.status && (
                <span
                  className={`
                    px-2 py-0.5 rounded-full text-[11px] font-medium
                    ${
                      r.status === "ATRASADO"
                        ? "bg-red-500/15 text-red-300 border border-red-500/40"
                        : r.status === "EM ANDAMENTO"
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                        : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    }
                  `}
                >
                  {r.status}
                </span>
              )}
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
};
