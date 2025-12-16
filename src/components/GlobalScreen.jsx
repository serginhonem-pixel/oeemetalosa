import React, { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  PlusCircle,
  Save,
  Trash2,
  Settings,
  TrendingUp,
  X,
  Filter,
  BarChart3,
  Scale,
  Ruler,
  Box,
} from "lucide-react";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { IS_LOCALHOST } from "../utils/env";

/**
 * Firestore Collections
 * - global_maquinas
 * - global_lancamentos
 * - global_config_mensal (docId = YYYY-MM) { diasUteis }
 */

// Helpers de mês
const pad2 = (n) => String(n).padStart(2, "0");
const toYYYYMM = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
function monthLabel(yyyyMM) {
  const [y, m] = yyyyMM.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// date helpers
const isoToDDMM = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}`;
};

const GlobalScreen = () => {
  // ====== MÊS ATIVO ======
  const [mesRef, setMesRef] = useState(() => toYYYYMM(new Date()));

  // range de meses
  const opcoesMes = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    const list = [];
    for (let i = -6; i <= 18; i++) {
      const dt = new Date(base.getFullYear(), base.getMonth() + i, 1);
      list.push(toYYYYMM(dt));
    }
    return list;
  }, []);

  // ====== CONFIG ======
  const [config, setConfig] = useState({ diasUteis: 22 });

  // ====== MÁQUINAS ======
  const [maquinas, setMaquinas] = useState(() => (IS_LOCALHOST ? [] : []));

  // ====== LANÇAMENTOS ======
  const [lancamentos, setLancamentos] = useState(() => (IS_LOCALHOST ? [] : []));

  // ====== FORM / FILTROS ======
  const [novoDiaISO, setNovoDiaISO] = useState(""); // yyyy-mm-dd
  const [novoValor, setNovoValor] = useState("");
  const [novaMaquinaForm, setNovaMaquinaForm] = useState("");
  const [filtroMaquina, setFiltroMaquina] = useState("TODAS");
  const [showConfig, setShowConfig] = useState(false);

  // Nova máquina
  const [inputNomeMaquina, setInputNomeMaquina] = useState("");
  const [inputMetaMaquina, setInputMetaMaquina] = useState(100);
  const [inputUnidadeMaquina, setInputUnidadeMaquina] = useState("pç");

  // ====== Firebase: subscriptions ======
  useEffect(() => {
    if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) return;

    const cfgRef = doc(db, "global_config_mensal", mesRef);
    const unsubCfg = onSnapshot(
      cfgRef,
      (snap) => {
        if (!snap.exists()) {
          setConfig({ diasUteis: 22 });
          return;
        }
        const data = snap.data();
        setConfig({
          diasUteis: Number(data?.diasUteis) || 22,
        });
      },
      (err) => {
        console.error("[Global] Erro onSnapshot config:", err);
      }
    );

    return () => unsubCfg();
  }, [mesRef]);

  useEffect(() => {
    if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) return;

    const qMaq = query(collection(db, "global_maquinas"), orderBy("nome", "asc"));
    const unsubMaq = onSnapshot(
      qMaq,
      (snap) => {
        const arr = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setMaquinas(arr);
      },
      (err) => {
        console.error("[Global] Erro onSnapshot maquinas:", err);
      }
    );

    return () => unsubMaq();
  }, []);

  useEffect(() => {
    if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) return;

    // ✅ Sem orderBy(createdAt) pra NÃO exigir índice composto
    const qLanc = query(
      collection(db, "global_lancamentos"),
      where("mesRef", "==", mesRef),
      limit(500)
    );

    const unsubLanc = onSnapshot(
      qLanc,
      (snap) => {
        const arr = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const normalizado = arr
          .map((x) => ({
            ...x,
            real: Number(x.real) || 0,
          }))
          // sort local por createdAt desc (se existir)
          .sort((a, b) => {
            const ta = a?.createdAt?.seconds || 0;
            const tb = b?.createdAt?.seconds || 0;
            return tb - ta;
          });

        setLancamentos(normalizado);
      },
      (err) => {
        console.error("[Global] Erro onSnapshot lancamentos:", err);
      }
    );

    return () => unsubLanc();
  }, [mesRef]);

  // ====== defaults: quando carregar máquinas, garante seleção ======
  useEffect(() => {
    if (maquinas.length > 0) {
      // se não tem máquina selecionada no form, pega a primeira
      if (!novaMaquinaForm) {
        setNovaMaquinaForm(maquinas[0].nome);
      }
      // se o filtro tá apontando pra uma máquina que não existe mais, reseta
      if (filtroMaquina !== "TODAS" && !maquinas.some((m) => m.nome === filtroMaquina)) {
        setFiltroMaquina("TODAS");
      }
      // se form tá apontando pra máquina removida, reseta
      if (novaMaquinaForm && !maquinas.some((m) => m.nome === novaMaquinaForm)) {
        setNovaMaquinaForm(maquinas[0].nome);
      }
    } else {
      // sem máquinas: limpa seleção do form
      setNovaMaquinaForm("");
      if (filtroMaquina !== "TODAS") setFiltroMaquina("TODAS");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maquinas]);

  useEffect(() => {
    if (filtroMaquina !== "TODAS") {
      // só seta se existir
      if (maquinas.some((m) => m.nome === filtroMaquina)) {
        setNovaMaquinaForm(filtroMaquina);
      }
    }
  }, [filtroMaquina, maquinas]);

  // Helper unidade
  const getUnidadeAtual = (nomeMaquina) => {
    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    return maq ? maq.unidade : "";
  };

  // ====== CÁLCULOS ======
  const dadosGrafico = useMemo(() => {
    let metaDiariaAtiva = 0;
    let unidadeAtiva = "un";

    if (filtroMaquina === "TODAS") {
      metaDiariaAtiva = maquinas.reduce((acc, m) => acc + (Number(m.meta) || 0), 0);
      const todasMesmaUnidade =
        maquinas.length > 0 && maquinas.every((m) => m.unidade === maquinas[0].unidade);
      if (maquinas.length > 0 && todasMesmaUnidade) unidadeAtiva = maquinas[0].unidade;
    } else {
      const maq = maquinas.find((m) => m.nome === filtroMaquina);
      metaDiariaAtiva = maq ? Number(maq.meta) || 0 : 0;
      unidadeAtiva = maq ? maq.unidade : "un";
    }

    const diasUteis = Number(config.diasUteis) || 22;
    const metaTotalMes = metaDiariaAtiva * diasUteis;

    const lancamentosFiltrados =
      filtroMaquina === "TODAS" ? lancamentos : lancamentos.filter((l) => l.maquina === filtroMaquina);

    const agrupadoPorDia = lancamentosFiltrados.reduce((acc, curr) => {
      if (!acc[curr.dia]) acc[curr.dia] = 0;
      acc[curr.dia] += Number(curr.real) || 0;
      return acc;
    }, {});

    // ordena dias "DD/MM" corretamente
    const diasUnicos = Object.keys(agrupadoPorDia).sort((a, b) => {
      const [da, ma] = a.split("/").map(Number);
      const [db, mb] = b.split("/").map(Number);
      const na = (ma || 0) * 100 + (da || 0);
      const nb = (mb || 0) * 100 + (db || 0);
      return na - nb;
    });

    const totalProduzido = lancamentosFiltrados.reduce((acc, curr) => acc + (Number(curr.real) || 0), 0);
    const diasTrabalhados = diasUnicos.length;
    const mediaDiaria = diasTrabalhados > 0 ? totalProduzido / diasTrabalhados : 0;
    const projetadoValor = diasTrabalhados > 0 ? Math.round(mediaDiaria * diasUteis) : 0;

    const dadosProcessados = diasUnicos.map((dia) => {
      const valorTotalDia = agrupadoPorDia[dia];
      const performance = metaDiariaAtiva > 0 ? (valorTotalDia / metaDiariaAtiva) * 100 : 0;

      return {
        name: dia,
        realOriginal: valorTotalDia,
        metaOriginal: metaDiariaAtiva,
        valorPlotado: performance,
        metaPlotada: 100,
        tipo: "diario",
        performance,
        unidade: unidadeAtiva,
      };
    });

    const performanceProjetada = metaTotalMes > 0 ? (projetadoValor / metaTotalMes) * 100 : 0;

    dadosProcessados.push({
      name: "PROJETADO",
      realOriginal: projetadoValor,
      metaOriginal: metaTotalMes,
      valorPlotado: performanceProjetada,
      metaPlotada: 100,
      tipo: "projetado",
      performance: performanceProjetada,
      unidade: unidadeAtiva,
    });

    return {
      dados: dadosProcessados,
      totalProduzido,
      projetadoValor,
      metaTotalMes,
      metaDiariaAtiva,
      unidadeAtiva,
    };
  }, [lancamentos, config, maquinas, filtroMaquina]);

  // ====== ACTIONS ======
  const handleAddLancamento = async (e) => {
    e.preventDefault();

    const diaFmt = isoToDDMM(novoDiaISO);
    if (!diaFmt || !novoValor) return;

    const maqFinal = novaMaquinaForm || (maquinas[0] ? maquinas[0].nome : "");
    if (!maqFinal) {
      alert("Cadastre ao menos uma máquina antes de lançar produção.");
      return;
    }

    try {
      if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) {
        setLancamentos((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            dia: diaFmt,
            real: Number(novoValor),
            maquina: maqFinal,
            mesRef,
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
          },
        ]);
      } else {
        await addDoc(collection(db, "global_lancamentos"), {
          dia: diaFmt,
          real: Number(novoValor),
          maquina: maqFinal,
          mesRef,
          createdAt: serverTimestamp(),
        });
      }

      setNovoDiaISO("");
      setNovoValor("");
    } catch (err) {
      console.error("[Global] Erro ao salvar lançamento:", err);
      alert("Erro ao salvar. Veja o console.");
    }
  };

  const handleDeleteLancamento = async (id) => {
    if (!id) return;
    try {
      if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) {
        setLancamentos((prev) => prev.filter((item) => item.id !== id));
        return;
      }
      await deleteDoc(doc(db, "global_lancamentos", id));
    } catch (err) {
      console.error("[Global] Erro ao apagar lançamento:", err);
      alert("Erro ao apagar. Veja o console.");
    }
  };

  const handleAddMaquina = async () => {
    const nome = String(inputNomeMaquina || "").trim();
    if (!nome) return;

    if (maquinas.some((m) => m.nome === nome)) {
      alert("Máquina já existe!");
      return;
    }

    try {
      if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) {
        setMaquinas((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            nome,
            meta: Number(inputMetaMaquina),
            unidade: inputUnidadeMaquina,
          },
        ]);
      } else {
        await addDoc(collection(db, "global_maquinas"), {
          nome,
          meta: Number(inputMetaMaquina),
          unidade: inputUnidadeMaquina,
          createdAt: serverTimestamp(),
        });
      }

      setInputNomeMaquina("");
      setInputMetaMaquina(100);
      setInputUnidadeMaquina("pç");
    } catch (err) {
      console.error("[Global] Erro ao adicionar máquina:", err);
      alert("Erro ao adicionar máquina. Veja o console.");
    }
  };

  const handleRemoveMaquina = async (nomeParaRemover) => {
    const maq = maquinas.find((m) => m.nome === nomeParaRemover);
    if (!maq) return;

    try {
      if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) {
        setMaquinas((prev) => prev.filter((m) => m.nome !== nomeParaRemover));
        return;
      }
      await deleteDoc(doc(db, "global_maquinas", maq.id));
    } catch (err) {
      console.error("[Global] Erro ao remover máquina:", err);
      alert("Erro ao remover máquina. Veja o console.");
    }
  };

  // meta: atualiza local no onChange e persiste no onBlur
  const handleMetaLocal = (nomeMaquina, novaMeta) => {
    const valor = Number(novaMeta);
    setMaquinas((prev) => prev.map((m) => (m.nome === nomeMaquina ? { ...m, meta: valor } : m)));
  };

  const handleMetaPersist = async (nomeMaquina) => {
    if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) return;
    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    if (!maq?.id) return;

    try {
      await updateDoc(doc(db, "global_maquinas", maq.id), { meta: Number(maq.meta) || 0 });
    } catch (err) {
      console.error("[Global] Erro ao salvar meta:", err);
    }
  };

  const handleUpdateUnidade = async (nomeMaquina, novaUnidade) => {
    setMaquinas((prev) => prev.map((m) => (m.nome === nomeMaquina ? { ...m, unidade: novaUnidade } : m)));

    if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) return;
    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    if (!maq?.id) return;

    try {
      await updateDoc(doc(db, "global_maquinas", maq.id), { unidade: novaUnidade });
    } catch (err) {
      console.error("[Global] Erro ao salvar unidade:", err);
    }
  };

  const saveDiasUteisMes = async (dias) => {
    const d = Number(dias);
    if (!Number.isFinite(d) || d <= 0) return;

    try {
      if (typeof IS_LOCALHOST !== "undefined" && IS_LOCALHOST) {
        setConfig((prev) => ({ ...prev, diasUteis: d }));
        return;
      }

      await setDoc(
        doc(db, "global_config_mensal", mesRef),
        { diasUteis: d, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("[Global] Erro ao salvar dias úteis:", err);
      alert("Erro ao salvar dias úteis. Veja o console.");
    }
  };

  // ====== Label do gráfico ======
  const renderCustomizedLabel = (props) => {
    const { x, y, width, index } = props;
    const item = dadosGrafico?.dados?.[index];
    if (!item) return null;

    const valorReal = Number(item.realOriginal || 0);
    const performance = Number(item.performance || 0);
    const atingiuMeta = performance >= 100;

    const corBox = "#18181b";
    const corTexto = "#ffffff";
    const icone = atingiuMeta ? "✓" : "";
    const corBorda = atingiuMeta ? "#22c55e" : "#ef4444";

    return (
      <g>
        <line
          x1={x + width / 2}
          y1={y}
          x2={x + width / 2}
          y2={y - 10}
          stroke="#52525b"
          strokeWidth="2"
        />

        <rect
          x={x + width / 2 - 35}
          y={y - 45}
          width="70"
          height="35"
          fill={corBox}
          rx="6"
          stroke={corBorda}
          strokeWidth="2"
        />

        <text
          x={x + width / 2}
          y={y - 23}
          fill={corTexto}
          textAnchor="middle"
          fontSize={13}
          fontWeight="bold"
        >
          {icone} {performance.toFixed(0)}%
        </text>

        <text
          x={x + width / 2}
          y={y + 18}
          fill="#e4e4e7"
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
        >
          {valorReal.toLocaleString("pt-BR")}
        </text>
      </g>
    );
  };

  const lancamentosVisiveis =
    filtroMaquina === "TODAS" ? lancamentos : lancamentos.filter((l) => l.maquina === filtroMaquina);

  return (
    <div className="w-full h-full overflow-auto p-4 md:p-6 bg-[#09090b] text-zinc-100">
      {/* HEADER */}
      <div className="bg-zinc-900 text-white shadow-lg border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-zinc-100" size={28} />
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide text-zinc-100">
                Acompanhamento Global
              </h1>
              <p className="text-zinc-500 text-xs font-mono">Painel de Controle Integrado</p>
            </div>
          </div>

          <div className="flex gap-2 bg-zinc-800 p-1 rounded border border-zinc-700 items-center">
            {/* MÊS */}
            <div className="relative group">
              <select
                value={mesRef}
                onChange={(e) => setMesRef(e.target.value)}
                className="bg-transparent text-zinc-200 px-3 py-1.5 text-sm font-bold focus:bg-zinc-700 focus:outline-none cursor-pointer border-none ring-0 uppercase"
                title="Mês de referência"
              >
                {opcoesMes.map((k) => (
                  <option key={k} value={k} className="bg-zinc-900 text-zinc-300">
                    {monthLabel(k)}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-px bg-zinc-600 mx-1" />

            {/* FILTRO */}
            <div className="relative group">
              <Filter className="absolute left-2 top-2 text-zinc-400" size={16} />
              <select
                value={filtroMaquina}
                onChange={(e) => setFiltroMaquina(e.target.value)}
                className="bg-transparent text-zinc-200 pl-8 pr-8 py-1.5 text-sm font-bold focus:bg-zinc-700 focus:outline-none cursor-pointer border-none ring-0 uppercase"
              >
                <option value="TODAS" className="bg-zinc-900 text-zinc-300">
                  Todas as Máquinas
                </option>
                {maquinas.map((m) => (
                  <option key={m.id || m.nome} value={m.nome} className="bg-zinc-900">
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-px bg-zinc-600 mx-1" />

            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all text-sm font-bold uppercase ${
                showConfig ? "bg-zinc-100 text-zinc-900" : "hover:bg-zinc-700 text-zinc-300"
              }`}
            >
              <Settings size={16} /> Config
            </button>
          </div>
        </div>
      </div>

      {/* CONFIG */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out bg-zinc-900 border-b border-zinc-800 ${
          showConfig ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="max-w-7xl mx-auto p-6">
          <h2 className="text-lg font-bold text-zinc-300 uppercase mb-4 border-b border-zinc-700 pb-2">
            Parâmetros do Processo
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CALENDÁRIO */}
            <div className="bg-zinc-800 p-4 shadow-sm border border-zinc-700 rounded-lg">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Calendário</h3>

              <div className="text-xs text-zinc-500 mb-2">
                Mês ativo:{" "}
                <span className="text-zinc-200 font-bold uppercase">{monthLabel(mesRef)}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-300">Dias Úteis:</span>
                <input
                  type="number"
                  value={config.diasUteis}
                  onChange={(e) => setConfig({ ...config, diasUteis: Number(e.target.value) })}
                  onBlur={(e) => saveDiasUteisMes(e.target.value)}
                  className="w-20 p-1 bg-zinc-900 border border-zinc-600 text-center font-bold text-white focus:ring-1 focus:ring-zinc-500 outline-none rounded"
                />
                <button
                  onClick={() => saveDiasUteisMes(config.diasUteis)}
                  className="ml-auto bg-zinc-100 text-zinc-900 px-3 py-1.5 text-xs font-bold uppercase hover:bg-zinc-300 rounded"
                >
                  Salvar
                </button>
              </div>

              <div className="mt-2 text-[11px] text-zinc-500">
                * Esse valor é salvo no Firebase para <b>{mesRef}</b>.
              </div>
            </div>

            {/* MÁQUINAS */}
            <div className="lg:col-span-2">
              <div className="bg-zinc-800 border border-zinc-700 shadow-sm rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-900 border-b border-zinc-700 text-zinc-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-2 font-bold">Máquina</th>
                      <th className="px-4 py-2 font-bold w-32 text-center">UM</th>
                      <th className="px-4 py-2 font-bold w-32 text-right">Meta Diária</th>
                      <th className="px-4 py-2 w-10" />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-700">
                    {maquinas.map((m) => (
                      <tr key={m.id || m.nome} className="hover:bg-zinc-700/50">
                        <td className="px-4 py-2 font-bold text-zinc-200">{m.nome}</td>

                        <td className="px-4 py-2 text-center">
                          <div className="relative inline-block w-full">
                            <select
                              value={m.unidade}
                              onChange={(e) => handleUpdateUnidade(m.nome, e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-600 text-zinc-200 font-bold focus:ring-1 focus:ring-blue-500 rounded py-1 px-2 text-center appearance-none cursor-pointer hover:bg-zinc-950 transition-colors"
                            >
                              <option value="pç">Pç</option>
                              <option value="kg">Kg</option>
                              <option value="m">m</option>
                              <option value="cx">Cx</option>
                            </select>
                            <div className="absolute right-2 top-1.5 pointer-events-none text-zinc-500">
                              {m.unidade === "kg" && <Scale size={14} />}
                              {m.unidade === "m" && <Ruler size={14} />}
                              {m.unidade === "cx" && <Box size={14} />}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={m.meta}
                            onChange={(e) => handleMetaLocal(m.nome, e.target.value)}
                            onBlur={() => handleMetaPersist(m.nome)}
                            className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-right font-mono text-white focus:border-zinc-500 outline-none"
                          />
                        </td>

                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleRemoveMaquina(m.nome)}
                            className="text-zinc-500 hover:text-red-400"
                            title="Remover máquina"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {maquinas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                          Nenhuma máquina cadastrada ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* ADD MÁQUINA */}
                <div className="bg-zinc-900 p-2 flex gap-2 border-t border-zinc-700 items-center">
                  <input
                    type="text"
                    placeholder="Nova Máquina..."
                    className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm outline-none text-white placeholder-zinc-500"
                    value={inputNomeMaquina}
                    onChange={(e) => setInputNomeMaquina(e.target.value)}
                  />

                  <div className="w-24">
                    <select
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-1 py-1.5 text-sm outline-none text-zinc-300 font-medium cursor-pointer hover:bg-zinc-700"
                      value={inputUnidadeMaquina}
                      onChange={(e) => setInputUnidadeMaquina(e.target.value)}
                    >
                      <option value="pç">Pç</option>
                      <option value="kg">Kg</option>
                      <option value="m">m</option>
                      <option value="cx">Cx</option>
                    </select>
                  </div>

                  <input
                    type="number"
                    placeholder="Meta"
                    className="w-24 bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm outline-none text-white placeholder-zinc-500"
                    value={inputMetaMaquina}
                    onChange={(e) => setInputMetaMaquina(e.target.value)}
                  />

                  <button
                    onClick={handleAddMaquina}
                    disabled={!String(inputNomeMaquina || "").trim()}
                    className="bg-zinc-100 text-zinc-900 px-4 py-1.5 text-sm font-bold uppercase hover:bg-zinc-300 disabled:opacity-50 rounded"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAINEL PRINCIPAL */}
      <div className="max-w-7xl mx-auto mt-6 px-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LATERAL */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-zinc-900 p-5 border border-zinc-800 shadow-lg rounded-lg border-t-4 border-t-zinc-500">
            <h2 className="font-bold text-zinc-200 mb-4 uppercase text-sm flex items-center gap-2">
              <PlusCircle size={18} className="text-zinc-500" /> Registrar Produção
            </h2>

            <form onSubmit={handleAddLancamento} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Máquina</label>
                <select
                  className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded focus:border-zinc-500 outline-none text-white text-sm font-medium"
                  value={novaMaquinaForm}
                  onChange={(e) => setNovaMaquinaForm(e.target.value)}
                  disabled={maquinas.length === 0}
                >
                  {maquinas.length === 0 && <option value="">Cadastre uma máquina</option>}
                  {maquinas.map((m) => (
                    <option key={m.id || m.nome} value={m.nome}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Data</label>
                  <input
                    type="date"
                    className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded focus:border-zinc-500 outline-none text-white text-sm"
                    value={novoDiaISO}
                    onChange={(e) => setNovoDiaISO(e.target.value)}
                    disabled={maquinas.length === 0}
                  />
                </div>

                <div className="flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">
                    Qtd ({getUnidadeAtual(novaMaquinaForm) || "-"})
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded focus:border-zinc-500 outline-none text-white font-bold text-right placeholder-zinc-600"
                    value={novoValor}
                    onChange={(e) => setNovoValor(e.target.value)}
                    disabled={maquinas.length === 0}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={maquinas.length === 0 || !novoDiaISO || !novoValor}
                className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-bold py-2 uppercase text-sm shadow-lg rounded transition-colors flex justify-center gap-2 disabled:opacity-50"
              >
                <Save size={16} /> Salvar
              </button>
            </form>
          </div>

          {/* RECENTES */}
          <div className="bg-zinc-900 border border-zinc-800 shadow-lg rounded-lg flex flex-col h-[420px]">
            <div className="p-3 bg-zinc-950/50 border-b border-zinc-800 flex justify-between items-center rounded-t-lg">
              <span className="font-bold text-zinc-300 text-xs uppercase">Lançamentos Recentes</span>
              <span className="text-xs font-mono bg-zinc-800 border border-zinc-600 px-2 py-0.5 text-zinc-400 rounded">
                {lancamentosVisiveis.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-950 text-xs text-zinc-500 font-bold uppercase sticky top-0 border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Dia</th>
                    <th className="px-3 py-2 text-left">Maq</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-800">
                  {lancamentosVisiveis.map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-800/50">
                      <td className="px-3 py-2 font-medium text-zinc-300">{l.dia}</td>
                      <td className="px-3 py-2 text-xs text-zinc-500 truncate max-w-[120px]">{l.maquina}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-zinc-200">
                        {Number(l.real || 0).toLocaleString("pt-BR")}{" "}
                        <span className="text-[10px] text-zinc-500 font-normal">
                          {getUnidadeAtual(l.maquina)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDeleteLancamento(l.id)}
                          className="text-zinc-600 hover:text-red-400"
                          title="Apagar lançamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {lancamentosVisiveis.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-sm text-zinc-500">
                        Sem lançamentos neste mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* GRÁFICO */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="bg-zinc-900 p-4 border border-zinc-800 shadow-lg rounded-lg flex-1 flex-col min-h-[640px] border-t-4 border-t-yellow-600 flex">
            <div className="flex justify-between items-start mb-4 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-200 uppercase flex items-center gap-2">
                  <TrendingUp className="text-zinc-100" size={20} />
                  Performance: {filtroMaquina === "TODAS" ? "Geral" : filtroMaquina}
                </h3>

                <div className="mt-1 flex gap-4 text-xs font-bold text-zinc-500 uppercase">
                  <span>
                    Meta Diária:{" "}
                    <span className="text-zinc-200 text-sm">
                      {dadosGrafico.metaDiariaAtiva.toLocaleString("pt-BR")} {dadosGrafico.unidadeAtiva}
                    </span>
                  </span>
                  <span className="text-zinc-700">|</span>
                  <span>
                    Meta Mensal:{" "}
                    <span className="text-zinc-200 text-sm">
                      {dadosGrafico.metaTotalMes.toLocaleString("pt-BR")} {dadosGrafico.unidadeAtiva}
                    </span>
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Projeção Final</p>
                <div className="flex items-center justify-end gap-2">
                  <span
                    className={`text-3xl font-black ${
                      dadosGrafico.projetadoValor >= dadosGrafico.metaTotalMes ? "text-green-500" : "text-orange-500"
                    }`}
                  >
                    {dadosGrafico.projetadoValor.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-xs text-zinc-500 font-bold self-end mb-1 uppercase">
                    {dadosGrafico.unidadeAtiva}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full relative min-h-[520px]">
              {maquinas.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
                  Cadastre ao menos uma máquina para visualizar o gráfico.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dadosGrafico.dados}
                    margin={{ top: 40, right: 24, left: 12, bottom: 28 }}
                    barCategoryGap="22%"
                    barGap={6}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />

                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#71717a", fontSize: 11, fontWeight: "bold" }}
                      interval={0}
                      height={36}
                      stroke="#3f3f46"
                    />

                    <YAxis hide domain={[0, "auto"]} />

                    <Tooltip
                      cursor={{ fill: "#27272a", opacity: 0.5 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-zinc-950 border border-zinc-700 p-2 shadow-xl text-xs rounded text-zinc-200">
                              <div className="font-bold uppercase mb-1 border-b border-zinc-800 pb-1 text-zinc-400">
                                {d.name}
                              </div>
                              <div>
                                Real: <span className="text-white font-mono">{d.realOriginal}</span>{" "}
                                <span className="text-zinc-500">{d.unidade}</span>
                              </div>
                              <div>
                                Meta: <span className="text-white font-mono">{d.metaOriginal}</span>{" "}
                                <span className="text-zinc-500">{d.unidade}</span>
                              </div>
                              <div className={`mt-1 ${d.performance >= 100 ? "text-green-400 font-bold" : "text-red-400 font-bold"}`}>
                                {d.performance.toFixed(1)}%
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    <Bar dataKey="valorPlotado" maxBarSize={42} radius={[6, 6, 0, 0]}>
                      {dadosGrafico.dados.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.tipo === "projetado" ? "#f97316" : "#2563eb"} />
                      ))}
                      <LabelList content={renderCustomizedLabel} />
                    </Bar>

                    <Line
                      type="linear"
                      dataKey="metaPlotada"
                      stroke="#eab308"
                      strokeWidth={4}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />

                    <ReferenceLine
                      y={100}
                      label={{ position: "right", value: "100%", fill: "#ca8a04", fontSize: 12, fontWeight: "bold" }}
                      stroke="transparent"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-6 text-xs font-bold uppercase text-zinc-500 border-t border-zinc-800 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#2563eb] rounded-sm" /> Realizado
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#f97316] rounded-sm" /> Projeção
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 w-6 bg-[#eab308]" /> Meta (100%)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalScreen;
