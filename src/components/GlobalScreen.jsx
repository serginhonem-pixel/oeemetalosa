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
} from 'lucide-react';

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

import PptxGenJS from 'pptxgenjs';
import html2canvas from 'html2canvas';

import { db } from '../services/firebase';

/**
 * Firestore Collections:
 * - global_maquinas
 * - global_lancamentos
 * - global_config_mensal (docId = YYYY-MM) { diasUteis }
 */

// Helpers mês
const pad2 = (n) => String(n).padStart(2, '0');
const toYYYYMM = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
function monthLabel(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
function firstDayISO(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  return `${y}-${pad2(m)}-01`;
}
function lastDayISO(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${pad2(m)}-${pad2(last)}`;
}
function isoToDiaLabel(iso, mesRef) {
  // iso: YYYY-MM-DD -> "DD/mmm" (pt-BR) usando mesRef como referência
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const mon = dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${pad2(d)}/${mon}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GlobalScreen = () => {
  // ====== MÊS ATIVO ======
  const [mesRef, setMesRef] = useState(() => toYYYYMM(new Date()));

  // meses no select
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

  // ====== CONFIG MENSAL ======
  const [config, setConfig] = useState({ diasUteis: 22 });

  // ====== DADOS ======
  const [maquinas, setMaquinas] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);

  // ====== UI / FORMS ======
  const [showConfig, setShowConfig] = useState(false);
  const [filtroMaquina, setFiltroMaquina] = useState('TODAS');
  const [novaMaquinaForm, setNovaMaquinaForm] = useState('');

  // data agora é ISO (YYYY-MM-DD)
  const [novoDiaISO, setNovoDiaISO] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  });
  const [novoValor, setNovoValor] = useState('');

  const [inputNomeMaquina, setInputNomeMaquina] = useState('');
  const [inputMetaMaquina, setInputMetaMaquina] = useState(100);
  const [inputUnidadeMaquina, setInputUnidadeMaquina] = useState('pç');

  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [erroFirebase, setErroFirebase] = useState('');

  // ref do container do gráfico (pra print no pptx)
  const chartCaptureRef = useRef(null);

  const toast = (msg, ms = 1800) => {
    setStatusMsg(msg);
    if (ms) setTimeout(() => setStatusMsg(''), ms);
  };

  // ====== Firebase: CONFIG MENSAL ======
  useEffect(() => {
    setErroFirebase('');
    const cfgRef = doc(db, 'global_config_mensal', mesRef);

    const unsub = onSnapshot(
      cfgRef,
      (snap) => {
        if (!snap.exists()) {
          setConfig({ diasUteis: 22 });
          return;
        }
        const data = snap.data();
        setConfig({ diasUteis: Number(data?.diasUteis) || 22 });
      },
      (err) => {
        console.error('[Firestore] Config mensal erro:', err);
        setErroFirebase(`${err.code || 'erro'}: ${err.message || 'Falha ao ler config mensal'}`);
      }
    );

    return () => unsub();
  }, [mesRef]);

  // ====== Firebase: MÁQUINAS ======
  useEffect(() => {
    setErroFirebase('');
    const qMaq = query(collection(db, 'global_maquinas'), orderBy('nome', 'asc'));

    const unsub = onSnapshot(
      qMaq,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMaquinas(arr);
      },
      (err) => {
        console.error('[Firestore] Máquinas erro:', err);
        setErroFirebase(`${err.code || 'erro'}: ${err.message || 'Falha ao ler máquinas'}`);
      }
    );

    return () => unsub();
  }, []);

  // ====== Firebase: LANÇAMENTOS (com fallback se índice faltar) ======
  useEffect(() => {
    setErroFirebase('');

    // Query ideal (precisa índice composto: mesRef + createdAt desc)
    const qLancIdeal = query(
      collection(db, 'global_lancamentos'),
      where('mesRef', '==', mesRef),
      orderBy('createdAt', 'desc'),
      limit(800)
    );

    // Query fallback (sem orderBy) — funciona sem índice, mas ordena no front
    const qLancFallback = query(
      collection(db, 'global_lancamentos'),
      where('mesRef', '==', mesRef),
      limit(800)
    );

    let unsub = null;

    const subscribeIdeal = () =>
      onSnapshot(
        qLancIdeal,
        (snap) => {
          const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setLancamentos(
            arr.map((x) => ({
              ...x,
              real: Number(x.real) || 0,
            }))
          );
        },
        (err) => {
          console.error('[Firestore] Lançamentos (ideal) erro:', err);
          // Se for índice faltando / precondition, cai pro fallback
          const code = err?.code || '';
          const msg = err?.message || '';
          const likelyIndex = code.includes('failed-precondition') || msg.toLowerCase().includes('index');
          if (likelyIndex) {
            setErroFirebase(
              `Faltando índice no Firestore (global_lancamentos: mesRef + createdAt desc). Usando modo fallback.`
            );
            if (unsub) unsub();
            unsub = onSnapshot(
              qLancFallback,
              (snap2) => {
                const arr2 = snap2.docs
                  .map((d) => ({ id: d.id, ...d.data() }))
                  .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setLancamentos(
                  arr2.map((x) => ({
                    ...x,
                    real: Number(x.real) || 0,
                  }))
                );
              },
              (err2) => {
                console.error('[Firestore] Lançamentos (fallback) erro:', err2);
                setErroFirebase(`${err2.code || 'erro'}: ${err2.message || 'Falha ao ler lançamentos'}`);
              }
            );
          } else {
            setErroFirebase(`${code || 'erro'}: ${msg || 'Falha ao ler lançamentos'}`);
          }
        }
      );

    unsub = subscribeIdeal();
    return () => {
      if (unsub) unsub();
    };
  }, [mesRef]);

  // ====== garantir selects coerentes ======
  useEffect(() => {
    // se não tem máquina, zera selects mas mantém tela
    if (maquinas.length === 0) {
      setNovaMaquinaForm('');
      if (filtroMaquina !== 'TODAS') setFiltroMaquina('TODAS');
      return;
    }

    // default do form
    if (!novaMaquinaForm) setNovaMaquinaForm(maquinas[0].nome);

    // se filtro aponta pra máquina removida, volta pra TODAS
    if (filtroMaquina !== 'TODAS') {
      const exists = maquinas.some((m) => m.nome === filtroMaquina);
      if (!exists) setFiltroMaquina('TODAS');
    }
  }, [maquinas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (filtroMaquina !== 'TODAS') setNovaMaquinaForm(filtroMaquina);
  }, [filtroMaquina]);

  // ====== helper unidade ======
  const getUnidadeAtual = (nomeMaquina) => {
    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    return maq ? maq.unidade : '';
  };

  // ====== CÁLCULO DO GRÁFICO ======
  const dadosGrafico = useMemo(() => {
    const diasUteis = Number(config.diasUteis) || 22;

    let metaDiariaAtiva = 0;
    let unidadeAtiva = 'un';

    if (filtroMaquina === 'TODAS') {
      // soma metas, mas atenção: se unidades diferentes, fica “agregado”
      metaDiariaAtiva = maquinas.reduce((acc, m) => acc + (Number(m.meta) || 0), 0);

      const todasMesmaUnidade =
        maquinas.length > 0 && maquinas.every((m) => m.unidade === maquinas[0].unidade);
      if (maquinas.length > 0 && todasMesmaUnidade) unidadeAtiva = maquinas[0].unidade;
      else unidadeAtiva = 'mix';
    } else {
      const maq = maquinas.find((m) => m.nome === filtroMaquina);
      metaDiariaAtiva = maq ? Number(maq.meta) || 0 : 0;
      unidadeAtiva = maq ? maq.unidade : 'un';
    }

    const metaTotalMes = metaDiariaAtiva * diasUteis;

    const lancFiltrados =
      filtroMaquina === 'TODAS' ? lancamentos : lancamentos.filter((l) => l.maquina === filtroMaquina);

    const agrupadoPorDia = lancFiltrados.reduce((acc, curr) => {
      if (!acc[curr.dia]) acc[curr.dia] = 0;
      acc[curr.dia] += Number(curr.real) || 0;
      return acc;
    }, {});

    const diasUnicos = Object.keys(agrupadoPorDia);
    const totalProduzido = lancFiltrados.reduce((acc, curr) => acc + (Number(curr.real) || 0), 0);

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
      name: 'PROJETADO',
      realOriginal: projetadoValor,
      metaOriginal: metaTotalMes,
      valorPlotado: performanceProjetada,
      metaPlotada: 100,
      tipo: 'projetado',
      performance: performanceProjetada,
      unidade: unidadeAtiva,
    });

    const atingimentoMes = metaTotalMes > 0 ? (totalProduzido / metaTotalMes) * 100 : 0;
    const gap = Math.max(metaTotalMes - totalProduzido, 0);

    return {
      dados: dadosProcessados,
      totalProduzido,
      projetadoValor,
      metaTotalMes,
      metaDiariaAtiva,
      unidadeAtiva,
      atingimentoMes,
      gap,
      diasUteis,
    };
  }, [lancamentos, config, maquinas, filtroMaquina]);

  // ====== Label ======
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
      <g>
        <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y - 10} stroke="#52525b" strokeWidth="2" />
        <rect x={x + width / 2 - 35} y={y - 45} width="70" height="35" fill={corBox} rx="4" stroke={corBorda} strokeWidth="2" />
        <text x={x + width / 2} y={y - 23} fill={corTexto} textAnchor="middle" fontSize={13} fontWeight="bold">
          {icone} {performance.toFixed(0)}%
        </text>
      </g>
    );
  };

  // ====== ACTIONS ======
  const saveDiasUteisMes = async (dias) => {
    const d = Number(dias);
    if (!Number.isFinite(d) || d <= 0) return;

    try {
      setBusy(true);
      await setDoc(
        doc(db, 'global_config_mensal', mesRef),
        { diasUteis: d, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast('Dias úteis salvos ✅');
    } catch (e) {
      console.error('Erro ao salvar dias úteis:', e);
      toast('Erro ao salvar dias úteis ❌', 2500);
    } finally {
      setBusy(false);
    }
  };

  const handleAddLancamento = async (e) => {
    e.preventDefault();
    if (!novoDiaISO || !novoValor) return;

    if (maquinas.length === 0) {
      toast('Cadastre uma máquina primeiro.', 2500);
      return;
    }

    // valida data dentro do mês selecionado
    const min = firstDayISO(mesRef);
    const max = lastDayISO(mesRef);
    if (novoDiaISO < min || novoDiaISO > max) {
      toast(`Data fora do mês selecionado (${monthLabel(mesRef)}).`, 2600);
      return;
    }

    const maqFinal = novaMaquinaForm || maquinas[0].nome;

    try {
      setBusy(true);
      await addDoc(collection(db, 'global_lancamentos'), {
        dia: isoToDiaLabel(novoDiaISO, mesRef),
        diaISO: novoDiaISO, // guarda ISO pra futuro (melhor)
        real: Number(novoValor),
        maquina: maqFinal,
        mesRef,
        createdAt: serverTimestamp(),
      });
      setNovoValor('');
      toast('Lançamento salvo ✅');
    } catch (e2) {
      console.error('Erro ao salvar lançamento:', e2);
      toast('Erro ao salvar lançamento ❌', 2500);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLancamento = async (id) => {
    if (!id) return;
    try {
      setBusy(true);
      await deleteDoc(doc(db, 'global_lancamentos', id));
      toast('Lançamento apagado ✅');
    } catch (e) {
      console.error('Erro ao apagar lançamento:', e);
      toast('Erro ao apagar ❌', 2500);
    } finally {
      setBusy(false);
    }
  };

  const handleAddMaquina = async () => {
    if (!inputNomeMaquina.trim()) return;

    if (maquinas.some((m) => m.nome === inputNomeMaquina.trim())) {
      toast('Máquina já existe!', 2200);
      return;
    }

    try {
      setBusy(true);
      await addDoc(collection(db, 'global_maquinas'), {
        nome: inputNomeMaquina.trim(),
        meta: Number(inputMetaMaquina),
        unidade: inputUnidadeMaquina,
        createdAt: serverTimestamp(),
      });

      setInputNomeMaquina('');
      setInputMetaMaquina(100);
      setInputUnidadeMaquina('pç');
      toast('Máquina adicionada ✅');
    } catch (e) {
      console.error('Erro ao criar máquina:', e);
      toast('Erro ao criar máquina ❌', 2500);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMaquina = async (nomeParaRemover) => {
    const maq = maquinas.find((m) => m.nome === nomeParaRemover);
    if (!maq?.id) return;

    try {
      setBusy(true);
      await deleteDoc(doc(db, 'global_maquinas', maq.id));
      toast('Máquina removida ✅');
    } catch (e) {
      console.error('Erro ao remover máquina:', e);
      toast('Erro ao remover máquina ❌', 2500);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateMeta = async (nomeMaquina, novaMeta) => {
    const valor = Number(novaMeta);
    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    if (!maq?.id) return;

    try {
      await updateDoc(doc(db, 'global_maquinas', maq.id), { meta: valor });
    } catch (e) {
      console.error('Erro update meta:', e);
      toast('Erro ao atualizar meta ❌', 2200);
    }
  };

  const handleUpdateUnidade = async (nomeMaquina, novaUnidade) => {
    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    if (!maq?.id) return;

    try {
      await updateDoc(doc(db, 'global_maquinas', maq.id), { unidade: novaUnidade });
    } catch (e) {
      console.error('Erro update unidade:', e);
      toast('Erro ao atualizar unidade ❌', 2200);
    }
  };

  // ====== EXPORT PPTX ======
  const captureChartPNG = async () => {
    const el = chartCaptureRef.current;
    if (!el) throw new Error('chartCaptureRef não encontrado');
    const canvas = await html2canvas(el, {
      backgroundColor: '#09090b',
      scale: 2,
      useCORS: true,
    });
    return canvas.toDataURL('image/png');
  };

  const addSlideForMachine = async (pptx, machineName) => {
    // seta filtro pra máquina e espera render
    setFiltroMaquina(machineName);
    await sleep(250);
    await new Promise((r) => requestAnimationFrame(r));
    await sleep(80);

    const img = await captureChartPNG();

    const maq = maquinas.find((m) => m.nome === machineName);
    const unidade = maq?.unidade || '';
    const metaDia = Number(maq?.meta || 0);
    const diasUteis = Number(config.diasUteis || 22);
    const metaMes = metaDia * diasUteis;

    // calcula real do mês dessa máquina
    const lancMaq = lancamentos.filter((l) => l.maquina === machineName);
    const realMes = lancMaq.reduce((acc, x) => acc + (Number(x.real) || 0), 0);
    const ating = metaMes > 0 ? (realMes / metaMes) * 100 : 0;

    const slide = pptx.addSlide();
    slide.addText(`Performance – ${machineName}`, { x: 0.5, y: 0.25, w: 12.3, h: 0.4, fontSize: 24, bold: true, color: 'FFFFFF' });
    slide.addText(`Mês: ${monthLabel(mesRef)} | Dias úteis: ${diasUteis}`, { x: 0.5, y: 0.7, w: 12.3, h: 0.3, fontSize: 12, color: 'BDBDBD' });

    slide.addText(`Meta diária: ${metaDia.toLocaleString('pt-BR')} ${unidade}`, { x: 0.5, y: 1.05, w: 4.4, h: 0.3, fontSize: 12, color: 'FFFFFF' });
    slide.addText(`Meta mensal: ${metaMes.toLocaleString('pt-BR')} ${unidade}`, { x: 0.5, y: 1.35, w: 4.4, h: 0.3, fontSize: 12, color: 'FFFFFF' });
    slide.addText(`Real mês: ${realMes.toLocaleString('pt-BR')} ${unidade}`, { x: 0.5, y: 1.65, w: 4.4, h: 0.3, fontSize: 12, color: 'FFFFFF' });
    slide.addText(`Atingimento: ${ating.toFixed(1)}%`, { x: 0.5, y: 1.95, w: 4.4, h: 0.3, fontSize: 12, color: 'FFFFFF' });

    // gráfico (print)
    slide.addImage({ data: img, x: 5.1, y: 1.05, w: 8.7, h: 5.2 });
  };

  const exportPPTX = async ({ incluirResumo }) => {
    if (maquinas.length === 0) return toast('Sem máquinas para exportar.', 2500);

    try {
      setBusy(true);
      toast('Gerando PPTX...', 0);

      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = 'GlobalScreen';

      const filtroOriginal = filtroMaquina;

      if (incluirResumo) {
        // Slide resumo (filtro TODAS)
        setFiltroMaquina('TODAS');
        await sleep(250);
        await new Promise((r) => requestAnimationFrame(r));
        await sleep(80);

        const img = await captureChartPNG();

        const slide = pptx.addSlide();
        slide.addText(`Resumo Global`, { x: 0.5, y: 0.25, w: 12.3, h: 0.4, fontSize: 26, bold: true, color: 'FFFFFF' });
        slide.addText(`Mês: ${monthLabel(mesRef)} | Dias úteis: ${dadosGrafico.diasUteis}`, { x: 0.5, y: 0.7, w: 12.3, h: 0.3, fontSize: 12, color: 'BDBDBD' });

        slide.addText(`Total produzido: ${dadosGrafico.totalProduzido.toLocaleString('pt-BR')} ${dadosGrafico.unidadeAtiva}`, { x: 0.5, y: 1.05, w: 6, h: 0.3, fontSize: 12, color: 'FFFFFF' });
        slide.addText(`Meta mensal: ${dadosGrafico.metaTotalMes.toLocaleString('pt-BR')} ${dadosGrafico.unidadeAtiva}`, { x: 0.5, y: 1.35, w: 6, h: 0.3, fontSize: 12, color: 'FFFFFF' });
        slide.addText(`Atingimento: ${dadosGrafico.atingimentoMes.toFixed(1)}%`, { x: 0.5, y: 1.65, w: 6, h: 0.3, fontSize: 12, color: 'FFFFFF' });
        slide.addImage({ data: img, x: 0.5, y: 2.1, w: 13.0, h: 4.2 });
      }

      for (const m of maquinas) {
        await addSlideForMachine(pptx, m.nome);
      }

      // volta filtro
      setFiltroMaquina(filtroOriginal);

      await pptx.writeFile({ fileName: `Relatorio_Global_${mesRef}.pptx` });
      toast('PPTX baixado ✅');
    } catch (e) {
      console.error('Erro ao exportar PPTX:', e);
      toast('Erro ao exportar PPTX ❌', 2600);
    } finally {
      setBusy(false);
      setTimeout(() => setStatusMsg(''), 1200);
    }
  };

  // ====== UI ======
  const minISO = firstDayISO(mesRef);
  const maxISO = lastDayISO(mesRef);

  const lancamentosVisiveis =
    filtroMaquina === 'TODAS' ? lancamentos : lancamentos.filter((l) => l.maquina === filtroMaquina);

  return (
    <div className="w-full h-full overflow-auto p-4 md:p-6 bg-[#09090b] text-zinc-100">
      {/* Status/Toast */}
      {(statusMsg || erroFirebase) && (
        <div className="max-w-7xl mx-auto mb-3">
          {statusMsg && (
            <div className="mb-2 px-3 py-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm">
              {statusMsg}
            </div>
          )}
          {erroFirebase && (
            <div className="px-3 py-2 rounded border border-red-900/50 bg-red-950/20 text-red-200 text-sm">
              {erroFirebase}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="bg-zinc-900 text-white shadow-lg border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-zinc-100" size={28} />
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide text-zinc-100">Acompanhamento Global</h1>
              <p className="text-zinc-500 text-xs font-mono">Painel de Controle Integrado</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 bg-zinc-800 p-1 rounded border border-zinc-700 items-center">
            {/* SELECT MÊS */}
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

            <div className="w-px bg-zinc-600 mx-1 hidden md:block"></div>

            {/* FILTRO MÁQUINAS */}
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

            <div className="w-px bg-zinc-600 mx-1 hidden md:block"></div>

            {/* Export */}
            <button
              disabled={busy || maquinas.length === 0}
              onClick={() => exportPPTX({ incluirResumo: false })}
              className="flex items-center gap-2 px-3 py-1.5 rounded transition-all text-sm font-bold uppercase bg-zinc-950 border border-zinc-700 hover:bg-zinc-900 disabled:opacity-50"
              title="Baixar PPTX: 1 slide por máquina"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              PPTX (Máquinas)
            </button>

            <button
              disabled={busy || maquinas.length === 0}
              onClick={() => exportPPTX({ incluirResumo: true })}
              className="flex items-center gap-2 px-3 py-1.5 rounded transition-all text-sm font-bold uppercase bg-zinc-950 border border-zinc-700 hover:bg-zinc-900 disabled:opacity-50"
              title="Baixar PPTX: resumo + máquinas"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              PPTX (Resumo)
            </button>

            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all text-sm font-bold uppercase ${
                showConfig ? 'bg-zinc-100 text-zinc-900' : 'hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Settings size={16} /> Config
            </button>
          </div>
        </div>
      </div>

      {/* Config */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out bg-zinc-900 border-b border-zinc-800 ${
          showConfig ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="max-w-7xl mx-auto p-6">
          <h2 className="text-lg font-bold text-zinc-300 uppercase mb-4 border-b border-zinc-700 pb-2">
            Parâmetros do Processo
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendário */}
            <div className="bg-zinc-800 p-4 shadow-sm border border-zinc-700 rounded-lg">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Calendário</h3>

              <div className="text-xs text-zinc-500 mb-2">
                Mês ativo: <span className="text-zinc-200 font-bold uppercase">{monthLabel(mesRef)}</span>
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
                  disabled={busy}
                  onClick={() => saveDiasUteisMes(config.diasUteis)}
                  className="ml-auto bg-zinc-100 text-zinc-900 px-3 py-1.5 text-xs font-bold uppercase hover:bg-zinc-300 rounded disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>

              <div className="mt-2 text-[11px] text-zinc-500">
                * Esse valor é salvo no Firebase para <b>{mesRef}</b>.
              </div>

              <div className="mt-3 text-[11px] text-zinc-500">
                Dica: se lançar fora do mês, o app bloqueia.
              </div>
            </div>

            {/* Máquinas */}
            <div className="lg:col-span-2">
              <div className="bg-zinc-800 border border-zinc-700 shadow-sm rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-900 border-b border-zinc-700 text-zinc-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-2 font-bold">Máquina</th>
                      <th className="px-4 py-2 font-bold w-32 text-center">UM</th>
                      <th className="px-4 py-2 font-bold w-32 text-right">Meta Diária</th>
                      <th className="px-4 py-2 w-10"></th>
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
                              className="w-full bg-zinc-900 border border-zinc-600 text-zinc-200 font-bold rounded py-1 px-2 text-center appearance-none cursor-pointer hover:bg-zinc-950 transition-colors"
                            >
                              <option value="pç">Pç (Peças)</option>
                              <option value="kg">Kg (Quilos)</option>
                              <option value="m">m (Metros)</option>
                              <option value="cx">Cx (Caixas)</option>
                            </select>
                            <div className="absolute right-2 top-1.5 pointer-events-none text-zinc-500">
                              {m.unidade === 'kg' && <Scale size={14} />}
                              {m.unidade === 'm' && <Ruler size={14} />}
                              {m.unidade === 'cx' && <Box size={14} />}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={m.meta}
                            onChange={(e) => handleUpdateMeta(m.nome, e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-right font-mono text-white focus:border-zinc-500 outline-none"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            disabled={busy}
                            onClick={() => handleRemoveMaquina(m.nome)}
                            className="text-zinc-500 hover:text-red-400 disabled:opacity-50"
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

                {/* Add máquina */}
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
                    disabled={busy || !inputNomeMaquina.trim()}
                    className="bg-zinc-100 text-zinc-900 px-4 py-1.5 text-sm font-bold uppercase hover:bg-zinc-300 disabled:opacity-50 rounded"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Aviso índice */}
              <div className="mt-2 text-[11px] text-zinc-500">
                Se lançamentos não ordenarem direito, crie índice: <b>global_lancamentos (mesRef asc, createdAt desc)</b>.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto mt-6 px-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form + Lista */}
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
                  {maquinas.length === 0 && <option value="">Nenhuma máquina cadastrada</option>}
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
                    min={minISO}
                    max={maxISO}
                    className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded focus:border-zinc-500 outline-none text-white text-sm"
                    value={novoDiaISO}
                    onChange={(e) => setNovoDiaISO(e.target.value)}
                  />
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Permitido: {minISO} até {maxISO}
                  </div>
                </div>

                <div className="flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">
                    Qtd ({getUnidadeAtual(novaMaquinaForm)})
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full p-2 bg-zinc-950 border border-zinc-700 rounded focus:border-zinc-500 outline-none text-white font-bold text-right placeholder-zinc-600"
                    value={novoValor}
                    onChange={(e) => setNovoValor(e.target.value)}
                  />
                  <button
                    type="button"
                    className="mt-2 w-full text-xs uppercase font-bold bg-zinc-950 border border-zinc-700 rounded py-1.5 hover:bg-zinc-900"
                    onClick={() => {
                      const today = new Date();
                      const iso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
                      setNovoDiaISO(iso);
                      toast('Data: hoje ✅');
                    }}
                  >
                    Hoje
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || maquinas.length === 0}
                className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-bold py-2 uppercase text-sm shadow-lg rounded transition-colors flex justify-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar
              </button>
            </form>
          </div>

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
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {lancamentosVisiveis.map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-800/50">
                      <td className="px-3 py-2 font-medium text-zinc-300">{l.dia}</td>
                      <td className="px-3 py-2 text-xs text-zinc-500 truncate max-w-[90px]">{l.maquina}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-zinc-200">
                        {Number(l.real || 0).toLocaleString('pt-BR')}{' '}
                        <span className="text-[10px] text-zinc-500 font-normal">{getUnidadeAtual(l.maquina)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          disabled={busy}
                          onClick={() => handleDeleteLancamento(l.id)}
                          className="text-zinc-600 hover:text-red-400 disabled:opacity-50"
                          title="Apagar lançamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {lancamentosVisiveis.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                        Sem lançamentos para este filtro/mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="bg-zinc-900 p-4 border border-zinc-800 shadow-lg rounded-lg flex-1 flex-col min-h-[640px] border-t-4 border-t-yellow-600 flex">
            {/* KPIs */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-200 uppercase flex items-center gap-2">
                  <TrendingUp className="text-zinc-100" size={20} />
                  Performance: {filtroMaquina === 'TODAS' ? 'Geral' : filtroMaquina}
                </h3>

                <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-zinc-500 uppercase">
                  <span className="bg-zinc-950 border border-zinc-800 px-2 py-1 rounded">
                    Meta Diária:{' '}
                    <span className="text-zinc-200 text-sm">
                      {dadosGrafico.metaDiariaAtiva.toLocaleString('pt-BR')} {dadosGrafico.unidadeAtiva}
                    </span>
                  </span>

                  <span className="bg-zinc-950 border border-zinc-800 px-2 py-1 rounded">
                    Meta Mensal:{' '}
                    <span className="text-zinc-200 text-sm">
                      {dadosGrafico.metaTotalMes.toLocaleString('pt-BR')} {dadosGrafico.unidadeAtiva}
                    </span>
                  </span>

                  <span className="bg-zinc-950 border border-zinc-800 px-2 py-1 rounded">
                    Real mês:{' '}
                    <span className="text-zinc-200 text-sm">
                      {dadosGrafico.totalProduzido.toLocaleString('pt-BR')} {dadosGrafico.unidadeAtiva}
                    </span>
                  </span>

                  <span className="bg-zinc-950 border border-zinc-800 px-2 py-1 rounded">
                    Gap:{' '}
                    <span className="text-zinc-200 text-sm">
                      {dadosGrafico.gap.toLocaleString('pt-BR')} {dadosGrafico.unidadeAtiva}
                    </span>
                  </span>

                  {dadosGrafico.unidadeAtiva === 'mix' && (
                    <span className="bg-yellow-950/20 border border-yellow-900/40 px-2 py-1 rounded text-yellow-200">
                      Aviso: “TODAS” com unidades diferentes (mix)
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Projeção Final</p>
                <div className="flex items-center justify-end gap-2">
                  <span
                    className={`text-3xl font-black ${
                      dadosGrafico.projetadoValor >= dadosGrafico.metaTotalMes ? 'text-green-500' : 'text-orange-500'
                    }`}
                  >
                    {dadosGrafico.projetadoValor.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs text-zinc-500 font-bold self-end mb-1 uppercase">{dadosGrafico.unidadeAtiva}</span>
                </div>
              </div>
            </div>

            {/* Container capturável */}
            <div ref={chartCaptureRef} className="flex-1 w-full relative rounded-lg bg-zinc-950/30 border border-zinc-800 p-3">
              {maquinas.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                  Cadastre ao menos uma máquina para visualizar o gráfico.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dadosGrafico.dados} margin={{ top: 35, right: 30, left: 20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis
                      dataKey="name"
                      axisLine
                      tickLine
                      tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 'bold' }}
                      dy={10}
                      stroke="#3f3f46"
                    />
                    <YAxis hide domain={[0, 'auto']} />

                    <Tooltip
                      cursor={{ fill: '#27272a', opacity: 0.5 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-zinc-950 border border-zinc-700 p-2 shadow-xl text-xs rounded text-zinc-200">
                              <div className="font-bold uppercase mb-1 border-b border-zinc-800 pb-1 text-zinc-400">{d.name}</div>
                              <div>
                                Real:{' '}
                                <span className="text-white font-mono">{Number(d.realOriginal || 0).toLocaleString('pt-BR')}</span>{' '}
                                <span className="text-zinc-500">{d.unidade}</span>
                              </div>
                              <div>
                                Meta:{' '}
                                <span className="text-white font-mono">{Number(d.metaOriginal || 0).toLocaleString('pt-BR')}</span>{' '}
                                <span className="text-zinc-500">{d.unidade}</span>
                              </div>
                              <div className={`mt-1 ${d.performance >= 100 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}`}>
                                {Number(d.performance || 0).toFixed(1)}%
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    <Bar dataKey="valorPlotado" barSize={44}>
                      {dadosGrafico.dados.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.tipo === 'projetado' ? '#f97316' : '#2563eb'} />
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
                      label={{ position: 'right', value: '100%', fill: '#ca8a04', fontSize: 12, fontWeight: 'bold' }}
                      stroke="transparent"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-6 text-xs font-bold uppercase text-zinc-500 border-t border-zinc-800 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#2563eb] rounded-sm"></div> Realizado
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#f97316] rounded-sm"></div> Projeção
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 w-6 bg-[#eab308]"></div> Meta (100%)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalScreen;
