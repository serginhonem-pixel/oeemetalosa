import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'recharts';
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
  Download,
  Loader2,
  FileText
} from 'lucide-react';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
} from 'firebase/firestore';

import { db } from '../services/firebase';
import { IS_LOCALHOST } from '../utils/env';

// ===== Helpers =====
const pad2 = (n) => String(n).padStart(2, '0');
const toYYYYMM = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function monthLabel(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function toDDMM(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}`;
}

const GlobalScreen = () => {
  // ===== MÊS ATIVO =====
  const [mesRef, setMesRef] = useState(() => toYYYYMM(new Date()));

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

  // ===== STATES (Com suporte a LocalStorage se IS_LOCALHOST) =====
  
  // Config
  const [config, setConfig] = useState(() => {
    if (IS_LOCALHOST) {
        const saved = localStorage.getItem('local_config');
        return saved ? JSON.parse(saved) : { diasUteis: 22 };
    }
    return { diasUteis: 22 };
  });

  // Máquinas
  const [maquinas, setMaquinas] = useState(() => {
    if (IS_LOCALHOST) {
        const saved = localStorage.getItem('local_maquinas');
        return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Lançamentos
  const [lancamentos, setLancamentos] = useState(() => {
    if (IS_LOCALHOST) {
        const saved = localStorage.getItem('local_lancamentos');
        return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // ===== Efeitos para Salvar no LocalStorage (Apenas Localhost) =====
  useEffect(() => {
    if (IS_LOCALHOST) localStorage.setItem('local_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (IS_LOCALHOST) localStorage.setItem('local_maquinas', JSON.stringify(maquinas));
  }, [maquinas]);

  useEffect(() => {
    if (IS_LOCALHOST) localStorage.setItem('local_lancamentos', JSON.stringify(lancamentos));
  }, [lancamentos]);


  // ===== Form / filtros =====
  const [novoDiaISO, setNovoDiaISO] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [novaMaquinaForm, setNovaMaquinaForm] = useState('');
  const [filtroMaquina, setFiltroMaquina] = useState('TODAS');
  const [showConfig, setShowConfig] = useState(false);

  // Nova máquina
  const [inputNomeMaquina, setInputNomeMaquina] = useState('');
  const [inputMetaMaquina, setInputMetaMaquina] = useState(100);
  const [inputUnidadeMaquina, setInputUnidadeMaquina] = useState('pç');

  // Export
  const chartExportRef = useRef(null);
  const [exportando, setExportando] = useState(false);
  const [progressoExport, setProgressoExport] = useState('');

  // ====== Firestore subscriptions (Só roda se NÃO for localhost) ======
  useEffect(() => {
    if (IS_LOCALHOST) return; // Pula se for local

    const cfgRef = doc(db, 'global_config_mensal', mesRef);
    const unsubCfg = onSnapshot(cfgRef, (snap) => {
      if (!snap.exists()) {
        setConfig({ diasUteis: 22 });
        return;
      }
      const data = snap.data();
      setConfig({ diasUteis: Number(data?.diasUteis) || 22 });
    }, (error) => console.error("Erro config:", error));

    return () => unsubCfg();
  }, [mesRef]);

  useEffect(() => {
    if (IS_LOCALHOST) return;

    // Sem orderBy composto para evitar erro de índice
    const qMaq = query(collection(db, 'global_maquinas'));
    const unsubMaq = onSnapshot(qMaq, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Ordenação no cliente
      arr.sort((a, b) => a.nome.localeCompare(b.nome));
      setMaquinas(arr);
    }, (error) => console.error("Erro maquinas:", error));

    return () => unsubMaq();
  }, []);

  useEffect(() => {
    if (IS_LOCALHOST) return;

    const qLanc = query(
      collection(db, 'global_lancamentos'),
      where('mesRef', '==', mesRef),
      limit(500)
    );

    const unsubLanc = onSnapshot(qLanc, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Ordenação no cliente para evitar erro de índice composto
      const ordenado = arr
        .map((x) => ({ ...x, real: Number(x.real) || 0 }))
        .sort((a, b) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tB - tA; // Decrescente
        });

      setLancamentos(ordenado);
    }, (error) => console.error("Erro lancamentos:", error));

    return () => unsubLanc();
  }, [mesRef]);

  // ====== Defaults ======
  useEffect(() => {
    if (maquinas.length > 0) {
      if (!novaMaquinaForm) setNovaMaquinaForm(maquinas[0].nome);
      if (filtroMaquina !== 'TODAS' && !maquinas.some((m) => m.nome === filtroMaquina)) {
        setFiltroMaquina('TODAS');
      }
    } else {
      setNovaMaquinaForm('');
      setFiltroMaquina('TODAS');
    }
  }, [maquinas]); 

  useEffect(() => {
    if (filtroMaquina !== 'TODAS') setNovaMaquinaForm(filtroMaquina);
  }, [filtroMaquina]);

  const getUnidadeAtual = (nomeMaquina) => {
    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    return maq ? maq.unidade : '';
  };

  // ====== Cálculos do gráfico ======
  const dadosGrafico = useMemo(() => {
    if (maquinas.length === 0) {
      return {
        dados: [],
        totalProduzido: 0,
        projetadoValor: 0,
        metaTotalMes: 0,
        metaDiariaAtiva: 0,
        unidadeAtiva: 'un',
      };
    }

    let metaDiariaAtiva = 0;
    let unidadeAtiva = 'un';

    if (filtroMaquina === 'TODAS') {
      metaDiariaAtiva = maquinas.reduce((acc, m) => acc + (Number(m.meta) || 0), 0);
      const todasMesmaUnidade = maquinas.every((m) => m.unidade === maquinas[0]?.unidade);
      if (todasMesmaUnidade) unidadeAtiva = maquinas[0].unidade;
    } else {
      const maq = maquinas.find((m) => m.nome === filtroMaquina);
      metaDiariaAtiva = maq ? Number(maq.meta) || 0 : 0;
      unidadeAtiva = maq ? maq.unidade : 'un';
    }

    const diasUteis = Number(config.diasUteis) || 22;
    const metaTotalMes = metaDiariaAtiva * diasUteis;

    const lancamentosFiltrados =
      filtroMaquina === 'TODAS' ? lancamentos : lancamentos.filter((l) => l.maquina === filtroMaquina);

    const agrupadoPorDia = lancamentosFiltrados.reduce((acc, curr) => {
      if (!acc[curr.dia]) acc[curr.dia] = 0;
      acc[curr.dia] += Number(curr.real) || 0;
      return acc;
    }, {});

    const diasUnicos = Object.keys(agrupadoPorDia).sort((a, b) => {
      const da = Number(a?.split('/')?.[0] || 0);
      const db = Number(b?.split('/')?.[0] || 0);
      return da - db;
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
        tipo: 'diario',
        performance,
        unidade: unidadeAtiva,
      };
    });

    const performanceProjetada = metaTotalMes > 0 ? (projetadoValor / metaTotalMes) * 100 : 0;

    dadosProcessados.push({
      name: 'PROJ',
      realOriginal: projetadoValor,
      metaOriginal: metaTotalMes,
      valorPlotado: performanceProjetada,
      metaPlotada: 100,
      tipo: 'projetado',
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

  // ====== Label do gráfico ======
  const renderCustomizedLabel = (props) => {
    const { x, y, width, index } = props;
    const item = dadosGrafico?.dados?.[index];
    if (!item) return null;

    const performance = Number(item.performance || 0);
    const atingiuMeta = performance >= 100;

    const corBox = '#18181b';
    const corTexto = '#ffffff';
    const icone = atingiuMeta ? '✓' : '';
    const corBorda = atingiuMeta ? '#22c55e' : '#ef4444';

    return (
      <g style={{ pointerEvents: 'none' }}>
        <line
          x1={x + width / 2}
          y1={y}
          x2={x + width / 2}
          y2={y - 10}
          stroke="#52525b"
          strokeWidth="2"
        />

        <rect
          x={x + width / 2 - 36}
          y={y - 50}
          width="72"
          height="34"
          fill={corBox}
          rx="6"
          stroke={corBorda}
          strokeWidth="2"
        />

        <text
          x={x + width / 2}
          y={y - 28}
          fill={corTexto}
          textAnchor="middle"
          fontSize={12}
          fontWeight="bold"
        >
          {icone} {performance.toFixed(0)}%
        </text>

        <text
          x={x + width / 2}
          y={y + 16}
          fill="#e4e4e7"
          textAnchor="middle"
          fontSize={10}
          fontWeight="bold"
        >
          {Number(item.realOriginal || 0).toLocaleString('pt-BR', { notation: 'compact' })}
        </text>
      </g>
    );
  };

  // ====== Actions (Dual Mode: Local vs Firebase) ======
  const handleAddLancamento = async (e) => {
    e.preventDefault();
    const diaDDMM = toDDMM(novoDiaISO);
    if (!diaDDMM || !novoValor) return;
    const maqFinal = novaMaquinaForm || (maquinas[0] ? maquinas[0].nome : '');
    if (!maqFinal) return alert('Cadastre uma máquina antes de lançar.');

    if (IS_LOCALHOST) {
        setLancamentos((prev) => [
          { id: `local-${Date.now()}`, dia: diaDDMM, real: Number(novoValor), maquina: maqFinal, mesRef, createdAt: { seconds: Date.now() / 1000 } }, 
          ...prev,
        ]);
        setNovoDiaISO('');
        setNovoValor('');
        return;
    }

    try {
      await addDoc(collection(db, 'global_lancamentos'), {
        dia: diaDDMM,
        real: Number(novoValor),
        maquina: maqFinal,
        mesRef,
        createdAt: serverTimestamp(),
      });
      setNovoDiaISO('');
      setNovoValor('');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar lançamento');
    }
  };

  const handleDeleteLancamento = async (id) => {
    if (!id) return;
    if (IS_LOCALHOST) {
        setLancamentos((prev) => prev.filter((item) => item.id !== id));
        return;
    }
    try {
      await deleteDoc(doc(db, 'global_lancamentos', id));
    } catch (error) {
      console.error(error);
      alert("Erro ao deletar");
    }
  };

  const handleAddMaquina = async () => {
    const nome = String(inputNomeMaquina || '').trim();
    if (!nome) return;
    if (maquinas.some((m) => m.nome === nome)) return alert('Máquina já existe!');

    if (IS_LOCALHOST) {
        setMaquinas((prev) => [...prev, { id: `local-${Date.now()}`, nome, meta: Number(inputMetaMaquina), unidade: inputUnidadeMaquina }]);
        setInputNomeMaquina('');
        setInputMetaMaquina(100);
        setInputUnidadeMaquina('pç');
        return;
    }

    try {
        await addDoc(collection(db, 'global_maquinas'), {
            nome,
            meta: Number(inputMetaMaquina),
            unidade: inputUnidadeMaquina,
            createdAt: serverTimestamp(),
        });
        setInputNomeMaquina('');
        setInputMetaMaquina(100);
        setInputUnidadeMaquina('pç');
    } catch (error) {
        console.error(error);
        alert("Erro ao adicionar máquina")
    }
  };

  const handleRemoveMaquina = async (nomeParaRemover) => {
    const maq = maquinas.find((m) => m.nome === nomeParaRemover);
    if (!maq) return;
    
    if (IS_LOCALHOST) {
        setMaquinas((prev) => prev.filter((m) => m.nome !== nomeParaRemover));
        return;
    }

    try {
        await deleteDoc(doc(db, 'global_maquinas', maq.id));
    } catch (error) {
        console.error(error);
        alert("Erro ao remover máquina");
    }
  };

  const handleUpdateMeta = async (nomeMaquina, novaMeta) => {
    const valor = Number(novaMeta);
    if (!Number.isFinite(valor)) return;
    
    if (IS_LOCALHOST) {
        setMaquinas((prev) => prev.map((m) => (m.nome === nomeMaquina ? { ...m, meta: valor } : m)));
        return;
    }

    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    if (!maq?.id) return;
    
    // Optimistic update
    setMaquinas((prev) => prev.map((m) => (m.nome === nomeMaquina ? { ...m, meta: valor } : m)));
    
    try {
        await updateDoc(doc(db, 'global_maquinas', maq.id), { meta: valor });
    } catch (error) {
        console.error("Erro meta", error);
    }
  };

  const handleUpdateUnidade = async (nomeMaquina, novaUnidade) => {
    if (!novaUnidade) return;

    if (IS_LOCALHOST) {
        setMaquinas((prev) => prev.map((m) => (m.nome === nomeMaquina ? { ...m, unidade: novaUnidade } : m)));
        return;
    }

    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    if (!maq?.id) return;

    // Optimistic
    setMaquinas((prev) => prev.map((m) => (m.nome === nomeMaquina ? { ...m, unidade: novaUnidade } : m)));

    try {
        await updateDoc(doc(db, 'global_maquinas', maq.id), { unidade: novaUnidade });
    } catch (error) {
        console.error("Erro unidade", error);
    }
  };

  const saveDiasUteisMes = async (dias) => {
    const d = Number(dias);
    if (!Number.isFinite(d) || d <= 0) return;
    
    if (IS_LOCALHOST) {
        setConfig((prev) => ({ ...prev, diasUteis: d }));
        return;
    }

    setConfig((prev) => ({ ...prev, diasUteis: d })); // Optimistic

    try {
        await setDoc(doc(db, 'global_config_mensal', mesRef), { diasUteis: d, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
        console.error("Erro dias uteis", error);
    }
  };

  // ===== Export PDF =====
  const exportPDFPorMaquina = async () => {
    if (exportando) return;
    if (!chartExportRef.current) return alert('Gráfico não encontrado.');
    if (maquinas.length === 0) return alert('Sem máquinas para exportar.');

    setExportando(true);
    const filtroOriginal = filtroMaquina;

    try {
      const pdf = new jsPDF('landscape', 'pt', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < maquinas.length; i++) {
        const nome = maquinas[i].nome;
        setProgressoExport(`Gerando página ${i + 1} de ${maquinas.length}: ${nome}`);
        
        setFiltroMaquina(nome);
        await sleep(250); 
        await new Promise(requestAnimationFrame);

        const canvas = await html2canvas(chartExportRef.current, {
          backgroundColor: '#09090b',
          scale: 2,
          useCORS: true,
          logging: false
        });

        const imgData = canvas.toDataURL('image/png', 0.8);
        const imgW = pageW;
        const imgH = (canvas.height * imgW) / canvas.width;
        
        let finalW = imgW;
        let finalH = imgH;
        if (imgH > pageH) {
            finalH = pageH;
            finalW = (canvas.width * finalH) / canvas.height;
        }

        const x = (pageW - finalW) / 2;
        const y = (pageH - finalH) / 2;

        if (i > 0) pdf.addPage();
        
        pdf.setFillColor(9, 9, 11);
        pdf.rect(0, 0, pageW, pageH, 'F');
        pdf.addImage(imgData, 'PNG', x, y, finalW, finalH);
        
        pdf.setTextColor(150);
        pdf.setFontSize(8);
        pdf.text(`Relatório Gerado em ${new Date().toLocaleDateString()} | Máquina: ${nome}`, 20, pageH - 20);
      }

      pdf.save(`Relatorio_Producao_${mesRef}.pdf`);
    } catch (err) {
      console.error('Erro exportando PDF:', err);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setFiltroMaquina(filtroOriginal);
      setExportando(false);
      setProgressoExport('');
    }
  };

  const lancamentosMostrados = filtroMaquina === 'TODAS' ? lancamentos : lancamentos.filter((l) => l.maquina === filtroMaquina);

  // Responsive bar size
  const barSize = useMemo(() => {
    const n = (dadosGrafico?.dados?.length || 0);
    if (n <= 6) return 80;
    if (n <= 10) return 60;
    if (n <= 16) return 40;
    return 28;
  }, [dadosGrafico]);

  return (
    <div className="w-full h-screen overflow-y-auto bg-[#09090b] text-zinc-100 font-sans selection:bg-blue-500/30 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
      
      {/* OVERLAY DE EXPORTAÇÃO (LOADING) */}
      {exportando && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Gerando Relatório PDF</h2>
            <p className="text-zinc-400 text-sm animate-pulse">{progressoExport}</p>
        </div>
      )}

      {/* HEADER STICKY */}
      <div className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-800 shadow-sm">
        <div className="w-full max-w-[1920px] mx-auto px-4 md:px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-600/20">
                <BarChart3 className="text-blue-500" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight text-zinc-100 leading-none">Acompanhamento Global</h1>
              <p className="text-zinc-500 text-[11px] font-medium tracking-wide mt-1">Painel de Controle Integrado</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 items-center">
            {/* SELECT MÊS */}
            <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-md px-2">
                <span className="text-xs text-zinc-500 mr-2 font-bold">PERÍODO</span>
                <select
                    value={mesRef}
                    onChange={(e) => setMesRef(e.target.value)}
                    className="bg-transparent text-zinc-200 py-1.5 text-sm font-semibold focus:outline-none cursor-pointer uppercase min-w-[120px]"
                >
                    {opcoesMes.map((k) => (
                    <option key={k} value={k} className="bg-zinc-900 text-zinc-300">
                        {monthLabel(k)}
                    </option>
                    ))}
                </select>
            </div>

            {/* FILTRO MÁQUINAS */}
            <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-md px-2">
                <Filter className="text-zinc-500 mr-2" size={14} />
                <select
                    value={filtroMaquina}
                    onChange={(e) => setFiltroMaquina(e.target.value)}
                    className="bg-transparent text-zinc-200 py-1.5 text-sm font-semibold focus:outline-none cursor-pointer uppercase min-w-[140px]"
                >
                    <option value="TODAS" className="bg-zinc-900">Todas as Máquinas</option>
                    {maquinas.map((m) => (
                    <option key={m.id || m.nome} value={m.nome} className="bg-zinc-900">{m.nome}</option>
                    ))}
                </select>
            </div>

            <div className="h-6 w-px bg-zinc-800 mx-1 hidden md:block"></div>

            <button
              onClick={exportPDFPorMaquina}
              disabled={exportando || maquinas.length === 0}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all border ${
                exportando || maquinas.length === 0
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-100 text-zinc-950 border-white hover:bg-zinc-200 shadow-lg shadow-white/5'
              }`}
            >
              <FileText size={14} />
              {exportando ? 'Processando...' : 'Relatório PDF'}
            </button>

            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-md transition-all border ${
                showConfig ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200'
              }`}
              title="Configurações"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONFIGURAÇÃO (DRAWER) */}
      <div className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-[#0c0c0e] border-b border-zinc-800 ${showConfig ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="max-w-[1920px] mx-auto p-6">
          <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-2">
            <Settings className="text-blue-500" size={18} />
            <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Parâmetros do Processo</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CALENDÁRIO */}
            <div className="lg:col-span-3 bg-zinc-900/50 p-5 border border-zinc-800 rounded-xl">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-4">Configuração de Período</h3>
              
              <div className="flex items-center justify-between mb-4">
                 <span className="text-sm text-zinc-400">Mês de Referência</span>
                 <span className="text-sm text-white font-bold uppercase bg-zinc-800 px-2 py-1 rounded">{monthLabel(mesRef)}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">Dias Úteis</label>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={config.diasUteis}
                        onChange={(e) => setConfig({ ...config, diasUteis: Number(e.target.value) })}
                        onBlur={(e) => saveDiasUteisMes(e.target.value)}
                        className="w-full bg-black border border-zinc-700 text-white p-2 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-center"
                    />
                    <button
                        onClick={() => saveDiasUteisMes(config.diasUteis)}
                        className="bg-blue-600 text-white px-4 rounded font-bold uppercase text-xs hover:bg-blue-500 transition-colors"
                    >
                        Salvar
                    </button>
                </div>
                <p className="text-[10px] text-zinc-600 pt-1">* Afeta o cálculo da meta mensal apenas deste mês.</p>
              </div>
            </div>

            {/* TABELA MÁQUINAS */}
            <div className="lg:col-span-9 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-black/40 text-zinc-500 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Máquina</th>
                      <th className="px-6 py-3 text-center">Unidade Medida</th>
                      <th className="px-6 py-3 text-right">Meta Diária</th>
                      <th className="px-6 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {maquinas.map((m) => (
                      <tr key={m.id || m.nome} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-2 font-medium text-zinc-200">{m.nome}</td>
                        <td className="px-6 py-2 text-center">
                          <div className="relative inline-block w-32">
                            <select
                              value={m.unidade}
                              onChange={(e) => handleUpdateUnidade(m.nome, e.target.value)}
                              className="w-full bg-black border border-zinc-700 text-zinc-300 text-xs rounded py-1 px-2 appearance-none focus:border-blue-500 outline-none"
                            >
                              <option value="pç">Peças (pç)</option>
                              <option value="kg">Quilos (kg)</option>
                              <option value="m">Metros (m)</option>
                              <option value="cx">Caixas (cx)</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-2">
                          <input
                            type="number"
                            value={m.meta}
                            onChange={(e) => handleUpdateMeta(m.nome, e.target.value)}
                            className="w-full bg-transparent text-right font-mono text-zinc-300 focus:text-white outline-none border-b border-transparent focus:border-blue-500 transition-colors"
                          />
                        </td>
                        <td className="px-6 py-2 text-right">
                          <button onClick={() => handleRemoveMaquina(m.nome)} className="text-zinc-600 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-500/10">
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* ADD ROW */}
              <div className="p-3 bg-black/20 border-t border-zinc-800 flex gap-3 items-center mt-auto">
                <input
                    type="text"
                    placeholder="Nome da Nova Máquina"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm outline-none text-white focus:border-blue-500 transition-colors"
                    value={inputNomeMaquina}
                    onChange={(e) => setInputNomeMaquina(e.target.value)}
                />
                <select
                    className="w-24 bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm outline-none text-zinc-300 focus:border-blue-500"
                    value={inputUnidadeMaquina}
                    onChange={(e) => setInputUnidadeMaquina(e.target.value)}
                >
                    <option value="pç">Pç</option>
                    <option value="kg">Kg</option>
                    <option value="m">m</option>
                    <option value="cx">Cx</option>
                </select>
                <input
                    type="number"
                    placeholder="Meta"
                    className="w-24 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm outline-none text-white focus:border-blue-500 text-right"
                    value={inputMetaMaquina}
                    onChange={(e) => setInputMetaMaquina(e.target.value)}
                />
                <button
                    onClick={handleAddMaquina}
                    disabled={!inputNomeMaquina}
                    className="bg-zinc-100 text-zinc-950 px-5 py-2 text-xs font-bold uppercase rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAINEL PRINCIPAL */}
      <div className="w-full max-w-[1920px] mx-auto mt-6 px-4 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        
        {/* COLUNA ESQUERDA (CONTROLES E LISTA) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* CARD DE REGISTRO */}
          <div className="bg-zinc-900 border border-zinc-800 shadow-xl rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 bg-zinc-800/30 flex items-center gap-2">
                <PlusCircle className="text-green-500" size={16} />
                <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Novo Apontamento</h2>
            </div>
            
            <form onSubmit={handleAddLancamento} className="p-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Máquina</label>
                <select
                  className="w-full p-2.5 bg-black border border-zinc-700 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none text-white text-sm transition-all"
                  value={novaMaquinaForm}
                  onChange={(e) => setNovaMaquinaForm(e.target.value)}
                  disabled={maquinas.length === 0}
                >
                  {maquinas.length === 0 && <option value="">Cadastre máquinas primeiro</option>}
                  {maquinas.map((m) => (
                    <option key={m.id || m.nome} value={m.nome}>{m.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Data</label>
                  <input
                    type="date"
                    className="w-full p-2.5 bg-black border border-zinc-700 rounded-lg focus:border-blue-500 outline-none text-white text-sm"
                    value={novoDiaISO}
                    onChange={(e) => setNovoDiaISO(e.target.value)}
                    disabled={maquinas.length === 0}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide truncate">
                    Qtd ({getUnidadeAtual(novaMaquinaForm)})
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full p-2.5 bg-black border border-zinc-700 rounded-lg focus:border-blue-500 outline-none text-white font-mono font-bold text-right"
                    value={novoValor}
                    onChange={(e) => setNovoValor(e.target.value)}
                    disabled={maquinas.length === 0}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={maquinas.length === 0 || !novoDiaISO || !novoValor}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 uppercase text-xs rounded-lg transition-all flex justify-center gap-2 items-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
              >
                <Save size={14} /> Salvar Produção
              </button>
            </form>
          </div>

          {/* LISTA RECENTES (Flex-grow para ocupar espaço) */}
          <div className="bg-zinc-900 border border-zinc-800 shadow-xl rounded-xl flex flex-col flex-1 min-h-[400px] overflow-hidden">
            <div className="p-3 bg-zinc-800/30 border-b border-zinc-800 flex justify-between items-center">
              <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-zinc-500"></div> Histórico
              </span>
              <span className="text-[10px] font-mono bg-black border border-zinc-700 px-2 py-0.5 text-zinc-300 rounded-md">
                {lancamentosMostrados.length} regs
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="bg-black/20 text-[10px] text-zinc-500 font-bold uppercase sticky top-0 backdrop-blur-sm z-10">
                  <tr>
                    <th className="px-4 py-2 text-left">Dia</th>
                    <th className="px-2 py-2 text-left">Maq</th>
                    <th className="px-4 py-2 text-right">Qtd</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-800/50">
                  {lancamentosMostrados.map((l) => (
                    <tr key={l.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="px-4 py-2.5 font-medium text-zinc-300 text-xs">{l.dia}</td>
                      <td className="px-2 py-2.5 text-[11px] text-zinc-500 truncate max-w-[80px] group-hover:text-zinc-300 transition-colors">{l.maquina}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-200 text-xs">
                        {Number(l.real || 0).toLocaleString('pt-BR')}
                        <span className="text-[9px] text-zinc-600 ml-1 font-normal">{getUnidadeAtual(l.maquina)}</span>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteLancamento(l.id)}
                          className="text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lancamentosMostrados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-zinc-600">
                            <Box size={24} className="mb-2 opacity-50"/>
                            <span className="text-xs">Sem lançamentos</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (GRÁFICO) - CORRIGIDO LAYOUT (min-w-0) */}
        <div className="lg:col-span-9 flex flex-col min-h-[600px] min-w-0">
          <div
            ref={chartExportRef}
            className="bg-zinc-900 border border-zinc-800 shadow-xl rounded-xl flex-1 flex flex-col relative overflow-hidden"
          >
            {/* LINHA DECORATIVA TOPO */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-500 to-orange-500 opacity-80"></div>

            {/* HEADER GRÁFICO */}
            <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-b from-zinc-800/20 to-transparent">
              <div>
                <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="text-blue-500" size={20} />
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">Performance Global</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                        {filtroMaquina === 'TODAS' ? 'Visão Geral' : filtroMaquina}
                    </span>
                </div>
                
                <div className="flex gap-6 text-xs">
                    <div>
                        <span className="text-zinc-500 font-bold uppercase block text-[10px] mb-0.5">Meta Diária</span>
                        <span className="text-zinc-200 font-mono text-sm">
                            {Number(dadosGrafico.metaDiariaAtiva || 0).toLocaleString('pt-BR')} <span className="text-zinc-600 text-[10px]">{dadosGrafico.unidadeAtiva}</span>
                        </span>
                    </div>
                    <div className="w-px bg-zinc-700 h-8 self-center"></div>
                    <div>
                        <span className="text-zinc-500 font-bold uppercase block text-[10px] mb-0.5">Meta Mensal</span>
                        <span className="text-zinc-200 font-mono text-sm">
                            {Number(dadosGrafico.metaTotalMes || 0).toLocaleString('pt-BR')} <span className="text-zinc-600 text-[10px]">{dadosGrafico.unidadeAtiva}</span>
                        </span>
                    </div>
                </div>
              </div>

              <div className="text-right bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Projeção de Fechamento</p>
                <div className="flex items-baseline justify-end gap-2">
                  <span
                    className={`text-3xl font-black tracking-tighter ${
                      dadosGrafico.projetadoValor >= dadosGrafico.metaTotalMes ? 'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                    }`}
                  >
                    {Number(dadosGrafico.projetadoValor || 0).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs text-zinc-500 font-bold uppercase">{dadosGrafico.unidadeAtiva}</span>
                </div>
              </div>
            </div>

            {/* GRÁFICO */}
            <div className="flex-1 w-full relative min-h-[450px] p-4 bg-[#09090b]">
              {maquinas.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-zinc-600 gap-4">
                  <BarChart3 size={48} className="opacity-20" />
                  <p className="text-sm font-medium">Cadastre máquinas e registre produção para visualizar os dados.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dadosGrafico.dados}
                    margin={{ top: 60, right: 20, left: 10, bottom: 20 }}
                    barCategoryGap={20}
                  >
                    <defs>
                        <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8}/>
                        </linearGradient>
                        <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#c2410c" stopOpacity={0.8}/>
                        </linearGradient>
                    </defs>
                    
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />

                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#71717a', fontSize: 11, fontWeight: '600' }}
                      dy={15}
                      interval={0}
                    />

                    <YAxis hide domain={[0, 'auto']} />

                    <Tooltip
                      cursor={{ fill: '#27272a', opacity: 0.4 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          const isProj = d.tipo === 'projetado';
                          return (
                            <div className="bg-zinc-950 border border-zinc-700 p-3 shadow-2xl rounded-lg min-w-[140px]">
                              <div className="font-bold uppercase text-[10px] text-zinc-500 mb-2 border-b border-zinc-800 pb-1 tracking-wider">
                                {isProj ? 'Previsão Final' : `Dia ${d.name}`}
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Realizado</span>
                                    <span className="text-white font-mono font-bold">{Number(d.realOriginal || 0).toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Meta</span>
                                    <span className="text-zinc-500 font-mono">{Number(d.metaOriginal || 0).toLocaleString('pt-BR')}</span>
                                </div>
                                <div className={`pt-2 mt-1 border-t border-zinc-800 text-xs font-bold flex justify-between ${d.performance >= 100 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    <span>Atingimento</span>
                                    <span>{Number(d.performance || 0).toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    <Bar dataKey="valorPlotado" barSize={barSize} radius={[4, 4, 0, 0]}>
                      {dadosGrafico.dados.map((entry, index) => (
                        <Cell 
                            key={`cell-${index}`} 
                            fill={entry.tipo === 'projetado' ? 'url(#colorProj)' : 'url(#colorReal)'} 
                            stroke={entry.tipo === 'projetado' ? '#fb923c' : '#60a5fa'}
                            strokeWidth={1}
                            strokeOpacity={0.3}
                        />
                      ))}
                      <LabelList content={renderCustomizedLabel} />
                    </Bar>

                    <Line
                      type="monotone"
                      dataKey="metaPlotada"
                      stroke="#fbbf24"
                      strokeWidth={3}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                      opacity={0.8}
                    />

                    <ReferenceLine
                      y={100}
                      label={{ 
                          position: 'right', 
                          value: 'META 100%', 
                          fill: '#fbbf24', 
                          fontSize: 10, 
                          fontWeight: 'bold', 
                          dy: -10 
                      }}
                      stroke="#fbbf24"
                      strokeOpacity={0.5}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* LEGENDA FOOTER */}
            <div className="bg-zinc-950 border-t border-zinc-800 p-3 flex justify-center gap-8 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded-sm"></div> Realizado
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-sm"></div> Projeção
              </div>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 bg-amber-400 border-t border-dashed border-amber-400"></div> Meta (100%)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalScreen;