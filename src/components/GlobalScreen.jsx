import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  Area,
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
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
  BarChart3,
  Download,
  Loader2,
  FileText,
  Projector,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Crown,
} from 'lucide-react';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PptxGenJS from 'pptxgenjs';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../services/firebase';
import { IS_LOCALHOST } from '../utils/env';

// ===== Helpers =====
const calcKPIsFor = (maquinaNome, maquinasArg, lancamentosArg, diasUteisArg) => {
  const diasUteisVal = Number(diasUteisArg) || 22;

  let metaDia = 0;
  let unidade = 'un';
  let metaMes = 0;
  let unidadeMix = false;

  if (maquinaNome === 'TODAS') {
    metaDia = (maquinasArg || []).reduce((acc, m) => acc + (Number(m.meta) || 0), 0);
    const sameUnit =
      (maquinasArg || []).length > 0
        ? (maquinasArg || []).every((m) => m.unidade === (maquinasArg || [])[0]?.unidade)
        : true;

    if ((maquinasArg || []).length && sameUnit) unidade = (maquinasArg || [])[0].unidade;
    else {
      unidade = '';
      unidadeMix = true;
    }
  } else {
    const maq = (maquinasArg || []).find((m) => m.nome === maquinaNome);
    metaDia = Number(maq?.meta) || 0;
    unidade = maq?.unidade || 'un';
  }

  metaMes = metaDia * diasUteisVal;

  const lanc =
    maquinaNome === 'TODAS'
      ? (lancamentosArg || [])
      : (lancamentosArg || []).filter((l) => l.maquina === maquinaNome);

  const byDay = new Map();
  for (const l of lanc) {
    const dia = l.dia || '';
    const v = Number(l.real) || 0;
    byDay.set(dia, (byDay.get(dia) || 0) + v);
  }

  const diasTrabalhados = Array.from(byDay.keys()).filter(Boolean).length;
  const total = lanc.reduce((s, l) => s + (Number(l.real) || 0), 0);
  const mediaDia = diasTrabalhados ? total / diasTrabalhados : 0;

  const projetado = diasTrabalhados ? Math.round(mediaDia * diasUteisVal) : 0;
  const ating = metaMes > 0 ? (total / metaMes) * 100 : 0;
  const pace = metaDia > 0 ? (mediaDia / metaDia) * 100 : 0;

  const gap = Math.max(metaMes - total, 0);
  const diasRest = Math.max(diasUteisVal - diasTrabalhados, 0);
  const necessarioDia = diasRest > 0 ? gap / diasRest : gap > 0 ? gap : 0;

  return {
    metaDia,
    metaMes,
    unidade,
    unidadeMix,
    diasUteisVal,
    diasTrabalhados,
    total,
    mediaDia,
    projetado,
    ating,
    pace,
    diasRest,
    necessarioDia,
  };
};





const pad2 = (n) => String(n).padStart(2, '0');
const toYYYYMM = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
const shiftMonth = (yyyyMM, delta) => {
  const [y, m] = yyyyMM.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return toYYYYMM(dt);
};

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

