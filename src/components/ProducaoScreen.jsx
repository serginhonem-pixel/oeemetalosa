// src/components/ProducaoScreen.jsx
import React, { useMemo, useRef } from "react";
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
  // estado do form (vem do App)
  formApontProdData,
  setFormApontProdData,
  formApontProdCod,
  setFormApontProdCod,
  formApontProdQtd,
  setFormApontProdQtd,
  formApontProdComp,
  setFormApontProdComp,
  formApontProdDestino,
  setFormApontProdDestino,

  // máquina
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

  // opcional: meta do dia
  metaProducaoDia,
}) => {
  // apenas para focar na quantidade se quiser
  const inputQtdRef = useRef(null);
  const inputCompRef = useRef(null);

  // ---------------------------------------------------------------------------
  //  FILTRO HISTÓRICO: DATA + MÁQUINA
  // ---------------------------------------------------------------------------

  const producaoFiltrada = useMemo(() => {
    return (historicoProducaoReal || []).filter((p) => {
      const origem = String(p.origem || '').toUpperCase();
      const ignorarFinalizacao =
        origem === 'FINALIZACAO_ORDEM' || origem === 'FINALIZACAO_RAPIDA';
      if (ignorarFinalizacao) return false;

      const dataOk = p.data === formApontProdData;

      if (!formApontProdMaquina) return dataOk;

      const maquinaRegistro = p.maquinaId || p.maquina || null;
      if (!maquinaRegistro) return dataOk;

      const maquinaSelecionadaObj = catalogoMaquinas?.find(
        (m) =>
          m.maquinaId === formApontProdMaquina || m.id === formApontProdMaquina
      );
      const nomeSelecionado = maquinaSelecionadaObj?.nomeExibicao;

      const maquinaOk =
        maquinaRegistro === formApontProdMaquina ||
        (!!nomeSelecionado && maquinaRegistro === nomeSelecionado);

      return dataOk && maquinaOk;
    });
  }, [historicoProducaoReal, formApontProdData, formApontProdMaquina, catalogoMaquinas]);

  const totalPecasDia = useMemo(
    () =>
      producaoFiltrada.reduce(
        (acc, curr) => acc + (Number(curr.qtd) || 0),
        0
      ),
    [producaoFiltrada]
  );

  const produtoSelecionado = useMemo(
    () => CATALOGO_PRODUTOS.find((p) => p.cod === formApontProdCod),
    [formApontProdCod]
  );

  const calcularTotaisRegistro = (registro) => {
    const prod = CATALOGO_PRODUTOS.find((p) => p.cod === registro.cod);
    const qtd = Number(registro.qtd) || 0;
    const comp = Number(
      registro.comp ??
        registro.compMetros ??
        prod?.comp ??
        0
    ) || 0;

    const pesoPorPeca =
      registro.pesoPorPeca ??
      (prod?.custom
        ? (prod?.kgMetro || 0) * comp
        : prod?.pesoUnit || 0);

    const pesoTotal = registro.pesoTotal ?? pesoPorPeca * qtd;
    const m2Total = registro.m2Total ?? comp * qtd;

    return { qtd, comp, pesoPorPeca, pesoTotal, m2Total };
  };

  const totalM2Dia = useMemo(
    () =>
      producaoFiltrada.reduce(
        (acc, reg) => acc + calcularTotaisRegistro(reg).m2Total,
        0
      ),
    [producaoFiltrada]
  );

  const totalPesoDia = useMemo(
    () =>
      producaoFiltrada.reduce(
        (acc, reg) => acc + calcularTotaisRegistro(reg).pesoTotal,
        0
      ),
    [producaoFiltrada]
  );

  const metaDia = metaProducaoDia ?? null;
  const percentualMeta =
    metaDia && metaDia > 0 ? Math.min(100, (totalPecasDia / metaDia) * 100) : 0;

  // ---------------------------------------------------------------------------
  //  HANDLERS
  // ---------------------------------------------------------------------------

  const handleSelecionarProduto = (cod) => {
    setFormApontProdCod(cod);

    if (handleSelectProdApontamento) {
      handleSelectProdApontamento({ target: { value: cod } });
    }

    // Se quiser, já sugere "Estoque" na primeira vez
    if (!formApontProdDestino) {
      setFormApontProdDestino("Estoque");
    }

    if (inputQtdRef.current) {
      inputQtdRef.current.focus();
      inputQtdRef.current.select();
    }
  };



  const handleKeyDownQtd = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (salvarApontamentoProducao) salvarApontamentoProducao(e);
    }
  };

  // ---------------------------------------------------------------------------
  //  RENDER
  // ---------------------------------------------------------------------------

  const isSobMedida = produtoSelecionado?.custom;
  const compSugerido = produtoSelecionado?.comp || "";
  const compAtualNumero =
    parseFloat(formApontProdComp || compSugerido || 0) || 0;
  const qtdNumero = Number(formApontProdQtd) || 0;
  const pesoPorPecaPreview = isSobMedida
    ? (produtoSelecionado?.kgMetro || 0) * compAtualNumero
    : (produtoSelecionado?.pesoUnit || 0);
  const pesoTotalPreview = pesoPorPecaPreview * qtdNumero;
  const m2Preview = compAtualNumero * qtdNumero;

  return (
    <div className="flex-1 bg-[#09090b] p-4 md:p-8 overflow-y-auto md:overflow-hidden flex flex-col">
      {/* HEADER PRINCIPAL */}
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

          <form onSubmit={salvarApontamentoProducao} className="flex flex-col gap-3">
            {/* DATA */}
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">
                Data
              </label>
              <input
                type="date"
                required
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
                <option value="">Todas / não informado</option>
                {catalogoMaquinas &&
                  catalogoMaquinas.map((m) => (
                    <option key={m.maquinaId || m.id} value={m.maquinaId || m.id}>
                      {m.nomeExibicao}
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-zinc-600 mt-1">
                Essa máquina também é usada para filtrar o histórico.
              </p>
            </div>

            {/* PRODUTO - APENAS LISTA */}
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">
                Produto
              </label>
              <select                
                value={formApontProdCod || ""}
                onChange={(e) => handleSelecionarProduto(e.target.value)}
                className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              >
                <option value="">Selecione...</option>
                {CATALOGO_PRODUTOS.map((p) => (
                  <option key={`${p.cod}-${p.desc}`} value={p.cod}>
                    {p.cod} - {p.desc}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-600 mt-1">
                Selecione diretamente o item da lista.
              </p>
            </div>

            {isSobMedida && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-amber-400 uppercase">
                    Comprimento (m)
                  </label>
                  <button
                    type="button"
                    onClick={() => inputCompRef.current?.focus()}
                    className="text-[10px] px-2 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30"
                  >
                    Informar medida
                  </button>
                </div>
                <input
                  ref={inputCompRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={formApontProdComp}
                  onChange={(e) => setFormApontProdComp(e.target.value)}
                  className="w-full mt-1 bg-zinc-900 border border-amber-500/40 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                  placeholder="Ex: 3,50"
                />
                <p className="text-[10px] text-amber-200 mt-1">
                  Item sob medida: informe o comprimento para calcular m² e peso.
                </p>
              </div>
            )}

            {/* QTD + DESTINO */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase">
                  Qtd
                </label>
                <input
                  ref={inputQtdRef}
                  type="number"
                  min="1"
                  required
                  value={formApontProdQtd}
                  onChange={(e) => setFormApontProdQtd(e.target.value)}
                  onKeyDown={handleKeyDownQtd}
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

            {(qtdNumero > 0 && compAtualNumero > 0) && (
              <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-3 py-2 flex items-center justify-between">
                <span>M²: {(m2Preview).toFixed(2)}</span>
                <span>Peso: {(pesoTotalPreview).toFixed(2)} kg</span>
              </div>
            )}

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
  onChange={(e) => {
    // opcional: exigir máquina pra importar
    if (!formApontProdMaquina) {
      alert("Selecione uma máquina antes de importar a produção.");
      e.target.value = ""; // limpa o input pra permitir escolher o mesmo arquivo de novo
      return;
    }

    handleUploadApontamentoProducao?.(e, formApontProdMaquina);
  }}
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
                <History size={18} /> Histórico do Dia
              </h3>
              <p className="text-[10px] text-zinc-400">
                {producaoFiltrada.length} registro(s) em{" "}
                {formApontProdData || "-"}
                {formApontProdMaquina &&
                  ` · Máquina: ${
                    catalogoMaquinas?.find(
                      (m) => m.id === formApontProdMaquina
                    )?.nomeExibicao || formApontProdMaquina
                  }`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                <Calculator size={14} className="text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">
                  Total: {totalPecasDia} un
                </span>
              </div>
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg text-blue-200 text-xs font-bold">
                <span>M²: {totalM2Dia.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-lg text-sky-200 text-xs font-bold">
                <span>Peso: {totalPesoDia.toFixed(1)} kg</span>
              </div>
              {metaDia && metaDia > 0 && (
                <div className="hidden md:flex flex-col items-end gap-1 text-[10px] text-zinc-300">
                  <span>Meta: {metaDia} un</span>
                  <div className="w-28 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${percentualMeta}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-auto">
            <table className="w-full min-w-[720px] md:min-w-0 text-left text-sm">
              <thead className="bg-black/20 text-zinc-500 text-xs uppercase sticky top-0 backdrop-blur">
                <tr>
                  <th className="p-4">Item</th>
                  <th className="p-4 text-center">Máquina</th>
                  <th className="p-4 text-center">Qtd</th>
                  <th className="p-4 text-center">Comp (m)</th>
                  <th className="p-4 text-center">m²</th>
                  <th className="p-4 text-center">Peso</th>
                  <th className="p-4 text-xs font-mono">ID</th>
                  <th className="p-4 text-right">#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {producaoFiltrada.map((p) => {
                  const metricas = calcularTotaisRegistro(p);
                  const maquinaId = p.maquinaId || p.maquina;
                  const nomeMaquina =
                    catalogoMaquinas?.find(
                      (m) => m.maquinaId === maquinaId || m.id === maquinaId
                    )?.nomeExibicao || maquinaId || "-";

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
                      <td className="p-4 text-center text-zinc-300 text-xs">
                        {metricas.comp ? metricas.comp.toFixed(2) : "-"}
                      </td>
                      <td className="p-4 text-center text-zinc-300 text-xs">
                        {metricas.m2Total ? metricas.m2Total.toFixed(2) : "-"}
                      </td>
                      <td className="p-4 text-center text-zinc-300 text-xs">
                        {metricas.pesoTotal ? metricas.pesoTotal.toFixed(1) + " kg" : "-"}
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
                      Nenhum apontamento para esta combinação de data/máquina.
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
