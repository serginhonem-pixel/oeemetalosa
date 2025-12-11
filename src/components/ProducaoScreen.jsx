// src/ProducaoScreen.jsx
import React, { useMemo } from "react";
import {
  Factory,
  Box,
  History,
  CheckCircle2,
  Upload,
  Download,
  Pencil,
  Trash2,
  Calculator,
} from "lucide-react";

import { CATALOGO_PRODUTOS } from "../data/catalogoProdutos";

export const ProducaoScreen = ({
  // estado do form
  formApontProdData,
  setFormApontProdData,
  formApontProdCod,
  setFormApontProdCod,
  formApontProdQtd,
  setFormApontProdQtd,
  formApontProdDestino,
  setFormApontProdDestino,

  // MÁQUINA
  formApontProdMaquina,
  setFormApontProdMaquina,
  catalogoMaquinas,

  // helpers/handlers
  handleSelectProdApontamento,
  salvarApontamentoProducao,
  apontamentoEmEdicaoId,
  limparFormApontamentoProducao,

  // dados da tabela
  historicoProducaoReal,
  iniciarEdicaoProducao,
  deletarProducaoReal,

  // import/export
  handleUploadApontamentoProducao,
  handleDownloadModeloApontProd,
}) => {
  // ----------------- FILTRO DO DIA + MÁQUINA -----------------
  const producaoFiltrada = historicoProducaoReal.filter((p) => {
    const dataOk = p.data === formApontProdData;

    const maquinaOk =
      !formApontProdMaquina ||
      p.maquinaId === formApontProdMaquina ||
      p.maquina === formApontProdMaquina;

    return dataOk && maquinaOk;
  });

  // ----------------- TOTALIZADOR (PEÇAS / METROS / KG) -----------------
  const { totalPecasDia, totalMetrosDia, totalKgDia } = useMemo(() => {
    let totalPecas = 0;
    let totalMetros = 0;
    let totalKg = 0;

    producaoFiltrada.forEach((p) => {
      const qtd = Number(p.qtd) || 0;
      totalPecas += qtd;

      const prod = CATALOGO_PRODUTOS.find((prod) => prod.cod === p.cod);
      if (!prod) return;

      const comp = Number(prod.comp) || 0;       // comprimento em metros (ou unidade que você usa)
      const kgMetro = Number(prod.kgMetro) || 0; // kg por metro, se existir
      const pesoUnit = Number(prod.pesoUnit) || 0; // kg por peça, se existir

      // Metros produzidos
      if (comp > 0) {
        totalMetros += qtd * comp;
      }

      // Peso total (prioriza pesoUnit; se não tiver, usa kgMetro * comp)
      if (pesoUnit > 0) {
        totalKg += qtd * pesoUnit;
      } else if (kgMetro > 0 && comp > 0) {
        totalKg += qtd * comp * kgMetro;
      }
    });

    return { totalPecasDia: totalPecas, totalMetrosDia: totalMetros, totalKgDia: totalKg };
  }, [producaoFiltrada]);

  const formatNumber = (v, frac = 0) =>
    (Number(v) || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: frac,
      maximumFractionDigits: frac,
    });

  return (
    <div className="flex-1 bg-[#09090b] p-4 md:p-8 overflow-hidden flex flex-col">
      <header className="mb-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <Factory className="text-emerald-400" size={20} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            Apontamento de Produção
          </h1>
          <p className="text-xs text-zinc-500">
            Registrar peças produzidas e acompanhar o histórico do dia
          </p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-6 h-full">
        {/* COLUNA ESQUERDA - FORMULÁRIO */}
        <div className="w-full md:w-[360px] bg-zinc-950 rounded-2xl border border-white/10 p-4 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Box size={16} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  Registrar Peça
                </h2>
                <p className="text-[10px] text-zinc-500">
                  Preencha os campos e confirme o apontamento
                </p>
              </div>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">
              {formApontProdData || "-"}
            </span>
          </div>

          <form
            onSubmit={salvarApontamentoProducao}
            className="flex flex-col gap-3"
          >
            {/* DATA */}
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">
                Data
              </label>
              <input
                type="date"
                value={formApontProdData}
                onChange={(e) => setFormApontProdData(e.target.value)}
                className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
            </div>

            {/* MÁQUINA */}
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">
                Máquina
              </label>
              <select
                value={formApontProdMaquina || ""}
                onChange={(e) => setFormApontProdMaquina(e.target.value)}
                className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              >
                <option value="">Selecione a máquina...</option>
                {catalogoMaquinas &&
                  catalogoMaquinas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nomeExibicao}
                    </option>
                  ))}
              </select>
            </div>

            {/* PRODUTO */}
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">
                Produto
              </label>
              <select
                value={formApontProdCod}
                onChange={handleSelectProdApontamento}
                className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              >
                <option value="">Selecione...</option>
                {CATALOGO_PRODUTOS.map((p) => (
                  <option key={p.cod} value={p.cod}>
                    {p.cod} - {p.desc}
                  </option>
                ))}
              </select>
            </div>

            {/* QTD + DESTINO */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase">
                  Qtd
                </label>
                <input
                  type="number"
                  min="0"
                  value={formApontProdQtd}
                  onChange={(e) => setFormApontProdQtd(e.target.value)}
                  className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase">
                  Destino
                </label>
                <input
                  type="text"
                  value={formApontProdDestino}
                  onChange={(e) => setFormApontProdDestino(e.target.value)}
                  className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  placeholder="Ex: Estoque..."
                />
              </div>
            </div>

            {/* BOTÕES */}
            <div className="flex flex-col gap-2 mt-2">
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg shadow-lg transition flex items-center justify-center gap-2 text-sm"
              >
                <CheckCircle2 size={16} />
                {apontamentoEmEdicaoId ? "Salvar edição" : "Confirmar"}
              </button>

              {apontamentoEmEdicaoId && (
                <button
                  type="button"
                  onClick={limparFormApontamentoProducao}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium py-2 rounded-lg border border-zinc-700 text-xs"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>

          {/* IMPORT / EXPORT */}
          <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                id="input-upload-producao"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleUploadApontamentoProducao}
              />
              <label
                htmlFor="input-upload-producao"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] bg-zinc-900 border border-zinc-700 text-zinc-200 cursor-pointer hover:bg-zinc-800"
              >
                <Upload size={14} />
                Importar
              </label>
            </div>
            <button
              type="button"
              onClick={handleDownloadModeloApontProd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            >
              <Download size={14} />
              Modelo
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA - HISTÓRICO */}
        <div className="flex-1 bg-zinc-950 rounded-2xl border border-white/10 flex flex-col overflow-hidden min-h-[300px] shadow-xl">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white flex gap-2 items-center text-sm">
                <History size={18} /> Histórico Hoje
              </h3>
              <p className="text-[10px] text-zinc-400">
                {producaoFiltrada.length} registro(s) em {formApontProdData}
              </p>
            </div>

            {/* RESUMO DO DIA */}
            <div className="flex flex-col items-end gap-0.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              <div className="flex items-center gap-2">
                <Calculator size={14} className="text-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-300">
                  Resumo do dia
                </span>
              </div>
              <div className="text-[10px] text-emerald-100 font-mono">
                Peças: {formatNumber(totalPecasDia, 0)} un
              </div>
              <div className="text-[10px] text-emerald-100 font-mono">
                Metros: {formatNumber(totalMetrosDia, 1)} m
              </div>
              <div className="text-[10px] text-emerald-100 font-mono">
                Peso: {formatNumber(totalKgDia / 1000, 2)} t
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/20 text-zinc-500 text-xs uppercase sticky top-0 backdrop-blur">
                <tr>
                  <th className="p-4">Item</th>
                  <th className="p-4 text-center">Máquina</th>
                  <th className="p-4 text-center">Qtd</th>
                  <th className="p-4 text-xs font-mono">ID</th>
                  <th className="p-4 text-right">#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {producaoFiltrada.map((p) => {
                  const nomeMaquina =
                    catalogoMaquinas?.find(
                      (m) => m.id === (p.maquinaId || p.maquina)
                    )?.nomeExibicao || "-";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-mono text-emerald-400">
                          {p.cod}
                        </div>
                        <div className="text-zinc-400 text-xs truncate">
                          {p.desc}
                        </div>
                      </td>
                      <td className="p-4 text-center text-zinc-400 text-xs">
                        {nomeMaquina}
                      </td>
                      <td className="p-4 text-center font-bold text-white">
                        {p.qtd}
                      </td>
                      <td className="p-4 text-zinc-500 font-mono text-xs w-[140px] overflow-hidden truncate">
                        {p.id}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoProducao(p)}
                            className="text-zinc-500 hover:text-emerald-400"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletarProducaoReal(p.id)}
                            className="text-zinc-600 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {producaoFiltrada.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center text-xs text-zinc-500"
                    >
                      Nenhum apontamento para esta data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