function isoToDiaLabel(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const mon = dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${pad2(d)}/${mon}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const formatCompact = (n) =>
  Number(n || 0).toLocaleString('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

const formatInt = (n) => Number(n || 0).toLocaleString('pt-BR');
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

const getPaceStatus = (pace) => {
  const p = Number(pace || 0);
  if (p >= 100) return { label: 'OK', tone: 'good', icon: CheckCircle2 };
  if (p >= 95) return { label: 'Atenção', tone: 'warn', icon: AlertTriangle };
  return { label: 'Crítico', tone: 'bad', icon: XCircle };
};

const KpiCard = ({
  title,
  value,
  subtitle,
  tone = 'neutral',
  emphasize = false,
  rightBadge,
  icon: Icon,
}) => {
  const toneMap = {
    neutral: 'border-zinc-800 bg-zinc-900',
    good: 'border-emerald-500/30 bg-emerald-500/5',
    warn: 'border-amber-500/30 bg-amber-500/5',
    bad: 'border-red-500/30 bg-red-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
    pace: 'border-violet-500/30 bg-violet-500/5',
  };

  const valueColor =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'bad'
      ? 'text-red-400'
      : tone === 'warn'
      ? 'text-amber-300'
      : tone === 'info'
      ? 'text-blue-300'
      : tone === 'pace'
      ? 'text-violet-300'
      : 'text-zinc-100';

  return (
    <div
      className={`rounded-xl border ${toneMap[tone]} p-4 shadow-sm ${
        emphasize ? 'ring-1 ring-white/5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">
          {title}
        </div>
        {rightBadge ? (
          <div className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border border-white/10 bg-black/20 text-zinc-300">
            {rightBadge}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {Icon ? (
          <div className="p-1.5 rounded-lg border border-white/10 bg-black/15">
            <Icon size={16} className="text-zinc-300" />
          </div>
        ) : null}

        <div
          className={`font-black tracking-tight ${valueColor} ${
            emphasize ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'
          }`}
        >
          {value}
        </div>
      </div>

      {subtitle ? <div className="mt-1 text-[11px] text-zinc-500">{subtitle}</div> : null}
    </div>
  );
};

const MiniPanel = ({ title, children }) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-3">
      {title}
    </div>
    {children}
  </div>
);

const GlobalScreen = () => {
  // ===== ROOT REF (pra ajustar o layout pai no modo apresentação) =====
  const pageRootRef = useRef(null);

  // ===== MÊS ATIVO =====
  const [mesRef, setMesRef] = useState(() => toYYYYMM(new Date()));
  const prevMesRef = useMemo(() => shiftMonth(mesRef, -1), [mesRef]);
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

  // ===== STATES =====
  const [config, setConfig] = useState({ diasUteis: 22 });
  const [maquinas, setMaquinas] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [prevLancamentos, setPrevLancamentos] = useState([]);

  const [busy, setBusy] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // MODO APRESENTAÇÃO
  const [presentationMode, setPresentationMode] = useState(false);

  // Filtros e Forms
  const [filtroMaquina, setFiltroMaquina] = useState('TODAS');
  const [novoDiaISO, setNovoDiaISO] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  });
  const [novoValor, setNovoValor] = useState('');
  const [novaMaquinaForm, setNovaMaquinaForm] = useState('');

  // Nova máquina inputs
  const [inputNomeMaquina, setInputNomeMaquina] = useState('');
  const [inputMetaMaquina, setInputMetaMaquina] = useState(100);
  const [inputUnidadeMaquina, setInputUnidadeMaquina] = useState('pç');

  // Refs
  const chartCaptureRef = useRef(null);
  const inputBackupRef = useRef(null);

  const toast = (msg, ms = 2000) => {
    setStatusMsg(msg);
    if (ms) setTimeout(() => setStatusMsg(''), ms);
  };

  // ============================================================
  //  MODO APRESENTAÇÃO: esconder sidebar E recuperar espaço
  //  (zera margin/padding-left e max-width nos wrappers do layout)
  // ============================================================
  useEffect(() => {
    const root = pageRootRef.current;
    if (!root) return;

    // 1) esconder sidebar (seletores “prováveis”)
    const sidebar =
      document.querySelector('[data-app-sidebar]') ||
      document.querySelector('#app-sidebar') ||
      document.querySelector('aside') ||
      document.querySelector('nav');

    // 2) montar cadeia de elementos acima do GlobalScreen (pra matar o padding/offset do layout)
    const chain = [];
    let el = root;
    for (let i = 0; i < 8; i++) {
      if (!el) break;
      chain.push(el);
      el = el.parentElement;
      if (el === document.body) break;
    }
    if (!chain.includes(document.body)) chain.push(document.body);

    // snapshot estilos para restaurar
    const saved = chain.map((e) => ({
      el: e,
      style: {
        marginLeft: e.style.marginLeft,
        paddingLeft: e.style.paddingLeft,
        width: e.style.width,
        maxWidth: e.style.maxWidth,
      },
    }));

    const savedSidebarDisplay = sidebar?.style.display ?? '';

    if (presentationMode) {
      if (sidebar) sidebar.style.display = 'none';

      // remove qualquer “reserva” pro menu lateral
      chain.forEach((e) => {
        e.style.marginLeft = '0px';
        e.style.paddingLeft = '0px';
        e.style.width = '100%';
        e.style.maxWidth = 'none';
      });

      // evita scroll duplo do layout (você já tem scroll no container do GlobalScreen)
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      if (sidebar) sidebar.style.display = savedSidebarDisplay || '';
      saved.forEach(({ el: e, style }) => {
        e.style.marginLeft = style.marginLeft || '';
        e.style.paddingLeft = style.paddingLeft || '';
        e.style.width = style.width || '';
        e.style.maxWidth = style.maxWidth || '';
      });
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }

    return () => {
      if (sidebar) sidebar.style.display = savedSidebarDisplay || '';
      saved.forEach(({ el: e, style }) => {
        e.style.marginLeft = style.marginLeft || '';
        e.style.paddingLeft = style.paddingLeft || '';
        e.style.width = style.width || '';
        e.style.maxWidth = style.maxWidth || '';
      });
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [presentationMode]);

  // ====== LocalStorage (Apenas IS_LOCALHOST) ======
  useEffect(() => {
    if (IS_LOCALHOST) {
      const localConfig = localStorage.getItem('local_config');
      if (localConfig) setConfig(JSON.parse(localConfig));

      const localMaq = localStorage.getItem('local_maquinas');
      if (localMaq) setMaquinas(JSON.parse(localMaq));

      const localLanc = localStorage.getItem('local_lancamentos');
      if (localLanc) setLancamentos(JSON.parse(localLanc));
    }
  }, []);

  useEffect(() => {
    if (IS_LOCALHOST) localStorage.setItem('local_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (IS_LOCALHOST) localStorage.setItem('local_maquinas', JSON.stringify(maquinas));
  }, [maquinas]);

  useEffect(() => {
    if (IS_LOCALHOST) localStorage.setItem('local_lancamentos', JSON.stringify(lancamentos));
  }, [lancamentos]);

  // ====== Firestore subscriptions (Apenas Produção) ======
  useEffect(() => {
    if (IS_LOCALHOST) return;

    const cfgRef = doc(db, 'global_config_mensal', mesRef);
    const unsubCfg = onSnapshot(
      cfgRef,
      (snap) => {
        if (!snap.exists()) {
          setConfig({ diasUteis: 22 });
          return;
        }
        const data = snap.data();
        setConfig({ diasUteis: Number(data?.diasUteis) || 22 });
      },
      (error) => console.error('Erro config:', error)
    );

    return () => unsubCfg();
  }, [mesRef]);

  useEffect(() => {
    if (IS_LOCALHOST) return;

    const qMaq = query(collection(db, 'global_maquinas'));
    const unsubMaq = onSnapshot(
      qMaq,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => a.nome.localeCompare(b.nome));
        setMaquinas(arr);
      },
      (error) => console.error('Erro maquinas:', error)
    );

    return () => unsubMaq();
  }, []);

  useEffect(() => {
    if (IS_LOCALHOST) return;

    const qLanc = query(
      collection(db, 'global_lancamentos'),
      where('mesRef', '==', mesRef),
      limit(800)
    );

    const unsubLanc = onSnapshot(
      qLanc,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const ordenado = arr
          .map((x) => ({ ...x, real: Number(x.real) || 0 }))
          .sort((a, b) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tB - tA;
          });

        setLancamentos(ordenado);
      },
      (error) => {
        console.error('Erro lancamentos:', error);
      }
    );

    return () => unsubLanc();
  }, [mesRef]);

  useEffect(() => {
    if (IS_LOCALHOST) {
      const localLanc = localStorage.getItem('local_lancamentos');
      if (localLanc) {
        const arr = JSON.parse(localLanc);
        setPrevLancamentos(arr.filter((l) => l.mesRef === prevMesRef));
      } else {
        setPrevLancamentos([]);
      }
      return;
    }

    const qLancPrev = query(
      collection(db, 'global_lancamentos'),
      where('mesRef', '==', prevMesRef),
      limit(800)
    );

    const unsubPrev = onSnapshot(
      qLancPrev,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const ordenado = arr
          .map((x) => ({ ...x, real: Number(x.real) || 0 }))
          .sort((a, b) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tB - tA;
          });
        setPrevLancamentos(ordenado);
      },
      (error) => {
        console.error('Erro lancamentos mes anterior:', error);
      }
    );

    return () => unsubPrev();
  }, [prevMesRef]);

  // ====== Defaults UI ======
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

  // ====== Agregações por máquina (para ranking) ======
  const perMachineAgg = useMemo(() => {
    if (!maquinas.length) return [];

    const diasUteisVal = Number(config.diasUteis) || 22;

    const mMap = new Map(maquinas.map((m) => [m.nome, m]));
    const byM = new Map();

    for (const l of lancamentos) {
      const nome = l.maquina;
      if (!mMap.has(nome)) continue;
      const day = l.dia || '';
      if (!byM.has(nome)) byM.set(nome, { nome, total: 0, dias: new Set() });
      const obj = byM.get(nome);
      obj.total += Number(l.real) || 0;
      if (day) obj.dias.add(day);
    }

    const out = [];
    for (const [nome, obj] of byM.entries()) {
      const maq = mMap.get(nome);
      const metaDia = Number(maq?.meta) || 0;
      const diasTrabalhados = obj.dias.size || 0;
      const mediaDia = diasTrabalhados ? obj.total / diasTrabalhados : 0;
      const pace = metaDia > 0 ? (mediaDia / metaDia) * 100 : 0;
      const metaMes = metaDia * diasUteisVal;
      const ating = metaMes > 0 ? (obj.total / metaMes) * 100 : 0;

      out.push({
        nome,
        unidade: maq?.unidade || '',
        metaDia,
        metaMes,
        total: obj.total,
        diasTrabalhados,
        mediaDia,
        pace,
        ating,
        gap: Math.max(metaMes - obj.total, 0),
      });
    }

    for (const m of maquinas) {
      if (!out.some((x) => x.nome === m.nome)) {
        const metaDia = Number(m.meta) || 0;
        const metaMes = metaDia * diasUteisVal;
        out.push({
          nome: m.nome,
          unidade: m.unidade || '',
          metaDia,
          metaMes,
          total: 0,
          diasTrabalhados: 0,
          mediaDia: 0,
          pace: 0,
          ating: 0,
          gap: metaMes,
        });
      }
    }

    return out;
  }, [maquinas, lancamentos, config.diasUteis]);

  // ====== Cálculos do gráfico ======
  const dadosGrafico = useMemo(() => {
    const diasUteisVal = Number(config.diasUteis) || 22;

    if (maquinas.length === 0) {
      return {
        dados: [],
        totalProduzido: 0,
        projetadoValor: 0,
        metaTotalMes: 0,
        metaDiariaAtiva: 0,
        unidadeAtiva: 'un',
        diasUteis: diasUteisVal,
        atingimentoMes: 0,
        aderenciaMeta: 0,
        diasTrabalhados: 0,
        mediaDiaria: 0,
        gap: 0,
        diasRestantes: Math.max(diasUteisVal - 0, 0),
        necessarioDia: 0,
        unidadeMix: false,
      };
    }

    let metaDiariaAtiva = 0;
    let unidadeAtiva = 'un';
    let unidadeMix = false;

    if (filtroMaquina === 'TODAS') {
      metaDiariaAtiva = maquinas.reduce((acc, m) => acc + (Number(m.meta) || 0), 0);
      const todasMesmaUnidade = maquinas.every((m) => m.unidade === maquinas[0]?.unidade);
      if (maquinas.length > 0 && todasMesmaUnidade) unidadeAtiva = maquinas[0].unidade;
      else {
        unidadeAtiva = '%';
        unidadeMix = true;
      }
    } else {
      const maq = maquinas.find((m) => m.nome === filtroMaquina);
      metaDiariaAtiva = maq ? Number(maq.meta) || 0 : 0;
      unidadeAtiva = maq ? maq.unidade : 'un';
    }

    const metaTotalMes = metaDiariaAtiva * diasUteisVal;

    const lancamentosFiltrados =
      filtroMaquina === 'TODAS'
        ? lancamentos
        : lancamentos.filter((l) => l.maquina === filtroMaquina);

    const agrupadoPorDia = lancamentosFiltrados.reduce((acc, curr) => {
      if (!acc[curr.dia]) acc[curr.dia] = 0;
      acc[curr.dia] += Number(curr.real) || 0;
      return acc;
    }, {});

    const prevLancamentosFiltrados =
      filtroMaquina === 'TODAS'
        ? prevLancamentos
        : prevLancamentos.filter((l) => l.maquina === filtroMaquina);

    const prevAgrupadoPorDia = prevLancamentosFiltrados.reduce((acc, curr) => {
      if (!acc[curr.dia]) acc[curr.dia] = 0;
      acc[curr.dia] += Number(curr.real) || 0;
      return acc;
    }, {});

    const diasUnicos = Object.keys(agrupadoPorDia).sort((a, b) => {
      const da = Number(a?.split('/')?.[0] || 0);
      const db = Number(b?.split('/')?.[0] || 0);
      return da - db;
    });

    const prevDiasOrdenados = Object.keys(prevAgrupadoPorDia).sort((a, b) => {
      const da = Number(a?.split('/')?.[0] || 0);
      const db = Number(b?.split('/')?.[0] || 0);
      return da - db;
    });

    const prevValoresOrdenados = prevDiasOrdenados.map((dia) => prevAgrupadoPorDia[dia] || 0);

    const totalProduzido = lancamentosFiltrados.reduce(
      (acc, curr) => acc + (Number(curr.real) || 0),
      0
    );

    const diasTrabalhados = diasUnicos.length;
    const mediaDiaria = diasTrabalhados > 0 ? totalProduzido / diasTrabalhados : 0;
    const projetadoValor = diasTrabalhados > 0 ? Math.round(mediaDiaria * diasUteisVal) : 0;

    const dadosProcessados = diasUnicos.map((dia, idx) => {
      const valorTotalDia = agrupadoPorDia[dia];
      const performance = metaDiariaAtiva > 0 ? (valorTotalDia / metaDiariaAtiva) * 100 : 0;
      const prevValorDia = prevValoresOrdenados[idx] || 0;
      const prevPerformance = metaDiariaAtiva > 0 ? (prevValorDia / metaDiariaAtiva) * 100 : 0;

      return {
        name: dia,
        realOriginal: valorTotalDia,
        metaOriginal: metaDiariaAtiva,
        valorPlotado: performance,
        metaPlotada: 100,
        prevPlotada: prevPerformance,
        tipo: 'diario',
        performance,
        unidade: unidadeAtiva,
      };
    });

    const performanceProjetada = metaTotalMes > 0 ? (projetadoValor / metaTotalMes) * 100 : 0;

    dadosProcessados.push({
      name: 'PROJ.',
      realOriginal: projetadoValor,
      metaOriginal: metaTotalMes,
      valorPlotado: performanceProjetada,
      metaPlotada: 100,
      prevPlotada: null,
      tipo: 'projetado',
      performance: performanceProjetada,
      unidade: unidadeAtiva,
    });

    const atingimentoMes = metaTotalMes > 0 ? (totalProduzido / metaTotalMes) * 100 : 0;
    const aderenciaMeta = metaDiariaAtiva > 0 ? (mediaDiaria / metaDiariaAtiva) * 100 : 0;
    const gap = Math.max(metaTotalMes - totalProduzido, 0);

    const diasRestantes = Math.max(diasUteisVal - diasTrabalhados, 0);
    const necessarioDia =
      diasRestantes > 0 ? gap / diasRestantes : gap > 0 ? gap : 0;

    return {
      dados: dadosProcessados,
      totalProduzido,
      projetadoValor,
      metaTotalMes,
      metaDiariaAtiva,
      unidadeAtiva,
      diasUteis: diasUteisVal,
      atingimentoMes,
      aderenciaMeta,
      mediaDiaria,
      diasTrabalhados,
      gap,
      diasRestantes,
      necessarioDia,
      unidadeMix,
    };
  }, [lancamentos, prevLancamentos, config, maquinas, filtroMaquina]);

  // (Tendência removida a pedido) — usamos apenas os dados do mês
  const dadosChart = useMemo(() => dadosGrafico.dados || [], [dadosGrafico.dados]);

  const getBarFill = (entry) => {
    if (!entry) return '#3b82f6';
    if (entry.tipo === 'projetado') return '#fb923c'; // projeção
    const perf = Number(entry.performance || 0);
    if (perf >= 100) return '#34d399'; // bateu meta
    if (perf >= 95) return '#fbbf24';  // perto
    return '#f87171';                 // abaixo
  };

  // ===== Rótulos (valor + %) =====
  const renderBarLabel = (props) => {
    const { x, y, width, height, index } = props;
    const item = dadosChart?.[index];
    if (!item) return null;

    const isProj = item.tipo === 'projetado';
    const perf = Number(item.performance || 0);
    const val = Number(item.realOriginal || 0);

    const perfColor = perf >= 100 ? '#34d399' : '#fb923c';
    const valColor = '#E5E7EB';

    const smallBar = height < 36;
    const baseY = smallBar ? y - 6 : y + 14;

    const valueText = formatCompact(val);
    const pctText = `${perf.toFixed(0)}%`;

    return (
      <g>
        <text
          x={x + width / 2}
          y={baseY}
          fill={valColor}
          textAnchor="middle"
          fontSize={11}
          fontWeight={800}
        >
          {valueText}
        </text>

        <text
          x={x + width / 2}
          y={smallBar ? y - 20 : y - 10}
          fill={perfColor}
          textAnchor="middle"
          fontSize={11}
          fontWeight={900}
        >
          {pctText}
        </text>

        {isProj && (
          <text
            x={x + width / 2}
            y={smallBar ? y - 34 : y - 24}
            fill="#a1a1aa"
            textAnchor="middle"
            fontSize={9}
            fontWeight={800}
          >
            PROJ
          </text>
        )}
      </g>
    );
  };

  // ===== KPI/Headline/Insights =====
  const paceStatus = useMemo(() => getPaceStatus(dadosGrafico.aderenciaMeta), [dadosGrafico.aderenciaMeta]);

  const headline = useMemo(() => {
    const projPct = Number(dadosGrafico?.metaTotalMes || 0) > 0
      ? (Number(dadosGrafico.projetadoValor || 0) / Number(dadosGrafico.metaTotalMes || 0)) * 100
      : 0;

    const delta = projPct - 100;

    if (!dadosGrafico.diasTrabalhados) {
      return `Sem lançamentos no mês. Comece a registrar para gerar projeção e ritmo.`;
    }

    return `No ritmo atual fechamos em ${projPct.toFixed(0)}% (${delta >= 0 ? '+' : ''}${delta.toFixed(
      0
    )} p.p.) — ${delta >= 0 ? 'tendência de bater a meta.' : `faltando ${Math.abs(delta).toFixed(0)} p.p.`}`;
  }, [dadosGrafico]);

  const insights = useMemo(() => {
    const daily = (dadosGrafico.dados || []).filter((x) => x.tipo === 'diario');
    if (!daily.length) {
      return { best: null, worst: null, streakBelow: 0 };
    }

    let best = daily[0];
    let worst = daily[0];

    for (const d of daily) {
      if (Number(d.performance || 0) > Number(best.performance || 0)) best = d;
      if (Number(d.performance || 0) < Number(worst.performance || 0)) worst = d;
    }

    let streakBelow = 0;
    for (let i = daily.length - 1; i >= 0; i--) {
      if (Number(daily[i].performance || 0) < 100) streakBelow += 1;
      else break;
    }

    return { best, worst, streakBelow };
  }, [dadosGrafico.dados]);

  // ===== Rank Top/Bottom máquinas =====
  const ranking = useMemo(() => {
    const arr = [...perMachineAgg];
    arr.sort((a, b) => (b.pace || 0) - (a.pace || 0));

    const top = arr.slice(0, 5);
    const bottom = arr.slice(-5).reverse();

    return { top, bottom };
  }, [perMachineAgg]);

  // ====== ACTIONS ======
  const handleDownloadBackupGlobal = async () => {
    try {
      setBusy(true);
      toast('Gerando backup JSON...', 0);

      let allLancamentos = Array.isArray(lancamentos) ? [...lancamentos] : [];
      let configsAll = [{ mesRef, ...config }];

      if (!IS_LOCALHOST) {
        const [snapLanc, snapCfg] = await Promise.all([
          getDocs(query(collection(db, 'global_lancamentos'))),
          getDocs(query(collection(db, 'global_config_mensal'))),
        ]);

        allLancamentos = snapLanc.docs.map((d) => ({ id: d.id, ...d.data() }));
        allLancamentos = allLancamentos.map((x) => ({ ...x, real: Number(x.real) || 0 }));
        configsAll = snapCfg.docs.map((d) => ({ mesRef: d.id, ...d.data() }));
      } else {
        const localLanc = localStorage.getItem('local_lancamentos');
        if (localLanc) allLancamentos = JSON.parse(localLanc);
        const localConfig = localStorage.getItem('local_config');
        if (localConfig) configsAll = [{ mesRef, ...JSON.parse(localConfig) }];
      }

      const lancamentosMes = allLancamentos.filter(
        (l) => String(l.mesRef || '') === String(mesRef)
      );
      const configMes =
        configsAll.find((c) => String(c.mesRef || '') === String(mesRef)) || config;

      const payload = {
        type: 'GlobalScreenBackup',
        version: 2,
        generatedAt: new Date().toISOString(),
        mesRef,
        config: configMes,
        maquinas,
        lancamentos: lancamentosMes,
        lancamentosAll: allLancamentos,
        configsAll,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-globalscreen-todos-meses-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast('Backup JSON gerado!', 1800);
    } catch (err) {
      console.error('Erro ao gerar backup JSON (GlobalScreen):', err);
      alert('Erro ao gerar backup JSON. Veja o console (F12).');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadBackupGlobal = (e) => {
    if (!IS_LOCALHOST) {
      alert('Carregar backup JSON é permitido apenas no localhost (modo offline).');
      e.target.value = null;
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = JSON.parse(String(evt.target.result || '{}'));

        const nextMes = raw.mesRef || raw?.data?.mesRef;
        const nextConfig = raw.config || raw?.data?.config;
        const nextMaq = raw.maquinas || raw?.data?.maquinas;
        const nextLanc = raw.lancamentos || raw?.data?.lancamentos;

        if (nextMes) setMesRef(String(nextMes));
        if (nextConfig && typeof nextConfig === 'object') setConfig(nextConfig);
        if (Array.isArray(nextMaq)) setMaquinas(nextMaq);
        if (Array.isArray(nextLanc)) setLancamentos(nextLanc);

        toast('Backup carregado! (modo offline)', 2500);
      } catch (err) {
        console.error('Erro ao carregar backup JSON (GlobalScreen):', err);
        alert('Arquivo inválido. Não consegui ler esse JSON.');
      } finally {
        e.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  const saveDiasUteisMes = async (dias) => {
    const d = Number(dias);
    if (!Number.isFinite(d) || d <= 0) return;

    if (IS_LOCALHOST) {
      setConfig((prev) => ({ ...prev, diasUteis: d }));
      toast('Dias úteis salvos (Local) ✅');
      return;
    }

    try {
      setBusy(true);
      await setDoc(
        doc(db, 'global_config_mensal', mesRef),
        { diasUteis: d, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast('Dias úteis salvos ✅');
    } catch (error) {
      console.error('Erro dias uteis', error);
      toast('Erro ao salvar dias úteis ❌');
    } finally {
      setBusy(false);
    }
  };

  const handleAddLancamento = async (e) => {
    e.preventDefault();
    if (!novoDiaISO || !novoValor) return;

    if (maquinas.length === 0) {
      toast('Cadastre uma máquina antes de lançar.', 3000);
      return;
    }

    const min = firstDayISO(mesRef);
    const max = lastDayISO(mesRef);
    if (novoDiaISO < min || novoDiaISO > max) {
      toast(`Data fora do mês selecionado (${monthLabel(mesRef)}).`, 4000);
      return;
    }

    const maqFinal = novaMaquinaForm || maquinas[0].nome;

    if (IS_LOCALHOST) {
      setLancamentos((prev) => [
        {
          id: `local-${Date.now()}`,
          dia: isoToDiaLabel(novoDiaISO),
          diaISO: novoDiaISO,
          real: Number(novoValor),
          maquina: maqFinal,
          mesRef,
          createdAt: { seconds: Date.now() / 1000 },
        },
        ...prev,
      ]);
      setNovoValor('');
      toast('Salvo localmente ✅');
      return;
    }

    try {
      setBusy(true);
      await addDoc(collection(db, 'global_lancamentos'), {
        dia: isoToDiaLabel(novoDiaISO),
        diaISO: novoDiaISO,
        real: Number(novoValor),
        maquina: maqFinal,
        mesRef,
        createdAt: serverTimestamp(),
      });
      setNovoValor('');
      toast('Lançamento salvo ✅');
    } catch (error) {
      console.error(error);
      toast('Erro ao salvar no Firebase ❌');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLancamento = async (id) => {
    if (!id) return;
    if (IS_LOCALHOST) {
      setLancamentos((prev) => prev.filter((item) => item.id !== id));
      toast('Removido localmente');
      return;
    }
    try {
      setBusy(true);
      await deleteDoc(doc(db, 'global_lancamentos', id));
      toast('Lançamento removido ✅');
    } catch (error) {
      console.error(error);
      toast('Erro ao deletar ❌');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMaquina = async () => {
    const nome = String(inputNomeMaquina || '').trim();
    if (!nome) return;
    if (maquinas.some((m) => m.nome === nome)) {
      toast('Máquina já existe!');
      return;
    }

    const novaMaq = {
      nome,
      meta: Number(inputMetaMaquina),
      unidade: inputUnidadeMaquina,
    };

    if (IS_LOCALHOST) {
      setMaquinas((prev) => [...prev, { id: `local-${Date.now()}`, ...novaMaq }]);
      setInputNomeMaquina('');
      setInputMetaMaquina(100);
      setInputUnidadeMaquina('pç');
      toast('Máquina add (Local) ✅');
      return;
    }

    try {
      setBusy(true);
      await addDoc(collection(db, 'global_maquinas'), { ...novaMaq, createdAt: serverTimestamp() });
      setInputNomeMaquina('');
      setInputMetaMaquina(100);
      setInputUnidadeMaquina('pç');
      toast('Máquina adicionada ✅');
    } catch (error) {
      console.error(error);
      toast('Erro ao adicionar máquina ❌');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMaquina = async (nomeParaRemover) => {
    const maq = maquinas.find((m) => m.nome === nomeParaRemover);
    if (!maq) return;

    if (IS_LOCALHOST) {
      setMaquinas((prev) => prev.filter((m) => m.nome !== nomeParaRemover));
      toast('Máquina removida (Local)');
      return;
    }

    try {
      setBusy(true);
      await deleteDoc(doc(db, 'global_maquinas', maq.id));
      toast('Máquina removida ✅');
    } catch (error) {
      console.error(error);
      toast('Erro ao remover máquina ❌');
    } finally {
      setBusy(false);
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

    setMaquinas((prev) => prev.map((m) => (m.nome === nomeMaquina ? { ...m, meta: valor } : m)));

    try {
      await updateDoc(doc(db, 'global_maquinas', maq.id), { meta: valor });
    } catch (error) {
      console.error('Erro meta', error);
      toast('Erro ao atualizar meta ❌');
    }
  };

  const handleUpdateUnidade = async (nomeMaquina, novaUnidade) => {
    if (!novaUnidade) return;

    if (IS_LOCALHOST) {
      setMaquinas((prev) =>
        prev.map((m) => (m.nome === nomeMaquina ? { ...m, unidade: novaUnidade } : m))
      );
      return;
    }

    const maq = maquinas.find((m) => m.nome === nomeMaquina);
    if (!maq?.id) return;

    setMaquinas((prev) =>
      prev.map((m) => (m.nome === nomeMaquina ? { ...m, unidade: novaUnidade } : m))
    );

    try {
      await updateDoc(doc(db, 'global_maquinas', maq.id), { unidade: novaUnidade });
    } catch (error) {
      console.error('Erro unidade', error);
      toast('Erro ao atualizar unidade ❌');
    }
  };

  // ===== EXPORT (captura) =====
  const captureChartPNG = async () => {
    const el = chartCaptureRef.current;
    if (!el) throw new Error('chartCaptureRef está null (não achou o container do gráfico).');

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#09090b',
      logging: false,
    });

    return canvas.toDataURL('image/png', 1.0);
  };

  const exportPDFGraficos = async () => {
    if (maquinas.length === 0) return toast('Sem máquinas para exportar.');
    if (exportando) return;

    setExportando(true);
    setBusy(true);
    toast('Gerando PDF...', 0);
    const filtroOriginal = filtroMaquina;

    try {
      const pdf = new jsPDF('landscape', 'pt', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < maquinas.length; i++) {
        const m = maquinas[i];
        setFiltroMaquina(m.nome);

        await sleep(500);
        await new Promise((r) => requestAnimationFrame(r));

        const imgData = await captureChartPNG();

        if (i > 0) pdf.addPage();

        pdf.setFillColor(9, 9, 11);
        pdf.rect(0, 0, pageW, pageH, 'F');

        const margin = 20;
        const imgW = pageW - margin * 2;
        const imgProps = pdf.getImageProperties(imgData);
        const imgH = (imgProps.height * imgW) / imgProps.width;

        pdf.addImage(imgData, 'PNG', margin, 60, imgW, imgH);

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.text(`Gráfico de Performance: ${m.nome}`, margin, 36);

        pdf.setTextColor(156, 163, 175);
        pdf.setFontSize(10);
        pdf.text(`Mês: ${monthLabel(mesRef)}`, margin, 50);
      }

      pdf.save(`Graficos_${mesRef}.pdf`);
      toast('PDF baixado ✅');
    } catch (error) {
      console.error('Erro PDF', error);
      toast('Erro ao gerar PDF ❌');
    } finally {
      setFiltroMaquina(filtroOriginal);
      setExportando(false);
      setBusy(false);
    }
  };

  const exportPPTX = async () => {
  if (maquinas.length === 0) return toast('Sem máquinas para exportar.');
  if (exportando) return;

  setExportando(true);
  setBusy(true);
  toast('Gerando PPTX...', 0);

  const formatPct0 = (n) => `${Number(n || 0).toFixed(0)}%`;
  const unitOrBlank = (k) => (k.unidadeMix ? '' : ` ${k.unidade}`);

  // KPI box mais compatível (TEXT BOX com fill/line)
  const addKpiBox = (slide, x, y, title, value) => {
    slide.addText(
      [
        { text: String(title).toUpperCase() + '\n', options: { fontSize: 9, bold: true, color: '9CA3AF' } },
        { text: String(value), options: { fontSize: 18, bold: true, color: 'FFFFFF' } },
      ],
      {
        x,
        y,
        w: 3.05,
        h: 0.9,
        fontFace: 'Calibri',
        fill: { color: '111827' },
        line: { color: '2A2A2A', width: 1 },
        margin: 0.15,
        valign: 'top',
      }
    );
  };

  try {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'GlobalScreen';

    // master simples (evita incompat)
    pptx.defineSlideMaster({
      title: 'MASTER_DARK',
      background: { color: '09090b' },
    });

    const filtroOriginal = filtroMaquina;

    // =========================
    // SLIDE 1: RESUMO (TODAS)
    // =========================
    setFiltroMaquina('TODAS');
    await sleep(650);
    await new Promise((r) => requestAnimationFrame(r));

    const imgResumo = await captureChartPNG();
const kAll = calcKPIsFor('TODAS', maquinas, lancamentos, config?.diasUteis);

    const s0 = pptx.addSlide('MASTER_DARK');
    s0.addText(`Resumo Global – ${monthLabel(mesRef)}`, {
      x: 0.3,
      y: 0.25,
      w: 12.9,
      fontSize: 26,
      bold: true,
      color: 'FFFFFF',
      fontFace: 'Calibri',
    });

    // KPIs linha 1
    addKpiBox(s0, 0.3, 0.85, 'Pace', formatPct0(kAll.pace));
    addKpiBox(s0, 3.45, 0.85, 'Média/dia', `${formatCompact(kAll.mediaDia)}${unitOrBlank(kAll)}`);
    addKpiBox(s0, 6.60, 0.85, 'Meta/dia', `${formatCompact(kAll.metaDia)}${unitOrBlank(kAll)}`);
    addKpiBox(s0, 9.75, 0.85, 'Projeção', `${formatCompact(kAll.projetado)}${unitOrBlank(kAll)}`);

    // KPIs linha 2
    addKpiBox(s0, 0.3, 1.82, 'Realizado', `${formatCompact(kAll.total)}${unitOrBlank(kAll)}`);
    addKpiBox(s0, 3.45, 1.82, 'Meta mês', `${formatCompact(kAll.metaMes)}${unitOrBlank(kAll)}`);
    addKpiBox(s0, 6.60, 1.82, 'Ating.', formatPct0(kAll.ating));
    addKpiBox(s0, 9.75, 1.82, 'Nec/dia', `${formatCompact(kAll.necessarioDia)}${unitOrBlank(kAll)}`);

    // Headline
    s0.addText(String(headline || ''), {
      x: 0.3,
      y: 2.72,
      w: 12.9,
      h: 0.35,
      fontSize: 13,
      bold: true,
      color: 'A1A1AA',
      fontFace: 'Calibri',
    });

    // Gráfico
    s0.addImage({ data: imgResumo, x: 0.3, y: 3.05, w: 12.95, h: 4.15 });

    // =========================
    // SLIDES: POR MÁQUINA
    // =========================
    for (const m of maquinas) {
      setFiltroMaquina(m.nome);
      await sleep(650);
      await new Promise((r) => requestAnimationFrame(r));

      const img = await captureChartPNG();
const k = calcKPIsFor(m.nome, maquinas, lancamentos, config?.diasUteis);

      const s = pptx.addSlide('MASTER_DARK');
      s.addText(`Performance – ${m.nome}`, {
        x: 0.3,
        y: 0.25,
        w: 12.9,
        fontSize: 26,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Calibri',
      });

      addKpiBox(s, 0.3, 0.85, 'Pace', formatPct0(k.pace));
      addKpiBox(s, 3.45, 0.85, 'Média/dia', `${formatCompact(k.mediaDia)}${unitOrBlank(k)}`);
      addKpiBox(s, 6.60, 0.85, 'Meta/dia', `${formatCompact(k.metaDia)}${unitOrBlank(k)}`);
      addKpiBox(s, 9.75, 0.85, 'Projeção', `${formatCompact(k.projetado)}${unitOrBlank(k)}`);

      addKpiBox(s, 0.3, 1.82, 'Realizado', `${formatCompact(k.total)}${unitOrBlank(k)}`);
      addKpiBox(s, 3.45, 1.82, 'Meta mês', `${formatCompact(k.metaMes)}${unitOrBlank(k)}`);
      addKpiBox(s, 6.60, 1.82, 'Ating.', formatPct0(k.ating));
      addKpiBox(s, 9.75, 1.82, 'Nec/dia', `${formatCompact(k.necessarioDia)}${unitOrBlank(k)}`);

      s.addImage({ data: img, x: 0.3, y: 2.75, w: 12.95, h: 4.40 });
    }

    setFiltroMaquina(filtroOriginal);
    await pptx.writeFile({ fileName: `Relatorio_Global_${mesRef}.pptx` });

    toast('PPTX baixado ✅');
  } catch (e) {
    console.error('Erro PPTX:', e);
    toast(`Erro ao gerar PPTX ❌ ${(e && e.message) ? e.message : ''}`, 5000);
  } finally {
    setExportando(false);
    setBusy(false);
  }
};




  // ===== PAGINAÇÃO / HISTÓRICO =====
  const lancamentosVisiveis =
    filtroMaquina === 'TODAS'
      ? lancamentos
      : lancamentos.filter((l) => l.maquina === filtroMaquina);

  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 10;

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroMaquina, mesRef, lancamentos.length]);

  const totalPaginas = Math.ceil(lancamentosVisiveis.length / ITENS_POR_PAGINA);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const fim = inicio + ITENS_POR_PAGINA;
  const itensDaPagina = lancamentosVisiveis.slice(inicio, fim);

  const mudarPagina = (novaPagina) => {
    if (novaPagina >= 1 && novaPagina <= totalPaginas) setPaginaAtual(novaPagina);
  };

  const barSize = useMemo(() => {
    const n = dadosChart?.length || 0;
    if (n <= 6) return 80;
    if (n <= 10) return 56;
    if (n <= 16) return 40;
    return 28;
  }, [dadosChart]);

  const prevStats = useMemo(() => {
    const lanc =
      filtroMaquina === 'TODAS'
        ? prevLancamentos
        : prevLancamentos.filter((l) => l.maquina === filtroMaquina);

    const byDay = new Map();
    for (const l of lanc) {
      const dia = l.dia || '';
      const v = Number(l.real) || 0;
      byDay.set(dia, (byDay.get(dia) || 0) + v);
    }

    const diasTrabalhados = Array.from(byDay.keys()).filter(Boolean).length;
    const total = lanc.reduce((s, l) => s + (Number(l.real) || 0), 0);
    const mediaDia = diasTrabalhados ? total / diasTrabalhados : 0;

    return { total, mediaDia, diasTrabalhados };
  }, [prevLancamentos, filtroMaquina]);

  // ===== KPIs (Resumo Executivo) =====
  const kpis = useMemo(() => {
    const meta = Number(dadosGrafico.metaTotalMes || 0);
    const real = Number(dadosGrafico.totalProduzido || 0);
    const proj = Number(dadosGrafico.projetadoValor || 0);
    const ating = Number(dadosGrafico.atingimentoMes || 0);
    const pace = Number(dadosGrafico.aderenciaMeta || 0);
    const unidade = dadosGrafico.unidadeMix ? '' : (dadosGrafico.unidadeAtiva || '');

    const toneAting = ating >= 100 ? 'good' : ating >= 92 ? 'warn' : 'bad';
    const toneProj = proj >= meta ? 'good' : 'warn';

    const ps = getPaceStatus(pace);
    const tonePace = ps.tone === 'good' ? 'pace' : ps.tone;

    const diasRest = Number(dadosGrafico.diasRestantes || 0);
    const necDia = Number(dadosGrafico.necessarioDia || 0);
    const metaDia = Number(dadosGrafico.metaDiariaAtiva || 0);

    const diffPct = metaDia > 0 ? ((necDia / metaDia) * 100) - 100 : 0;
    const needTone = necDia <= metaDia ? 'good' : diffPct <= 10 ? 'warn' : 'bad';

    const showUnit = !dadosGrafico.unidadeMix;

    return [
      {
        title: 'Pace (aderência)',
        value: pct(pace),
        subtitle: `Status: ${ps.label}`,
        tone: tonePace,
        emphasize: true,
        rightBadge: ps.label,
        icon: ps.icon,
      },
      {
        title: 'Projeção',
        value: `${formatCompact(proj)}${showUnit ? ` ${unidade}` : ''}`,
        subtitle: `Fechamento estimado`,
        tone: toneProj,
        icon: proj >= meta ? ArrowUpRight : ArrowDownRight,
      },
      {
        title: 'Atingimento',
        value: pct(ating),
        subtitle: `Real / Meta do mês`,
        tone: toneAting,
      },
      {
        title: 'Necessário por dia',
        value: `${formatCompact(necDia)}${showUnit ? ` ${unidade}/dia` : ''}`,
        subtitle: diasRest > 0 ? `Restam ${diasRest} dias úteis` : `Sem dias restantes`,
        tone: needTone,
      },
      {
        title: 'Realizado',
        value: `${formatCompact(real)}${showUnit ? ` ${unidade}` : ''}`,
        subtitle: `Dias lançados: ${dadosGrafico.diasTrabalhados || 0}`,
        tone: 'neutral',
      },
      {
        title: 'Meta mensal',
        value: `${formatCompact(meta)}${showUnit ? ` ${unidade}` : ''}`,
        subtitle: `Dias úteis: ${dadosGrafico.diasUteis || 0}`,
        tone: 'info',
      },
    ];
  }, [dadosGrafico]);

  const leftColVisible = !presentationMode;

  return (
    <div
      ref={pageRootRef}
      className="w-full h-screen overflow-y-auto bg-[#09090b] text-zinc-100 font-sans"
      style={{ width: '100%', maxWidth: 'none' }}
    >
      {statusMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-2 rounded-full shadow-xl font-bold text-sm">
          {statusMsg}
        </div>
      )}

      {exportando && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Gerando Arquivo...</h2>
          <p className="text-zinc-400 text-sm animate-pulse">Isso pode levar alguns segundos.</p>
        </div>
      )}

      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800">
        <div
          className={`w-full mx-auto py-3 flex flex-col md:flex-row justify-between items-center gap-3
          ${presentationMode ? 'px-3 md:px-5' : 'max-w-[1920px] px-4 md:px-6'}`}
        >
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-600/20">
              <BarChart3 className="text-blue-500" size={22} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-zinc-100 leading-none">
                Acompanhamento Global
              </h1>
              <p className="text-zinc-500 text-[11px] font-medium mt-1">
                {presentationMode ? 'Modo apresentação (executivo)' : 'Modo operação (lançamentos + histórico)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center md:justify-end gap-2 items-center w-full md:w-auto">
              <button
                onClick={() => {
                  setPresentationMode((v) => !v);
                  setShowConfig(false);
                }}
              className={`flex items-center gap-2 px-3 h-9 rounded-md text-xs font-bold uppercase border transition-all ${
                presentationMode
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Alternar modo apresentação"
            >
                {presentationMode ? <Projector size={14} /> : <LayoutDashboard size={14} />}
                <span className="hidden sm:inline">{presentationMode ? 'Apresentação' : 'Operação'}</span>
              </button>

              <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-md px-2 h-9">
                <select
                  value={mesRef}
                  onChange={(e) => setMesRef(e.target.value)}
                className="bg-transparent text-zinc-200 text-xs font-semibold focus:outline-none cursor-pointer uppercase min-w-[140px]"
              >
                {opcoesMes.map((k) => (
                  <option key={k} value={k} className="bg-zinc-900 text-zinc-300">
                    {monthLabel(k)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-md px-2 h-9">
              <Filter className="text-zinc-500 mr-2" size={14} />
              <select
                value={filtroMaquina}
                onChange={(e) => setFiltroMaquina(e.target.value)}
                className="bg-transparent text-zinc-200 text-xs font-semibold focus:outline-none cursor-pointer uppercase max-w-[220px] truncate"
              >
                <option value="TODAS" className="bg-zinc-900">
                  Todas as Máquinas
                </option>
                {maquinas.map((m) => (
                  <option key={m.id || m.nome} value={m.nome} className="bg-zinc-900">
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            {!presentationMode && (
              <>
                <button
                  onClick={exportPDFGraficos}
                  disabled={busy || exportando || maquinas.length === 0}
                  className="flex items-center gap-2 px-3 h-9 rounded-md text-xs font-bold uppercase transition-all bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
                  title="Baixar Gráficos em PDF"
                >
                  <FileText size={14} />
                  <span className="hidden sm:inline">Gráficos PDF</span>
                </button>

                <button
                  onClick={exportPPTX}
                  disabled={busy || exportando || maquinas.length === 0}
                  className="flex items-center gap-2 px-3 h-9 rounded-md text-xs font-bold uppercase transition-all bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-50"
                  title="Baixar Relatório Completo em PPTX"
                >
                  <Projector size={14} />
                  <span className="hidden sm:inline">Relatório PPTX</span>
                </button>

                <button
                  onClick={handleDownloadBackupGlobal}
                  disabled={busy}
                  className="flex items-center gap-2 px-3 h-9 rounded-md text-xs font-bold bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Backup</span>
                </button>

                <input
                  ref={inputBackupRef}
                  type="file"
                  accept="application/json"
                  onChange={handleUploadBackupGlobal}
                  className="hidden"
                />

                <button
                  onClick={() => inputBackupRef.current?.click()}
                  disabled={!IS_LOCALHOST || busy}
                  className="flex items-center gap-2 px-3 h-9 rounded-md text-xs font-bold bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
                  title={IS_LOCALHOST ? 'Carregar Backup JSON (somente localhost)' : 'Disponível apenas no localhost'}
                >
                  <FileText size={14} />
                  <span className="hidden sm:inline">Carregar</span>
                </button>

                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className={`h-9 w-9 grid place-items-center rounded-md transition-all border ${
                    showConfig
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                  title="Configurações"
                >
                  <Settings size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CONFIG (só operação) */}
      {!presentationMode && (
        <div
          className={`overflow-hidden transition-all duration-500 bg-[#0c0c0e] border-b border-zinc-800 ${
            showConfig ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="max-w-[1920px] mx-auto p-6">
            <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-2">
              <Settings className="text-blue-500" size={18} />
              <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">
                Parâmetros do Processo
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-3 bg-zinc-900/50 p-5 border border-zinc-800 rounded-xl">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-4">
                  Configuração de Período
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Mês Ativo</span>
                    <span className="text-white font-bold uppercase">{monthLabel(mesRef)}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-zinc-300 w-20">Dias Úteis:</span>
                    <input
                      type="number"
                      value={config.diasUteis}
                      onChange={(e) => setConfig({ ...config, diasUteis: Number(e.target.value) })}
                      onBlur={(e) => saveDiasUteisMes(e.target.value)}
                      className="flex-1 bg-black border border-zinc-700 text-white p-1.5 rounded text-center text-sm font-mono focus:border-blue-500 outline-none"
                    />
                    <button
                      onClick={() => saveDiasUteisMes(config.diasUteis)}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold uppercase hover:bg-blue-500"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-9 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-black/40 text-zinc-500 uppercase text-[10px] font-bold tracking-wider sticky top-0 backdrop-blur-sm">
                      <tr>
                        <th className="px-6 py-3">Máquina</th>
                        <th className="px-6 py-3 text-center">Unidade</th>
                        <th className="px-6 py-3 text-right">Meta Diária</th>
                        <th className="px-6 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {maquinas.map((m) => (
                        <tr key={m.id || m.nome} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-2 font-medium text-zinc-200">{m.nome}</td>
                          <td className="px-6 py-2 text-center">
                            <select
                              value={m.unidade}
                              onChange={(e) => handleUpdateUnidade(m.nome, e.target.value)}
                              className="bg-black border border-zinc-700 text-zinc-300 text-xs rounded py-1 px-2 focus:border-blue-500 outline-none"
                            >
                              <option value="pç">Peças (pç)</option>
                              <option value="kg">Quilos (kg)</option>
                              <option value="m">Metros (m)</option>
                              <option value="cx">Caixas (cx)</option>
                            </select>
                          </td>
                          <td className="px-6 py-2">
                            <input
                              type="number"
                              value={m.meta}
                              onChange={(e) => handleUpdateMeta(m.nome, e.target.value)}
                              className="w-full bg-transparent text-right font-mono text-zinc-300 focus:text-white outline-none border-b border-transparent focus:border-blue-500"
                            />
                          </td>
                          <td className="px-6 py-2 text-right">
                            <button
                              onClick={() => handleRemoveMaquina(m.nome)}
                              className="text-zinc-600 hover:text-red-500 p-1"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-black/20 border-t border-zinc-800 flex flex-wrap gap-3 items-center mt-auto">
                  <input
                    type="text"
                    placeholder="Nome da Nova Máquina"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm outline-none text-white focus:border-blue-500 min-w-[150px]"
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
                    className="bg-zinc-100 text-zinc-950 px-5 py-2 text-xs font-bold uppercase rounded hover:bg-white disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINCIPAL */}
      <div
        className={`w-full mx-auto mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12
          ${presentationMode ? 'px-3 md:px-5' : 'max-w-[1920px] px-4 md:px-6'}`}
      >
        {/* COLUNA ESQUERDA: some TOTAL no modo apresentação */}
        {leftColVisible && (
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* ... (mantém igual ao que está acima, sem mudanças funcionais) */}
            <div className="bg-zinc-900 border border-zinc-800 shadow-xl rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-800/30 flex items-center gap-2">
                <PlusCircle className="text-emerald-400" size={16} />
                <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Novo Apontamento
                </h2>
              </div>

              <form onSubmit={handleAddLancamento} className="p-5 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                    Máquina
                  </label>
                  <select
                    className="w-full p-2.5 bg-black border border-zinc-700 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none text-white text-sm transition-all"
                    value={novaMaquinaForm}
                    onChange={(e) => setNovaMaquinaForm(e.target.value)}
                    disabled={maquinas.length === 0}
                  >
                    {maquinas.length === 0 && <option value="">Cadastre máquinas primeiro</option>}
                    {maquinas.map((m) => (
                      <option key={m.id || m.nome} value={m.nome}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                      Data
                    </label>
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
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 uppercase text-xs rounded-lg transition-all flex justify-center gap-2 items-center disabled:opacity-50 shadow-lg shadow-blue-900/20"
                >
                  <Save size={14} /> Salvar Produção
                </button>
              </form>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 shadow-xl rounded-xl flex flex-col flex-1 min-h-[400px] overflow-hidden">
              <div className="p-3 bg-zinc-800/30 border-b border-zinc-800 flex justify-between items-center">
                <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-500"></div> Histórico
                </span>
                <span className="text-[10px] font-mono bg-black border border-zinc-700 px-2 py-0.5 text-zinc-300 rounded-md">
                  {lancamentosVisiveis.length} regs
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
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
                    {itensDaPagina.map((l) => (
                      <tr key={l.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="px-4 py-2.5 font-medium text-zinc-300 text-xs">{l.dia}</td>
                        <td className="px-2 py-2.5 text-[11px] text-zinc-500 truncate max-w-[80px] group-hover:text-zinc-300">
                          {l.maquina}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-200 text-xs">
                          {formatInt(l.real)}
                          <span className="text-[9px] text-zinc-600 ml-1 font-normal">
                            {getUnidadeAtual(l.maquina)}
                          </span>
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
                    {itensDaPagina.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center">
                          <span className="text-xs text-zinc-600">Sem lançamentos</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {lancamentosVisiveis.length > 0 && (
                <div className="p-2 border-t border-zinc-800 bg-zinc-800/30 flex justify-between items-center text-xs">
                  <span className="text-zinc-500 ml-2">
                    Página <span className="text-zinc-300 font-medium">{paginaAtual}</span> de{' '}
                    <span className="text-zinc-300 font-medium">{totalPaginas}</span>
                  </span>

                  <div className="flex gap-1">
                    <button
                      onClick={() => mudarPagina(paginaAtual - 1)}
                      disabled={paginaAtual === 1}
                      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => mudarPagina(paginaAtual + 1)}
                      disabled={paginaAtual === totalPaginas}
                      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DIREITA */}
        <div className={`${presentationMode ? 'lg:col-span-12' : 'lg:col-span-9'} flex flex-col min-w-0 gap-4`}>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpis.map((k) => (
              <KpiCard
                key={k.title}
                title={k.title}
                value={k.value}
                subtitle={k.subtitle}
                tone={k.tone}
                emphasize={!!k.emphasize}
                rightBadge={k.rightBadge}
                icon={k.icon}
              />
            ))}
          </div>



          {/* Gráfico */}
          <div
            ref={chartCaptureRef}
            className="bg-zinc-900 border border-zinc-800 shadow-xl rounded-xl flex-1 flex flex-col relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-violet-500 to-orange-500 opacity-70"></div>

            <div className="p-5 md:p-6 border-b border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gradient-to-b from-zinc-800/20 to-transparent">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="text-blue-500" size={18} />
                  <h3 className="text-base md:text-lg font-bold text-white tracking-tight">Performance</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                    {filtroMaquina === 'TODAS' ? 'Visão geral' : filtroMaquina}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  Mês: <span className="text-zinc-300 font-semibold">{monthLabel(mesRef)}</span>
                </div>
              </div>

              <div className="text-right bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Projeção de fechamento</p>
                <div className="flex items-baseline justify-end gap-2">
                  <span
                    className={`text-3xl font-black tracking-tighter ${
                      Number(dadosGrafico.projetadoValor || 0) >= Number(dadosGrafico.metaTotalMes || 0)
                        ? 'text-emerald-400'
                        : 'text-orange-400'
                    }`}
                  >
                    {formatCompact(dadosGrafico.projetadoValor)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50 min-w-[150px]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Media mes anterior</p>
                  <div className="text-xl font-black tracking-tight text-zinc-100">
                    {formatCompact(prevStats.mediaDia)}
                    {!dadosGrafico.unidadeMix && dadosGrafico.unidadeAtiva
                      ? ` ${dadosGrafico.unidadeAtiva}`
                      : ''}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {monthLabel(prevMesRef)}
                  </div>
                </div>

                <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50 min-w-[150px]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Total mes anterior</p>
                  <div className="text-xl font-black tracking-tight text-zinc-100">
                    {formatCompact(prevStats.total)}
                    {!dadosGrafico.unidadeMix && dadosGrafico.unidadeAtiva
                      ? ` ${dadosGrafico.unidadeAtiva}`
                      : ''}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {monthLabel(prevMesRef)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full relative min-h-[520px] p-4 bg-[#09090b]">
              {maquinas.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-zinc-600 gap-4">
                  <BarChart3 size={48} className="opacity-20" />
                  <p className="text-sm font-medium">Cadastre máquinas e registre produção para visualizar os dados.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dadosChart} margin={{ top: 80, right: 20, left: 10, bottom: 20 }} barCategoryGap={18}>
                    <defs>
                      <linearGradient id="prevMonthArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#71717a" stopOpacity={0.35} />
                        <stop offset="90%" stopColor="#71717a" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: '600' }}
                      dy={12}
                      interval={0}
                    />
                    <YAxis hide domain={[0, 'auto']} />

                    <Tooltip
                      cursor={{ fill: '#27272a', opacity: 0.35 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          const isProj = d.tipo === 'projetado';
                          return (
                            <div className="bg-zinc-950 border border-zinc-700 p-3 shadow-2xl rounded-lg min-w-[220px]">
                              <div className="font-bold uppercase text-[10px] text-zinc-500 mb-2 border-b border-zinc-800 pb-1 tracking-wider">
                                {isProj ? 'Previsão final' : `Dia ${d.name}`}
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-zinc-400">Realizado</span>
                                  <span className="text-white font-mono font-bold">{formatInt(d.realOriginal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-zinc-400">Meta</span>
                                  <span className="text-zinc-300 font-mono">{formatInt(d.metaOriginal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-zinc-400">
                                    Média mês anterior ({monthLabel(prevMesRef)})
                                  </span>
                                  <span className="text-zinc-300 font-mono">
                                    {formatInt(prevStats.mediaDia)}
                                    {!dadosGrafico.unidadeMix && dadosGrafico.unidadeAtiva
                                      ? ` ${dadosGrafico.unidadeAtiva}`
                                      : ''}
                                  </span>
                                </div>
                                <div className={`pt-2 mt-1 border-t border-zinc-800 text-xs font-bold flex justify-between ${d.performance >= 100 ? 'text-emerald-400' : 'text-orange-300'}`}>
                                  <span>Atingimento</span>
                                  <span>{Number(d.performance || 0).toFixed(1)}%</span>
                                </div>
                                {/* tendência removida */}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    <ReferenceLine
                      y={100}
                      label={{
                        position: 'right',
                        value: 'META (100%)',
                        fill: '#d4d4d8',
                        fontSize: 10,
                        fontWeight: 'bold',
                        dy: -10,
                      }}
                      stroke="#d4d4d8"
                      strokeOpacity={0.35}
                    />

                    <ReferenceLine
                      y={Number(dadosGrafico.aderenciaMeta || 0)}
                      label={{
                        position: 'right',
                        value: `PACE (${Number(dadosGrafico.aderenciaMeta || 0).toFixed(0)}%)`,
                        fill: '#c4b5fd',
                        fontSize: 10,
                        fontWeight: 'bold',
                        dy: -10,
                      }}
                      stroke="#a78bfa"
                      strokeOpacity={0.35}
                      strokeDasharray="6 6"
                    />

                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="prevPlotada"
                      stroke="#71717a"
                      strokeWidth={2}
                      fill="url(#prevMonthArea)"
                      dot={false}
                    />

                    <Bar isAnimationActive={false} dataKey="valorPlotado" barSize={barSize} radius={[6, 6, 0, 0]}>
                      {dadosChart.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getBarFill(entry)}
                          fillOpacity={entry.tipo === 'projetado' ? 0.95 : 1}
                        />
                      ))}
                      <LabelList content={renderBarLabel} />
                    </Bar>         
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="metaPlotada"
                      stroke="#d4d4d8"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={false}
                      opacity={0.6}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Insights + Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4">
              <MiniPanel title="Insights do mês">
                {!insights.best ? (
                  <div className="text-sm text-zinc-500">Sem dados ainda.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-400">Melhor dia</div>
                      <div className="text-xs font-extrabold text-emerald-400">
                        {insights.best.name} • {insights.best.performance.toFixed(0)}%
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-400">Pior dia</div>
                      <div className="text-xs font-extrabold text-red-400">
                        {insights.worst.name} • {insights.worst.performance.toFixed(0)}%
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-400">Streak abaixo da meta</div>
                      <div
                        className={`text-xs font-extrabold ${
                          insights.streakBelow >= 3
                            ? 'text-red-400'
                            : insights.streakBelow >= 1
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {insights.streakBelow} dia(s)
                      </div>
                    </div>
                  </div>
                )}
              </MiniPanel>
            </div>

            <div className="lg:col-span-8">
              <MiniPanel title="Ranking por Pace (mês)">
                {filtroMaquina !== 'TODAS' && (
                  <div className="text-[11px] text-zinc-500 mb-3">
                    Ranking permanece fixo mesmo no modo máquina (base: <b className="text-zinc-300">pace</b> do mês selecionado).
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Crown size={14} className="text-amber-300" />
                        <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                          Top 5 Pace
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(ranking?.top || []).map((m) => (
                          <div key={m.nome} className="flex items-center justify-between">
                            <div className="text-xs font-bold text-zinc-200 truncate max-w-[70%]">
                              {m.nome}
                            </div>
                            <div className="text-xs font-extrabold text-emerald-400">
                              {m.pace.toFixed(0)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-red-400" />
                        <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                          Bottom 5 Pace
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(ranking?.bottom || []).map((m) => (
                          <div key={m.nome} className="flex items-center justify-between">
                            <div className="text-xs font-bold text-zinc-200 truncate max-w-[70%]">
                              {m.nome}
                            </div>
                            <div className="text-xs font-extrabold text-red-400">
                              {m.pace.toFixed(0)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                </div>
              </MiniPanel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalScreen;
