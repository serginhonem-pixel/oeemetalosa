import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as XLSX from 'xlsx';

import { db, auth, storage } from "./services/firebase";
import dadosLocais from './backup-painelpcp.json'; // Nome do seu arquivo
import { IS_LOCALHOST, getDevCacheKey } from './utils/env';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';

import {
  Activity, AlertCircle, AlertOctagon, AlertTriangle, ArrowRight, ArrowRightLeft, BarChart3, Box,
  CalendarDays, CheckCircle2,
  ClipboardList,
  Download, Factory, FileText, History, Layers, Layout,
  LogOut, Package, Pencil, Plus, PlusCircle, Scale, Search, Trash2, User,
  TrendingDown, TrendingUp,
  Upload, X
} from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

import BackupControls from './components/BackupControls';
import { safeAddDoc, safeUpdateDoc, safeDeleteDoc } from './services/firebaseSafeWrites';


// --- GRÁFICOS (RECHARTS) ---
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis, YAxis
} from 'recharts';

// --- COMPONENTES VELHOS (Mantenha isso se ainda tiver código antigo na tela) ---


// ⚠️ Certifique-se de que criou o arquivo na pasta 'components'
import { ColunaKanban } from "./components/ColunaKanban";
import OeeDashboard from './components/OeeDashboard';
import { ParadasScreen } from './components/ParadasScreen';
import { ProducaoScreen } from "./components/ProducaoScreen";
import GlobalScreen from './components/GlobalScreen';



// --- DADOS ---
import { CATALOGO_PRODUTOS } from './data/catalogoProdutos';
import { DICIONARIO_PARADAS } from './data/dicionarioParadas';
import { CATALOGO_MAQUINAS } from './data/catalogoMaquinas';
import logoMetalosa from './data/logo metalosa.bmp';
import estoqueConsolidado from './data/perfil-consolidado.json';
import capacidadesMaquinas from './data/capacidades-maquinas.json';


GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const DEV_CACHE_KEY = getDevCacheKey();
const DEV_VIEW_STORAGE_KEY = `${DEV_CACHE_KEY}:viewMode`;

const LoginScreen = ({ onLogin, onResetPassword, error, info, pending }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onLogin(email, senha);
  };

  const handleReset = (event) => {
    event.preventDefault();
    onResetPassword(email);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900/90 border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Layout size={24} className="text-emerald-300" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">Telha OEE</h1>
            <p className="text-sm text-zinc-400">Acesse com seu usuario e senha</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              placeholder="email@empresa.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {info && (
            <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              {info}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-50"
            disabled={pending}
          >
            {pending ? 'Entrando...' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full text-xs text-zinc-400 hover:text-white underline underline-offset-4"
            disabled={pending}
          >
            Esqueci minha senha
          </button>
        </form>
      </div>
    </div>
  );
};

const ProfileModal = ({ open, onClose, email, name, setor, onSave, onLogout, error, saving }) => {
  const [formName, setFormName] = useState(name || '');
  const [formSetor, setFormSetor] = useState(setor || '');

  useEffect(() => {
    setFormName(name || '');
    setFormSetor(setor || '');
  }, [name, setor, open]);

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ name: formName.trim(), setor: formSetor.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <User size={18} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Perfil</h3>
              <div className="text-[11px] text-zinc-400">{email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase">Nome</label>
              <input
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="Seu nome"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase">Setor</label>
              <input
                value={formSetor}
                onChange={(event) => setFormSetor(event.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="PCP, Producao, etc"
              />
            </div>
          </div>

          {error ? (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 bg-zinc-800 text-white rounded-lg"
            >
              Sair
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 text-white rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const formatarDataBR = (dataISO) => {
  if (!dataISO) return '-';
  if (typeof dataISO !== 'string') return String(dataISO);
  const partes = dataISO.split('-');
  if (partes.length !== 3) return dataISO; 
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};
const normalizarHoraExcel = (valorBruto) => {
  if (!valorBruto) return '';

  // String: "07:00", "7:0", "07:00:00"
  if (typeof valorBruto === 'string') {
    const limpa = valorBruto.trim();

    // tenta pegar HH:MM
    const m = limpa.match(/(\d{1,2}):(\d{1,2})/);
    if (m) {
      const h = m[1].padStart(2, '0');
      const min = m[2].padStart(2, '0');
      return `${h}:${min}`;
    }

    // pode vir número em texto (fração do dia)
    const num = Number(limpa.replace(',', '.'));
    if (!Number.isNaN(num) && num > 0 && num < 2) {
      const totalMin = Math.round(num * 24 * 60);
      const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
      const min = String(totalMin % 60).padStart(2, '0');
      return `${h}:${min}`;
    }

    return '';
  }

  // Date: pega hora/minuto
  if (valorBruto instanceof Date) {
    const h = String(valorBruto.getHours()).padStart(2, '0');
    const m = String(valorBruto.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // Número: fração do dia (padrão Excel)
  if (typeof valorBruto === 'number') {
    const totalMin = Math.round(valorBruto * 24 * 60);
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const m = String(totalMin % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  return '';
};


// Data local em YYYY-MM-DD (sem gambiarra de UTC)
const getLocalISODate = (baseDate = new Date()) => {
  const d = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const normalizeISODateInput = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return getLocalISODate(value);
  }
  const raw = String(value).trim();
  const base = raw.includes('T') ? raw.slice(0, 10) : raw;
  if (ISO_DATE_RE.test(base)) return base;
  const br = base.match(BR_DATE_RE);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return base;
};

const processarDataExcel = (valorBruto) => {
  const hojeISO = getLocalISODate(); // hoje no fuso local

  if (!valorBruto) return hojeISO;

  try {
    if (typeof valorBruto === 'string') {
      const limpa = valorBruto.trim();

      // já vem em YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(limpa)) return limpa;

      // formato BR  dd/mm/aaaa
      if (limpa.includes('/')) {
        const partes = limpa.split('/');
        if (partes.length === 3) {
          return `${partes[2]}-${partes[1]}-${partes[0]}`;
        }
      }
    }

    // Date nativo
    if (valorBruto instanceof Date) {
      return getLocalISODate(valorBruto);
    }

    // Número Excel (serial de data)
    if (typeof valorBruto === 'number') {
      const dataBase = new Date(1899, 11, 30); // 30/12/1899
      const dataFinal = new Date(dataBase.getTime() + valorBruto * 86400000);
      return getLocalISODate(dataFinal);
    }
  } catch (e) {
    console.error("Erro data:", valorBruto, e);
  }

  return hojeISO;
};


const processarHoraExcel = (valorBruto) => {
  if (!valorBruto) return '';

  try {
    // String tipo "8:05" ou "08:05"
    if (typeof valorBruto === 'string') {
      const limpa = valorBruto.trim();
      if (/^\d{1,2}:\d{2}$/.test(limpa)) {
        const [h, m] = limpa.split(':');
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
      }
      if (limpa.includes(':')) {
        const partes = limpa.split(':');
        return `${String(partes[0]).padStart(2, '0')}:${String(partes[1]).padStart(2, '0')}`;
      }
    }

    // Número Excel (fração do dia)
    if (typeof valorBruto === 'number') {
      const totalMin = Math.round(valorBruto * 24 * 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  } catch (e) {
    console.error('Erro hora:', valorBruto);
  }

  return '';
};


const encontrarValorNaLinha = (row, possiveisNomes) => {
  const chaves = Object.keys(row);
  for (const nome of possiveisNomes) {
    const chave = chaves.find(k => k.trim().toUpperCase() === nome.toUpperCase());
    if (chave) return row[chave];
  }
  for (const nome of possiveisNomes) {
    const chave = chaves.find(k => k.trim().toUpperCase().includes(nome.toUpperCase()));
    if (chave) return row[chave];
  }
  return undefined;
};

const numeroFromText = (valor) => {
  if (valor === undefined || valor === null) return 0;
  const limpo = String(valor).replace(/\./g, '').replace(',', '.');
  const num = parseFloat(limpo);
  return Number.isFinite(num) ? num : 0;
};

const extrairCompDoTexto = (texto) => {
  if (!texto) return 0;
  const upper = String(texto).toUpperCase();
  if (upper.includes('SOB MEDIDA')) {
    const paren = String(texto).match(/\(\s*([\d.,]+)\s*\)/);
    if (paren) {
      const val = numeroFromText(paren[1]);
      if (val > 0 && val <= 20) return val;
    }
  }
  const m =
    String(texto).match(/(\d+[.,]\d+)\s*m(?!m)/i) ||
    String(texto).match(/(\d+)\s*m(?!m)/i);
  return m ? numeroFromText(m[1]) : 0;
};

const inferirPerfilMaterial = (desc) => {
  if (!desc) return { perfil: '', material: '' };
  const perfilMatch = desc.match(/\bTP\s*0?(\d+)/i);
  const materialMatch = desc.match(/\b(GALV|GALVALUME|ALUZINC|ZINC)\b/i);
  return {
    perfil: perfilMatch ? `TP${perfilMatch[1]}` : '',
    material: materialMatch ? materialMatch[1].toUpperCase() : '',
  };
};

const extrairLinhasDoPdf = async (file) => {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const linhas = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const grouped = {};

    content.items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      grouped[y] = grouped[y] || [];
      grouped[y].push(item.str);
    });

    Object.entries(grouped)
      .sort((a, b) => b[0] - a[0])
      .forEach(([, parts]) => {
        const line = parts.join(' ').replace(/\s+/g, ' ').trim();
        if (line) linhas.push(line);
      });
  }

  return linhas;
};

const extrairTextoPorOcr = async (file) => {
  try {
    const mod = await import('tesseract.js');
    const Tesseract = mod.default || mod;

    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const result = await Tesseract.recognize(canvas, 'por');
    return result?.data?.text || '';
  } catch (err) {
    console.error('OCR indisponível ou falhou:', err);
    return '';
  }
};

const parseLinhasParaItens = (linhas, textoCompleto) => {
  const itens = [];
  const unitRegex = /^(PC|KG|M|UN|UNID|PCS?)$/i;
  const unitInlineRegex = /\b(PC|KG|M|UN|UNID|PCS?)\b/i;

  const shouldIgnoreLinha = (linha) => {
    const upper = linha.toUpperCase();
    if (/^(IT\s+C|PESO TOTAL|ENDERE|OBSERVA|ROMANEIO:)/i.test(linha)) return true;
    if (/^(ROD\.|TELEFONE:|E-MAIL:|SITE:)/i.test(linha)) return true;
    if (/^(CLIENTE:|VENDEDOR:|TRANSPORTADORA:|REDESPACHO:|CGC:|INS\. EST\.:|EMISS|DIGITADOR:)/i.test(linha)) return true;
    if (upper.includes('CLIENTE')) return true;
    if (upper.includes('TELEFONE')) return true;
    if (upper.includes('CGC')) return true;
    if (upper.includes('EMISS')) return true;
    if (upper.includes('DIGITADOR')) return true;
    if (upper.includes('ROMANEIO')) return true;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(linha)) return true;
    return false;
  };



  // 1) Layout em 3 linhas: Descricao -> Codigo/Unidade -> Linha com quantidades
  let pendDesc = '';
  let pendCod = '';
  let pendUnidade = '';
  for (let idx = 0; idx < linhas.length; idx++) {
    const raw = linhas[idx];
    const linha = raw.replace(/\s+/g, ' ').trim();
    if (!linha) continue;
    if (shouldIgnoreLinha(linha)) continue;

    const codeMatch = linha.match(/^(\d{4,6}[A-Z]?)\s+\d{3}\s+(PC|KG|M|UN|UNID|PCS?)$/i);
    if (codeMatch) {
      pendCod = codeMatch[1];
      pendUnidade = codeMatch[2].toUpperCase();
      continue;
    }

    const itemLine = linha.match(/^(\d{1,3})\s+/);
    if (itemLine && pendCod && pendDesc) {
      const parentesesMatch = `${pendDesc} ${linha}`.match(/\(\s*([\d.,]+)\s*\)/);
      const qtdParenteses = parentesesMatch ? numeroFromText(parentesesMatch[1]) : 0;
      const tokens = [...linha.matchAll(/(\d[\d.,]*)/g)].map((m) => numeroFromText(m[1]));
      tokens.shift(); // remove o indice
      const qtdLinha = tokens.length >= 3 ? tokens[tokens.length - 3] : tokens[0] || 0;
      const qtdFinal = qtdParenteses > 0 ? qtdParenteses : qtdLinha;

      const compDesc = extrairCompDoTexto(pendDesc);
      const produtoCatalogo = CATALOGO_PRODUTOS?.find((p) => p.cod === pendCod);
      const perfilMaterial = inferirPerfilMaterial(pendDesc);
      let comp = compDesc || produtoCatalogo?.comp || 0;
      if (!comp && /\bPERFIL\b/i.test(pendDesc)) comp = 6;

      const pesoCalculadoCatalogo = produtoCatalogo
        ? produtoCatalogo.custom
          ? comp * (produtoCatalogo.kgMetro || 0) * qtdFinal
          : (produtoCatalogo.pesoUnit || 0) * qtdFinal
        : 0;

      const descBase = produtoCatalogo?.desc || pendDesc;
      const descFinal =
        produtoCatalogo?.custom && comp > 0
          ? `${descBase} ${comp.toFixed(2)}m`
          : descBase;

      itens.push({
        tempId: Math.random(),
        cod: pendCod,
        desc: descFinal,
        perfil: produtoCatalogo?.perfil || perfilMaterial.perfil,
        material: produtoCatalogo?.material || perfilMaterial.material,
        comp,
        qtd: qtdFinal,
        pesoTotal: (pesoCalculadoCatalogo || 0).toFixed(2),
        unidade: pendUnidade || (unitInlineRegex.exec(linha)?.[1] || 'UN'),
      });

      pendDesc = '';
      pendCod = '';
      pendUnidade = '';
      continue;
    }

    if (!itemLine && !codeMatch) {
      pendDesc = linha;
    }
  }

  if (itens.length > 0) return itens;

  // Tenta interpretar cada linha individualmente, juntando com a próxima se for só a unidade
  for (let idx = 0; idx < linhas.length; idx++) {
    const raw = linhas[idx];
    let linha = raw.replace(/\s+/g, ' ').trim();
    if (!linha) continue;

    // ignora cabecalhos e linhas de endereco/rodape
    if (shouldIgnoreLinha(linha)) continue;

    // Só processa linhas que começam com índice + código
    if (!/^\d{1,3}\s+\d{4,6}[A-Z]?/.test(linha)) continue;
    const matchItem = linha.match(/^(\d{1,3})\s+(\d{4,6}[A-Z]?)(\s+.+)$/);
    if (!matchItem) continue;

    // Se a próxima linha for apenas a unidade, concatena
    const prox = linhas[idx + 1]?.replace(/\s+/g, ' ').trim();
    const proximaEhUnidade = prox && unitRegex.test(prox);
    if (proximaEhUnidade) {
      linha = `${linha} ${prox}`;
      idx += 1;
    }

    // Captura quantidade dentro de parênteses (padrão do PDF)
    const qtdParenteses = (() => {
      const m = raw.match(/\(\s*([\d.,]+)\s*\)/);
      return m ? numeroFromText(m[1]) : 0;
    })();

    const cod = matchItem[2];
    // Remove o prefixo índice+código da descrição
    const descParte = matchItem[3].trim();

    // Extrai números da linha (quantidade/peso)
    const numeros = [...linha.matchAll(/(\d+[.,]\d+)/g)].map((n) => numeroFromText(n[1]));
    // Usando heurística: se houver 3+ números (casos com comprimento), assume penúltimo = qtd, último = peso
    let qtd = 0;
    let pesoTotal = 0;
    if (numeros.length >= 3) {
      qtd = numeros[numeros.length - 2];
      pesoTotal = numeros[numeros.length - 1];
    } else if (numeros.length === 2) {
      qtd = numeros[0];
      pesoTotal = numeros[1];
    } else {
      qtd = numeros[0] || 0;
      pesoTotal = 0;
    }

    // Se achou quantidade entre parênteses, prioriza ela
    const qtdFinal = qtdParenteses > 0 ? qtdParenteses : qtd;
    const descSemParenteses = descParte.replace(/\(\s*[\d.,]+\s*\)/g, '').trim();

    const compDesc = extrairCompDoTexto(descSemParenteses);
    const produtoCatalogo = CATALOGO_PRODUTOS?.find((p) => p.cod === cod);
    const perfilMaterial = inferirPerfilMaterial(descSemParenteses);

    let comp = compDesc || produtoCatalogo?.comp || 0;
    if (!comp && /\bPERFIL\b/i.test(descSemParenteses)) comp = 6;
    const pesoCalculadoCatalogo = produtoCatalogo
      ? produtoCatalogo.custom
        ? comp * (produtoCatalogo.kgMetro || 0) * qtdFinal
        : (produtoCatalogo.pesoUnit || 0) * qtdFinal
      : 0;

    // Peso sempre prioriza catálogo; só usa o lido se não houver catálogo
    const pesoTotalFinal = produtoCatalogo ? pesoCalculadoCatalogo : pesoTotal;
    const descBase = produtoCatalogo?.desc || descSemParenteses;
    const descFinal =
      produtoCatalogo?.custom && comp > 0
        ? `${descBase} ${comp.toFixed(2)}m`
        : descBase;
    const unidadeFinal = proximaEhUnidade ? prox.toUpperCase() : 'UN';

    itens.push({
      tempId: Math.random(),
      cod,
      desc: descFinal,
      perfil: produtoCatalogo?.perfil || perfilMaterial.perfil,
      material: produtoCatalogo?.material || perfilMaterial.material,
      comp,
      qtd: qtdFinal,
      pesoTotal: (pesoTotalFinal || 0).toFixed(2),
      unidade: unidadeFinal,
    });
  }

  // Fallback: se nada lido linha a linha, tenta regex no texto inteiro
  if (itens.length === 0) {
    const flat = textoCompleto.replace(/\s+/g, ' ');
    const regex = /\b(\d{1,3})\s+(\d{4,6}[A-Z]?)\s+(.+?)\s+(PC|KG|UN|UNID|PCS?|M)\s+(\d+[.,]\d+)(?:\s+(\d+[.,]\d+))?/gi;
    let m;
    while ((m = regex.exec(flat))) {
      const cod = m[2];
      const descRaw = m[3].trim();
      const unidade = m[4].toUpperCase();
      const qtd = numeroFromText(m[5]) || 0;
      const pesoTotal = numeroFromText(m[6]) || 0;

      const compDesc = extrairCompDoTexto(descRaw);
      const produtoCatalogo = CATALOGO_PRODUTOS?.find((p) => p.cod === cod);
      const perfilMaterial = inferirPerfilMaterial(descRaw);

      let comp = compDesc || produtoCatalogo?.comp || 0;
      if (!comp && /\bPERFIL\b/i.test(descRaw)) comp = 6;
      const pesoCalculadoCatalogo = produtoCatalogo
        ? produtoCatalogo.custom
          ? comp * (produtoCatalogo.kgMetro || 0) * qtd
          : (produtoCatalogo.pesoUnit || 0) * qtd
        : 0;

      const pesoTotalFinal = produtoCatalogo ? pesoCalculadoCatalogo : pesoTotal;
      const descFinal =
        produtoCatalogo?.custom && comp > 0
          ? `${produtoCatalogo?.desc || descRaw} ${comp.toFixed(2)}m`
          : produtoCatalogo?.desc || descRaw;

      itens.push({
        tempId: Math.random(),
        cod,
        desc: descFinal,
        perfil: produtoCatalogo?.perfil || perfilMaterial.perfil,
        material: produtoCatalogo?.material || perfilMaterial.material,
        comp,
        qtd,
        pesoTotal: (pesoTotalFinal || 0).toFixed(2),
        unidade,
      });
    }
  }

  return itens;
};

const parseRomaneioPdf = async (file) => {
  const linhas = await extrairLinhasDoPdf(file);
  const textoCompleto = linhas.join('\n');

  const idMatch = textoCompleto.match(/ROMANEIO:\s*([A-Z0-9]+)/i) || textoCompleto.match(/PEDIDO:\s*([A-Z0-9]+)/i);
  const clienteMatch = textoCompleto.match(/Cliente:\s*([^\n]+)/i);

  const romaneioId = idMatch ? idMatch[1].trim() : '';
  const clienteRaw = clienteMatch ? clienteMatch[1].trim() : '';
  const cliente = clienteRaw
    ? `${clienteRaw}${romaneioId ? ` - ${romaneioId}` : ''}`
    : romaneioId || '';

  let itens = parseLinhasParaItens(linhas, textoCompleto);

  // Fallback OCR: se nada lido, tenta reconhecer texto da primeira página
  if (itens.length === 0) {
    try {
      const ocrText = await extrairTextoPorOcr(file);
      if (ocrText) {
        const linhasOcr = ocrText
          .split(/\n+/)
          .map((l) => l.trim())
          .filter(Boolean);
        itens = parseLinhasParaItens(linhasOcr, linhasOcr.join('\n'));
      }
    } catch (ocrErr) {
      console.error('OCR falhou:', ocrErr);
    }
  }

  return {
    id: romaneioId,
    cliente,
    itens,
  };
};


// --- ESTILOS COMPLETO (RESTAURADO) ---


const PrintStyles = () => (
  <style>{`
    #printable-area { display: none; }
    @media print {
      @page { size: portrait; margin: 10mm; }
      html, body { background: white !important; font-family: sans-serif; font-size: 11px; color: #000; }
      .app-container, nav, .modal-overlay, .no-print { display: none !important; }
      #printable-area { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999; }
      .print-section { page-break-after: always; }
      .print-section:last-child { page-break-after: auto; }
      .print-header { border: 1px solid #000; padding: 8px; margin-bottom: 10px; box-sizing: border-box; }
      .print-header-top { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; gap: 10px; }
      .print-brand { display: flex; align-items: center; justify-content: flex-start; }
      .print-logo { height: 32px; object-fit: contain; }
      .print-headings { text-align: center; }
      .print-title { font-size: 14px; font-weight: bold; letter-spacing: 0.3px; }
      .print-subtitle { font-size: 11px; font-weight: bold; margin-top: 2px; }
      .print-control { text-align: right; font-size: 10px; }
      .print-control-label { text-transform: uppercase; letter-spacing: 0.6px; color: #333; }
      .print-control-value { font-weight: bold; font-size: 12px; margin-top: 2px; }
      .print-meta-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; margin-top: 8px; border-top: 1px solid #000; border-bottom: 1px solid #000; border-left: 1px solid #000; border-right: 1px solid #000; }
      .print-meta-chip { border: none; border-right: 1px solid #000; padding: 6px; text-align: center; font-size: 10px; }
      .print-meta-chip:last-child { border-right: none; }
      .print-meta-chip span { display: block; text-transform: uppercase; font-size: 9px; color: #333; }
      .print-meta-chip strong { display: block; margin-top: 2px; font-size: 10px; }
      .print-table { width: 100%; border-collapse: collapse; border-left: 1px solid #000; border-right: 1px solid #000; }
      .print-table th { text-align: left; padding: 6px; font-size: 9px; text-transform: uppercase; border-top: 1px solid #000; border-bottom: 1px solid #000; background: #e8eef5 !important; }
      .print-table th.center { text-align: center; }
      .print-table td { padding: 6px; border-bottom: 1px solid #000; font-size: 9px; }
      .print-table td.center { text-align: center; }
      .print-table td.left { text-align: left; }
      .print-table td.left { text-align: left; }
      .print-table td.center { text-align: center; }
    }
  `}</style>
);



export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loginInfo, setLoginInfo] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [devViewMode, setDevViewMode] = useState(() => {
    if (!IS_LOCALHOST) return 'admin';
    try {
      return localStorage.getItem(DEV_VIEW_STORAGE_KEY) || 'admin';
    } catch (err) {
      return 'admin';
    }
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileSetor, setProfileSetor] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const adminEmails = new Set([
    'pcp@metalosa.com.br',
    'pcp1@metalosa.com.br',
    'pcp5@metalosa.com.br',
    'industria@metalosa.com.br',
  ]);
  const isAdminUser =
    authUser?.email && adminEmails.has(authUser.email.toLowerCase());
  const effectiveViewMode = isAdminUser
    ? (IS_LOCALHOST ? devViewMode : 'admin')
    : 'comercial';

  useEffect(() => {
    if (!IS_LOCALHOST) return;
    try {
      localStorage.setItem(DEV_VIEW_STORAGE_KEY, devViewMode);
    } catch (err) {
      console.error('Erro ao salvar modo de visualizacao:', err);
    }
  }, [devViewMode]);


  useEffect(() => {
    if (showProfileModal) {
      setProfileError('');
    }
  }, [showProfileModal]);
  useEffect(() => {
    if (!authUser) {
      setProfileName('');
      setProfileSetor('');
      return;
    }

    let active = true;
    const localKey = `profile:${authUser.uid}`;

    try {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setProfileName(parsed?.name || '');
        setProfileSetor(parsed?.setor || '');
      }
    } catch (err) {
      console.error('Erro ao ler perfil local:', err);
    }

    const loadProfile = async () => {
      try {
        const snapshot = await getDoc(doc(db, 'users', authUser.uid));
        if (!active) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          setProfileName(data?.name || '');
          setProfileSetor(data?.setor || '');
          try {
            localStorage.setItem(localKey, JSON.stringify({
              name: data?.name || '',
              setor: data?.setor || '',
              email: authUser.email || '',
              updatedAt: Date.now(),
            }));
          } catch (err) {
            console.error('Erro ao salvar perfil local:', err);
          }
        } else {
          setProfileName('');
          setProfileSetor('');
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [authUser]);

  const handleLogin = async (email, senha) => {
    setLoginError('');
    setLoginInfo('');
    setLoginPending(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (err) {
      setLoginError('Credenciais invalidas ou acesso nao permitido.');
    } finally {
      setLoginPending(false);
    }
  };

  const handleResetPassword = async (email) => {
    setLoginError('');
    setLoginInfo('');
    const trimmed = String(email || '').trim();
    if (!trimmed) {
      setLoginError('Digite seu e-mail para receber o link.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setLoginInfo('Link de redefinicao enviado para o seu e-mail.');
    } catch (err) {
      const msg = err?.message || 'Nao foi possivel enviar o link.';
      setLoginError(msg);
    }
  };

  const handleSaveProfile = async (data) => {
    if (!authUser) return;
    setProfileError('');
    setProfileSaving(true);
    const payload = {
      name: data.name || '',
      setor: data.setor || '',
      email: authUser.email || '',
      updatedAt: Date.now(),
    };
    try {
      try {
        localStorage.setItem(`profile:${authUser.uid}`, JSON.stringify(payload));
      } catch (err) {
        console.error('Erro ao salvar perfil local:', err);
      }
      setProfileName(payload.name);
      setProfileSetor(payload.setor);
      setShowProfileModal(false);
    } finally {
      setProfileSaving(false);
    }

    (async () => {
      try {
        await setDoc(doc(db, 'users', authUser.uid), payload, { merge: true });
      } catch (err) {
        const msg = err?.message || 'Salvo localmente. Nao foi possivel salvar no Firebase.';
        console.error('Erro ao salvar perfil:', err);
        setProfileError(msg);
      }
    })();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const authGate = authLoading ? (
    <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">
      <div className="text-sm text-zinc-400">Carregando acesso...</div>
    </div>
  ) : !authUser ? (
    <LoginScreen
      onLogin={handleLogin}
      onResetPassword={handleResetPassword}
      error={loginError}
      info={loginInfo}
      pending={loginPending}
    />
  ) : null;


  const [maquinaSelecionada, setMaquinaSelecionada] = useState("");
  // datas base do app, agora 100% fuso local
  const hojeDate = new Date();
  const hoje = getLocalISODate(hojeDate);
  const amanha = getLocalISODate(
    new Date(Date.now() + 24 * 60 * 60 * 1000)
  );
  const hojeISO = hoje;
  const primeiroDiaMesAtual = getLocalISODate(
    new Date(hojeDate.getFullYear(), hojeDate.getMonth(), 1)
  );

  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [pcpAbaAtiva, setPcpAbaAtiva] = useState('ordens');
  const [pcpCrpData, setPcpCrpData] = useState(hoje);
  const [pcpFiltroData, setPcpFiltroData] = useState('');
  const [pcpFiltroMaquina, setPcpFiltroMaquina] = useState('');
  const [crpSetoresAbertos, setCrpSetoresAbertos] = useState({});
  const [crpDetalheAberto, setCrpDetalheAberto] = useState(false);
  const [crpDetalheData, setCrpDetalheData] = useState('');
  const [crpDetalheMaquinaId, setCrpDetalheMaquinaId] = useState('');
  const [crpDetalheMaquinaLabel, setCrpDetalheMaquinaLabel] = useState('');
  const [reprogramarAberto, setReprogramarAberto] = useState(false);
  const [reprogramarRomaneio, setReprogramarRomaneio] = useState(null);
  const [reprogramarData, setReprogramarData] = useState('');
  const [crpMesAberto, setCrpMesAberto] = useState({});
  const [sandboxAtivo, setSandboxAtivo] = useState(false);
  const [sandboxSnapshot, setSandboxSnapshot] = useState([]);
  const [sandboxApplyPending, setSandboxApplyPending] = useState(false);

  useEffect(() => {
    if (effectiveViewMode === 'comercial' && abaAtiva !== 'comercial') {
      setAbaAtiva('comercial');
    }
  }, [effectiveViewMode, abaAtiva]);


  const toggleItemSelecionado = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };


  const [dataFiltroImpressao, setDataFiltroImpressao] = useState(hoje);
  const [numeroControleImpressao, setNumeroControleImpressao] = useState('');
  const [filaProducao, setFilaProducao] = useState([]);

  useEffect(() => {
    if (!dataFiltroImpressao) return;
    try {
      const seqKey = 'ordemProducaoControleSeq';
      const diaKey = `ordemProducaoControle:${dataFiltroImpressao}`;
      const existente = localStorage.getItem(diaKey);
      if (existente) {
        setNumeroControleImpressao(existente);
        return;
      }
      const atual = parseInt(localStorage.getItem(seqKey) || '0', 10);
      const proximo = atual + 1;
      const label = String(proximo).padStart(3, '0');
      localStorage.setItem(seqKey, String(proximo));
      localStorage.setItem(diaKey, label);
      setNumeroControleImpressao(label);
    } catch (err) {
      console.error('Erro ao gerar numero de controle da impressao:', err);
      setNumeroControleImpressao('');
    }
  }, [dataFiltroImpressao]);
  
  // Paradas
  const [historicoParadas, setHistoricoParadas] = useState([]);
  const [dicionarioLocal, setDicionarioLocal] = useState(DICIONARIO_PARADAS || []);
  const [eventosParada, setEventosParada] = useState([]);
  const [slitterStockExt, setSlitterStockExt] = useState([]);

  
  // Apontamento Prod
  const [historicoProducaoReal, setHistoricoProducaoReal] = useState([]);
  const [formApontProdData, setFormApontProdData] = useState(hoje);
  const [formApontProdCod, setFormApontProdCod] = useState('');
  const [formApontProdDesc, setFormApontProdDesc] = useState('');
  const [formApontProdQtd, setFormApontProdQtd] = useState('');
  const [formApontProdComp, setFormApontProdComp] = useState('');
  const [formApontProdDestino, setFormApontProdDestino] = useState('Estoque');
  const [producaoEmEdicaoId, setProducaoEmEdicaoId] = useState(null);
  const [formApontProdMaquina, setFormApontProdMaquina] = useState('');

  // Indicadores
  const [dataInicioInd, setDataInicioInd] = useState(primeiroDiaMesAtual);
  const [dataFimInd, setDataFimInd] = useState(hoje);
  const [dataInicioIndDraft, setDataInicioIndDraft] = useState(primeiroDiaMesAtual);
  const [dataFimIndDraft, setDataFimIndDraft] = useState(hoje);
  const lastValidInicioIndRef = useRef(primeiroDiaMesAtual);
  const lastValidFimIndRef = useRef(hoje);
  const [capacidadeDiaria, setCapacidadeDiaria] = useState(15000); 
  const [turnoHoras, setTurnoHoras] = useState(8.8);

  // Modal Manual (COMPLETO)
  
  const [showModalNovaOrdem, setShowModalNovaOrdem] = useState(false);
  const [showModalSelecaoMaquina, setShowModalSelecaoMaquina] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [novaDataReprogramacao, setNovaDataReprogramacao] = useState('');
const [itensReprogramados, setItensReprogramados] = useState([]); // já fizemos


    useEffect(() => {
    if (showModalNovaOrdem) {
      // ao abrir o modal, limpa a seleção
      setSelectedItemIds([]);
      setNovaDataReprogramacao('');
    }
  }, [showModalNovaOrdem]);



  const [romaneioEmEdicaoId, setRomaneioEmEdicaoId] = useState(null);
  const [romaneioEmEdicaoKey, setRomaneioEmEdicaoKey] = useState(null);
  const [romaneioEmEdicao, setRomaneioEmEdicao] = useState(null);
  const [formRomaneioId, setFormRomaneioId] = useState(''); 
  const [formCliente, setFormCliente] = useState('');
  const [formTotvs, setFormTotvs] = useState(''); 
  const [formDataProducao, setFormDataProducao] = useState(hoje);
  const [itensNoPedido, setItensNoPedido] = useState([]);

  // Comercial - novo pedido/req
  const [formPedidoCliente, setFormPedidoCliente] = useState('');
  const [formPedidoSolicitante, setFormPedidoSolicitante] = useState('');
  const [formPedidoRequisicao, setFormPedidoRequisicao] = useState('');
  const [formPedidoObs, setFormPedidoObs] = useState('');
  const [formPedidoRomaneioFile, setFormPedidoRomaneioFile] = useState(null);
  const [formPedidoRomaneioUploading, setFormPedidoRomaneioUploading] = useState(false);
  const [formPedidoRomaneioParsing, setFormPedidoRomaneioParsing] = useState(false);
  const [formPedidoRomaneioErro, setFormPedidoRomaneioErro] = useState('');
  const [estoqueEstudo, setEstoqueEstudo] = useState({});
  const [formPedidoCod, setFormPedidoCod] = useState('');
  const [formPedidoDesc, setFormPedidoDesc] = useState('');
  const [formPedidoQtd, setFormPedidoQtd] = useState('');
  const [formPedidoComp, setFormPedidoComp] = useState('');
  const [itensPedidoComercial, setItensPedidoComercial] = useState([]);

  // Comercial - solicitar transferencia do estoque
  const [formTransfCliente, setFormTransfCliente] = useState('');
  const [formTransfObs, setFormTransfObs] = useState('');
  const [formTransfCod, setFormTransfCod] = useState('');
  const [formTransfDesc, setFormTransfDesc] = useState('');
  const [formTransfQtd, setFormTransfQtd] = useState('');
  const [formTransfComp, setFormTransfComp] = useState('');
  const [pcpSelecionados, setPcpSelecionados] = useState([]);
  const [comercialBusca, setComercialBusca] = useState('');
  const [comercialEstoqueBusca, setComercialEstoqueBusca] = useState('');
  const [comercialVisao, setComercialVisao] = useState('estoque');
  const [filtroEstoque, setFiltroEstoque] = useState('todos');
  const [estoqueSugestaoCod, setEstoqueSugestaoCod] = useState(null);
  const [mostrarSolicitarProducao, setMostrarSolicitarProducao] = useState(false);
  const [mostrarTransferenciaEstoque, setMostrarTransferenciaEstoque] = useState(false);
  const [comercialItensAbertos, setComercialItensAbertos] = useState({});
  const [transferModalAberto, setTransferModalAberto] = useState(false);
  const [transferPedidoSelecionado, setTransferPedidoSelecionado] = useState(null);
  const [transferDestino, setTransferDestino] = useState('');
  const [transferObs, setTransferObs] = useState('');
  const [transferItens, setTransferItens] = useState([]);
  const [mostrarAjusteEstoque, setMostrarAjusteEstoque] = useState(false);
  const [ajusteEstoqueModo, setAjusteEstoqueModo] = useState('novo');
  const [ajusteEstoqueCod, setAjusteEstoqueCod] = useState('');
  const [ajusteEstoqueDesc, setAjusteEstoqueDesc] = useState('');
  const [ajusteEstoqueComp, setAjusteEstoqueComp] = useState('');
  const [ajusteEstoqueQtd, setAjusteEstoqueQtd] = useState('');
  const [ajusteEstoqueSaldoAtual, setAjusteEstoqueSaldoAtual] = useState(0);
  const [ajusteEstoqueLockProduto, setAjusteEstoqueLockProduto] = useState(false);
  const [estoqueResetando, setEstoqueResetando] = useState(false);
  const [mostrarZeradosEstoque, setMostrarZeradosEstoque] = useState(false);

  useEffect(() => {
    if (abaAtiva === 'comercial') {
      setComercialVisao('estoque');
    }
  }, [abaAtiva]);

  const [mostrarConclusaoSolicitacao, setMostrarConclusaoSolicitacao] = useState(false);
  const [conclusaoSolicitacaoAtual, setConclusaoSolicitacaoAtual] = useState(null);
  const [conclusaoSolicitacaoPor, setConclusaoSolicitacaoPor] = useState('');
  const [conclusaoSolicitacaoObs, setConclusaoSolicitacaoObs] = useState('');

  // PCP - apontamento de estoque de telhas
  const [formEstoqueTelhaData, setFormEstoqueTelhaData] = useState(hoje);
  const [formEstoqueTelhaCod, setFormEstoqueTelhaCod] = useState('');
  const [formEstoqueTelhaDesc, setFormEstoqueTelhaDesc] = useState('');
  const [formEstoqueTelhaQtd, setFormEstoqueTelhaQtd] = useState('');
  const [formEstoqueTelhaComp, setFormEstoqueTelhaComp] = useState('');
  const [isEstoque, setIsEstoque] = useState(false); 

  // PDF Romaneio
  const [pdfItensEncontrados, setPdfItensEncontrados] = useState([]);
  const [pdfItensSelecionados, setPdfItensSelecionados] = useState([]);
  const [pdfItensMaquina, setPdfItensMaquina] = useState({});
  const [pdfInfoRomaneio, setPdfInfoRomaneio] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfErro, setPdfErro] = useState('');

  // Form Item
  const [formCod, setFormCod] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPerfil, setFormPerfil] = useState('');
  const [formMaterial, setFormMaterial] = useState('');
  const [formComp, setFormComp] = useState('');
  const [formQtd, setFormQtd] = useState('');
  const [isCustomLength, setIsCustomLength] = useState(false);
  const [dadosProdutoAtual, setDadosProdutoAtual] = useState(null);

  // Modal Parada
  const [showModalParada, setShowModalParada] = useState(false);
  const [formParadaData, setFormParadaData] = useState(hoje);
  const [formParadaInicio, setFormParadaInicio] = useState('');
  const [formParadaFim, setFormParadaFim] = useState('');
  const [formParadaMotivoCod, setFormParadaMotivoCod] = useState('');
  const [formParadaObs, setFormParadaObs] = useState('');
  

  const pesoTotalAcumuladoModal = itensNoPedido.reduce((acc, item) => acc + parseFloat(item.pesoTotal), 0);
  const qtdTotalAcumuladaModal = itensNoPedido.reduce((acc, item) => acc + parseInt(item.qtd), 0);
  const [apontamentoEmEdicaoId, setApontamentoEmEdicaoId] = useState(null);

  const [dataInicioOEE, setDataInicioOEE] = useState(hojeISO);
const [dataFimOEE, setDataFimOEE]       = useState(hojeISO);   

  useEffect(() => {
    setDataInicioIndDraft(dataInicioInd);
    if (ISO_DATE_RE.test(normalizeISODateInput(dataInicioInd || ''))) {
      lastValidInicioIndRef.current = normalizeISODateInput(dataInicioInd);
    }
  }, [dataInicioInd]);

  useEffect(() => {
    setDataFimIndDraft(dataFimInd);
    if (ISO_DATE_RE.test(normalizeISODateInput(dataFimInd || ''))) {
      lastValidFimIndRef.current = normalizeISODateInput(dataFimInd);
    }
  }, [dataFimInd]);


// ... seus useStates estão aqui em cima ...

// --- EFEITO PARA CARREGAR DADOS DO FIREBASE AO INICIAR ---

  const salvarCacheLocal = (override = {}) => {
  if (!IS_LOCALHOST) return;

  try {
    const payload = {
      producao: override.producao ?? historicoProducaoReal,
      paradas: override.paradas ?? historicoParadas,
      // se quiser, adiciona fila de romaneios aqui depois
    };
    localStorage.setItem(DEV_CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error("Erro ao salvar cache local:", err);
  }
};

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'slitterStock'),
      (snap) => {
        const logs = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setSlitterStockExt(logs);
      },
      (err) => console.error('Erro ao ler slitterStock:', err)
    );

    return () => {
      unsub();
    };
  }, []);

  
    const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const plan = payload.find(p => p.dataKey === 'pesoPlanejado')?.value || 0;
    const exec = payload.find(p => p.dataKey === 'pesoExecutado')?.value || 0;

    // Meta diária em kg: usa o state; se der problema, cai pra 15000
    const metaDiaria = Number(capacidadeDiaria) || 15000;

    const saldoVsMeta = exec - metaDiaria;
    const isPositiveMeta = saldoVsMeta >= 0;

    return (
      <div className="bg-zinc-950 border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-xl">
        <p className="text-zinc-400 text-xs mb-2 font-mono">
          {formatarDataBR(label)}
        </p>

        <div className="flex flex-col gap-2">
          {/* PLANEJADO */}
          <div className="flex items-center justify-between gap-8">
            <span className="text-zinc-500 text-xs font-bold uppercase flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
              Planejado
            </span>
            <span className="text-zinc-200 font-mono font-bold">
              {(plan / 1000).toFixed(2)}t
            </span>
          </div>

          {/* EXECUTADO */}
          <div className="flex items-center justify-between gap-8">
            <span className="text-blue-500 text-xs font-bold uppercase flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Executado
            </span>
            <span className="text-blue-400 font-mono font-bold">
              {(exec / 1000).toFixed(2)}t
            </span>
          </div>

          {/* META DO DIA */}
          <div className="flex items-center justify-between gap-8">
            <span className="text-amber-400 text-xs font-bold uppercase flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400"></div>
              Meta do dia
            </span>
            <span className="text-amber-300 font-mono font-bold">
              {(metaDiaria / 1000).toFixed(2)}t
            </span>
          </div>

          <div className="w-full h-px bg-white/10 my-1" />

          {/* SALDO VS META */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Saldo vs meta</span>
            <span
              className={`font-mono font-bold text-xs ${
                isPositiveMeta ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isPositiveMeta ? '+' : ''}
              {(saldoVsMeta / 1000).toFixed(2)}t
            </span>
          </div>
        </div>
      </div>
    );
  };

const toISODate = (v) => {
  if (!v) return "";
  // Firestore Timestamp
  if (typeof v === "object" && typeof v.toDate === "function") {
    const d = v.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // JS Date
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const day = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // string
  return String(v);
};


  
useEffect(() => {
  let unsubProducao = null;

  const carregarDados = async () => {
    // ------------------------------
    // MODO DEV (localhost)
    // ------------------------------
    if (IS_LOCALHOST) {
      console.log("🏠 Modo Dev detectado... tentando ler do localStorage");

      try {
        const salvo = localStorage.getItem(DEV_CACHE_KEY);

        if (salvo) {
          const parsed = JSON.parse(salvo);
          console.log("🔄 Cache local encontrado, carregando...");

          setFilaProducao(parsed.romaneios || []);
          setHistoricoProducaoReal(parsed.producao || []);
          setHistoricoParadas(parsed.paradas || []);

          return; // já carregou do cache, não precisa ir pro JSON nem Firebase
        }
        if (parsed.global) {
  localStorage.setItem('local_config', JSON.stringify(parsed.global.config || { diasUteis: 22 }));
  localStorage.setItem('local_maquinas', JSON.stringify(parsed.global.maquinas || []));
  localStorage.setItem('local_lancamentos', JSON.stringify(parsed.global.lancamentos || []));
}

      } catch (err) {
        console.error("Erro ao ler cache local:", err);
      }

      // Se não tiver nada no localStorage, usa o JSON da pasta (como você já fazia)
      // --- GLOBAL (pega do localStorage da GlobalScreen e guarda junto) ---
const localConfig = localStorage.getItem('local_config');
const localMaq = localStorage.getItem('local_maquinas');
const localLanc = localStorage.getItem('local_lancamentos');

setGlobalDevSnapshot({
  config: localConfig ? JSON.parse(localConfig) : null,
  maquinas: localMaq ? JSON.parse(localMaq) : [],
  lancamentos: localLanc ? JSON.parse(localLanc) : [],
});

      console.log("📁 Sem cache local, carregando do backup JSON...");
      setFilaProducao(dadosLocais.romaneios || []);
      setHistoricoProducaoReal(dadosLocais.producao || []);
      setHistoricoParadas(dadosLocais.paradas || []);
      return; // importante: não ir para o bloco do Firebase
    }

    // ------------------------------
    // MODO PRODUÇÃO (Vercel / nuvem)
    // ------------------------------
    // ------------------------------
// MODO PRODUÇÃO (Vercel / nuvem)
// ------------------------------
try {
  console.log("☁️ Modo Produção: Buscando dados do Firebase...");

  // 1. Romaneios
  const romaneiosSnapshot = await getDocs(collection(db, "romaneios"));
  const listaRomaneios = romaneiosSnapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      sysId: docSnap.id,
      ...d,
      data: toISODate(d.data), // ✅ normaliza
    };
  });
  setFilaProducao(listaRomaneios);

  // 2. Produção Real
  const producaoSnapshot = await getDocs(collection(db, "producao"));
  const listaProducao = producaoSnapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    const { id, ...rest } = d;
    return {
      id: docSnap.id,
      ...rest,
      data: toISODate(d.data), // ✅ normaliza
    };
  });
  setHistoricoProducaoReal(listaProducao);
  if (unsubProducao) unsubProducao();
  unsubProducao = onSnapshot(
    collection(db, "producao"),
    (snap) => {
      const listaProducaoRt = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const { id, ...rest } = d;
        return {
          id: docSnap.id,
          ...rest,
          data: toISODate(d.data),
        };
      });
      setHistoricoProducaoReal(listaProducaoRt);
    },
    (err) => {
      console.error("Erro ao assinar producao:", err);
      toast?.(`Erro producao: ${err?.code || err?.message || "desconhecido"}`);
    }
  );

  // 3. Paradas
  const paradasSnapshot = await getDocs(collection(db, "paradas"));
  const listaParadas = paradasSnapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      ...d,
      data: toISODate(d.data), // ✅ se existir; se não existir fica ""
    };
  });
  setHistoricoParadas(listaParadas);

  console.log("✅ Dados da nuvem carregados!", {
    romaneios: listaRomaneios.length,
    producao: listaProducao.length,
    paradas: listaParadas.length,
    sampleProducaoData: listaProducao[0]?.data,
  });
} catch (erro) {
  console.error("❌ Erro ao buscar dados:", erro);
  // MUITO importante pra você não ficar “zerado” sem saber o motivo:
  toast?.(`Erro Firebase: ${erro?.code || erro?.message || "desconhecido"}`) ||
    alert(`Erro Firebase: ${erro?.code || erro?.message || "desconhecido"}`);
}

  };

  carregarDados();
  return () => {
    if (unsubProducao) unsubProducao();
  };
}, []);

  useEffect(() => {
    const map = {};
    (estoqueConsolidado || []).forEach((item) => {
      const cod = String(item?.cod || '').trim();
      if (!cod) return;
      map[cod] = {
        demandaDiaria: Number(item?.demandaDiaria || 0),
        estoqueMaximo: Number(item?.estoqueMaximo || 0),
        unidade: String(item?.unidade || 'kg').toLowerCase(),
        maquina: item?.maquina || '',
        grupo: item?.grupo || '',
      };
    });
    setEstoqueEstudo(map);
  }, []);




useEffect(() => {
  if (!IS_LOCALHOST) return;

  try {
    // lê o que a GlobalScreen mantém no localStorage
    const localConfig = localStorage.getItem('local_config');
    const localMaq = localStorage.getItem('local_maquinas');
    const localLanc = localStorage.getItem('local_lancamentos');

    const payload = {
      romaneios: filaProducao,
      producao: historicoProducaoReal,
      paradas: historicoParadas,

      // ✅ NOVO: snapshot da GlobalScreen
      global: {
        config: localConfig ? JSON.parse(localConfig) : null,
        maquinas: localMaq ? JSON.parse(localMaq) : [],
        lancamentos: localLanc ? JSON.parse(localLanc) : [],
      },
    };

    localStorage.setItem(DEV_CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error("Erro ao salvar DEV_CACHE_KEY:", err);
  }
}, [filaProducao, historicoProducaoReal, historicoParadas]);





  // --- IMPORTAÇÃO EXCEL ---
  const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const bstr = evt.target.result;
    const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const novosRomaneiosMap = {};

    data.forEach((row) => {
      const id = encontrarValorNaLinha(row, ['ID', 'ROMANEIO', 'PEDIDO', 'ORDEM', 'Nº']);
      if (!id) return;
      const idStr = String(id).trim();

      // 🔹 Data REAL daquela linha
      const rawDate = encontrarValorNaLinha(row, ['DATA', 'DT', 'ENTREGA', 'EMISSAO']);
      const cleanDate = processarDataExcel(rawDate);

      // 🔹 Usa ID + DATA como chave interna
      const mapKey = `${idStr}__${cleanDate}`;

      if (!novosRomaneiosMap[mapKey]) {
        const cliente = encontrarValorNaLinha(row, ['CLIENTE', 'NOME', 'RAZAO']) || 'Importado';
        const totvs = encontrarValorNaLinha(row, ['TOTVS', 'PC']) || '';

        novosRomaneiosMap[mapKey] = {
          id: idStr,              // continua mostrando só o número do romaneio
          sysId: Math.random(),
          cliente,
          totvs,
          data: cleanDate,        // cada pedaço fica no dia certo
          status: 'PENDENTE',
          itens: []
        };
      }

      const cod = String(encontrarValorNaLinha(row, ['COD', 'CODIGO']) || '');
      const desc = String(encontrarValorNaLinha(row, ['DESC', 'DESCRICAO']) || 'Item');
      const perfil = String(encontrarValorNaLinha(row, ['PERFIL']) || '');
      const material = String(encontrarValorNaLinha(row, ['MAT']) || '');
      const comp = parseFloat(String(encontrarValorNaLinha(row, ['COMP']) || 0).replace(',', '.'));
      const qtd = parseInt(String(encontrarValorNaLinha(row, ['QTD']) || 0).replace(',', '.'));

      // 🔹 Lê o peso certo da planilha
      const pesoBruto = encontrarValorNaLinha(row, ['PESO_TOTAL', 'PESO TOTAL', 'PESO']);
      const pesoTotal = parseFloat(String(pesoBruto || 0).replace(',', '.'));

      novosRomaneiosMap[mapKey].itens.push({
        tempId: Math.random(),
        cod,
        desc,
        perfil,
        material,
        comp: comp || 0,
        qtd: qtd || 0,
        pesoTotal: pesoTotal.toFixed(2)
      });
    });

    const listaNovos = Object.values(novosRomaneiosMap);

    if (listaNovos.length > 0) {
      setFilaProducao((prev) => {
        // ainda remove romaneios antigos com o mesmo ID
        const idsNovos = new Set(listaNovos.map((r) => r.id));
        const limpo = prev.filter((r) => !idsNovos.has(r.id));
        return [...limpo, ...listaNovos];
      });

      alert(`${listaNovos.length} romaneios importados/atualizados.`);
    }
  };

  reader.readAsBinaryString(file);
  e.target.value = null;
};

  const handleUploadPdfRomaneio = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfErro('');
    setPdfLoading(true);

    try {
      const parsed = await parseRomaneioPdf(file);

      if (!parsed?.itens?.length) {
        throw new Error('Nenhum item encontrado no PDF.');
      }

      setPdfInfoRomaneio({ id: parsed.id, cliente: parsed.cliente });
      setPdfItensEncontrados(parsed.itens);
      setPdfItensSelecionados(parsed.itens.map((i) => i.tempId));
      setPdfItensMaquina(
        parsed.itens.reduce((acc, item) => {
          acc[item.tempId] = inferirMaquinaPorItem(item);
          return acc;
        }, {})
      );

      if (parsed.id && !formRomaneioId) setFormRomaneioId(parsed.id);
      if (parsed.cliente) setFormCliente(parsed.cliente);
    } catch (err) {
      console.error('Erro ao ler PDF do romaneio:', err);
      setPdfErro(`Não consegui ler o PDF (${err?.message || 'erro desconhecido'}). Veja o console para detalhes.`);
    } finally {
      setPdfLoading(false);
      e.target.value = null;
    }
  };

  const handleUploadPedidoRomaneio = async (e) => {
    const file = e.target.files?.[0] || null;
    setFormPedidoRomaneioFile(file);
    if (!file) return;

    setFormPedidoRomaneioErro('');
    setFormPedidoRomaneioParsing(true);

    try {
      const parsed = await parseRomaneioPdf(file);
      if (!parsed?.itens?.length) {
        throw new Error('Nenhum item encontrado no PDF.');
      }

      setItensPedidoComercial(parsed.itens);
      if (parsed.cliente) {
        setFormPedidoCliente((prev) => prev || parsed.cliente);
      }
      if (parsed.id) {
        setFormPedidoRequisicao((prev) => prev || parsed.id);
      }
    } catch (err) {
      console.error('Erro ao ler PDF do romaneio (comercial):', err);
      setFormPedidoRomaneioErro(`Nao consegui ler o PDF (${err?.message || 'erro desconhecido'}). Veja o console para detalhes.`);
    } finally {
      setFormPedidoRomaneioParsing(false);
      e.target.value = null;
    }
  };

  const togglePdfItemSelecionado = (tempId) => {
    setPdfItensSelecionados((prev) =>
      prev.includes(tempId) ? prev.filter((id) => id !== tempId) : [...prev, tempId]
    );
  };

  const adicionarItensPdfSelecionados = () => {
    const selecionados = pdfItensEncontrados.filter((i) =>
      pdfItensSelecionados.includes(i.tempId)
    );

    if (!selecionados.length) {
      alert('Selecione ao menos um item do PDF.');
      return;
    }

    setItensNoPedido((prev) => [...prev, ...selecionados]);
    setPdfItensEncontrados([]);
    setPdfItensSelecionados([]);
    setPdfItensMaquina({});
    setPdfInfoRomaneio(null);
  };


  const handleDownloadModelo = () => {
    const ws = XLSX.utils.json_to_sheet([{ ID: '5001', CLIENTE: 'EXEMPLO', DATA: '2025-12-08', TOTVS: 'PC-1', COD: '02006', DESC: 'TELHA', PERFIL: 'TP40', MATERIAL: 'GALV', COMP: 6.00, QTD: 10, PESO_TOTAL: 225.6 }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Modelo"); XLSX.writeFile(wb, "Modelo_Importacao.xlsx");
  };


// Modelo de APONTAMENTO DE PRODUÇÃO
const handleDownloadModeloApontProd = () => {
  const ws = XLSX.utils.json_to_sheet([
    {
      DATA: "2025-12-08", // aceita 2025-12-08 ou 08/12/2025
      MAQUINA_ID: "",     // ex: "maq_01" (ou o id que você usa no catalogoMaquinas)
      CODIGO: "02006",
      DESCRICAO: "TELHA TP40 GALV",
      QTD: 120,
      DESTINO: "Estoque", // ou Cometa 04 / Serra 06 etc.
    },
  ]);

  // opcional: larguras melhores no Excel
  ws["!cols"] = [
    { wch: 12 }, // DATA
    { wch: 18 }, // MAQUINA_ID
    { wch: 10 }, // CODIGO
    { wch: 30 }, // DESCRICAO
    { wch: 8 },  // QTD
    { wch: 16 }, // DESTINO
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Apont_Producao");
  XLSX.writeFile(wb, "Modelo_Apontamento_Producao.xlsx");
};

// Modelo de APONTAMENTO DE PARADAS
const handleDownloadModeloParadas = () => {
  const hojeISO = getLocalISODate();

  const exemplo = [
    {
      DATA: hojeISO,      // data da parada
      INICIO: '07:00',    // hora inicial
      FIM: '07:30',       // hora final
      COD_MOTIVO: dicionarioLocal[0]?.codigo || '001', // código do dicionário
      OBS: 'Parada de exemplo'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(exemplo);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Paradas');
  XLSX.writeFile(wb, 'Modelo_Paradas.xlsx');
};


  // --- CRUD GERAL ---
  const handlePrint = () => window.print();
  const toggleEstoque = () => { setIsEstoque(!isEstoque); setFormRomaneioId(isEstoque ? '' : 'ESTOQUE'); setFormCliente(isEstoque ? '' : 'ESTOQUE INTERNO'); };
  
  const handleSelectProduto = (e) => {
    const codigo = e.target.value; setFormCod(codigo);
    // Proteção para caso o catálogo não carregue
    if (CATALOGO_PRODUTOS) {
        const p = CATALOGO_PRODUTOS.find(x => x.cod === codigo);
        if (p) { setDadosProdutoAtual(p); setFormDesc(p.desc); setFormPerfil(p.perfil); setFormMaterial(p.material); setIsCustomLength(p.custom); setFormComp(p.custom?'':p.comp); }
        else { setDadosProdutoAtual(null); if(!codigo) resetItemFields(); }
    }
  };
  const resetItemFields = () => { setFormCod(''); setFormDesc(''); setFormPerfil(''); setFormMaterial(''); setFormComp(''); setFormQtd(''); setIsCustomLength(false); setDadosProdutoAtual(null); };
  const handleSelectProdutoPedidoComercial = (e) => {
    const codigo = e.target.value;
    setFormPedidoCod(codigo);
    if (CATALOGO_PRODUTOS) {
      const p = CATALOGO_PRODUTOS.find((x) => x.cod === codigo);
      if (p) {
        setFormPedidoDesc(p.desc);
        setFormPedidoComp(p.custom ? '' : p.comp || '');
      } else if (!codigo) {
        resetItemPedidoComercial();
      }
    }
  };
  const resetItemPedidoComercial = () => {
    setFormPedidoCod('');
    setFormPedidoDesc('');
    setFormPedidoComp('');
    setFormPedidoQtd('');
  };

  const handleSelectEstoqueTelhaProduto = (e) => {
    const codigo = e.target.value;
    setFormEstoqueTelhaCod(codigo);
    if (CATALOGO_PRODUTOS) {
      const p = CATALOGO_PRODUTOS.find((x) => x.cod === codigo);
      if (p) {
        setFormEstoqueTelhaDesc(p.desc);
        setFormEstoqueTelhaComp(p.custom ? '' : p.comp || '');
      } else if (!codigo) {
        resetFormEstoqueTelha();
      }
    }
  };

  const resetFormEstoqueTelha = () => {
    setFormEstoqueTelhaCod('');
    setFormEstoqueTelhaDesc('');
    setFormEstoqueTelhaComp('');
    setFormEstoqueTelhaQtd('');
  };
  const toggleItensComercial = (chave) => {
    setComercialItensAbertos((prev) => ({
      ...prev,
      [chave]: !prev[chave],
    }));
  };
  const handleSelectTransfProduto = (e) => {
    const codigo = e.target.value;
    setFormTransfCod(codigo);
    if (CATALOGO_PRODUTOS) {
      const p = CATALOGO_PRODUTOS.find((x) => x.cod === codigo);
      if (p) {
        setFormTransfDesc(p.desc);
        setFormTransfComp(p.custom ? '' : p.comp || '');
      } else if (!codigo) {
        resetFormTransferencia();
      }
    }
  };
  const resetFormTransferencia = () => {
    setFormTransfCod('');
    setFormTransfDesc('');
    setFormTransfComp('');
    setFormTransfQtd('');
  };
  const adicionarItemNaLista = () => {
    if (!formDesc || !formQtd) return alert("Preencha dados.");
    const qtd = parseInt(formQtd); const comp = parseFloat(formComp) || 0;
    let peso = dadosProdutoAtual ? (dadosProdutoAtual.custom ? (comp * dadosProdutoAtual.kgMetro * qtd) : (dadosProdutoAtual.pesoUnit * qtd)) : 0;
    setItensNoPedido([...itensNoPedido, { tempId: Math.random(), cod: formCod, desc: formDesc, perfil: formPerfil, material: formMaterial, comp, qtd, pesoTotal: peso.toFixed(2) }]);
    resetItemFields();
  };
  const removerItemDaLista = (id) => setItensNoPedido(itensNoPedido.filter(i => i.tempId !== id));
  const inferirMaquinaPorItem = (item) => {
    const produto = CATALOGO_PRODUTOS?.find((p) => p.cod === item?.cod);
    const grupo =
      produto?.grupo ||
      (/TELHA|CUMEEIRA/i.test(item?.desc || '') ? 'GRUPO_TELHAS' : /PERFIL/i.test(item?.desc || '') ? 'GRUPO_PERFIS' : '');
    if (!grupo) return '';
    const maquinaDefault = CATALOGO_MAQUINAS.find((m) => m.grupo === grupo);
    return maquinaDefault?.maquinaId || maquinaDefault?.id || '';
  };
  const inferirMaquinaPorItens = (itens) => {
    if (!Array.isArray(itens) || itens.length === 0) return '';
    const grupos = itens.map((i) => {
      const produto = CATALOGO_PRODUTOS?.find((p) => p.cod === i.cod);
      return produto?.grupo || '';
    });
    const temNaoTelha = grupos.some((g) => g && g !== 'GRUPO_TELHAS');
    const temTelha = grupos.some((g) => g === 'GRUPO_TELHAS');
    if (temTelha && !temNaoTelha) return 'CONFORMADORA_TELHAS';
    return '';
  };

  const adicionarItemPedidoComercial = () => {
    if (!formPedidoDesc || !formPedidoQtd) {
      alert("Preencha produto e quantidade.");
      return;
    }

    const qtd = parseInt(formPedidoQtd, 10) || 0;
    if (!qtd) {
      alert("Quantidade invÇ­lida.");
      return;
    }

    const produto = CATALOGO_PRODUTOS?.find((p) => p.cod === formPedidoCod);
    const comp = parseFloat(formPedidoComp) || produto?.comp || 0;
    if (produto?.custom && !comp) {
      alert("Informe o comprimento (m) para itens sob medida.");
      return;
    }

    const peso = produto
      ? produto.custom
        ? comp * (produto.kgMetro || 0) * qtd
        : (produto.pesoUnit || 0) * qtd
      : 0;

    setItensPedidoComercial((prev) => [
      ...prev,
      {
        tempId: Math.random(),
        cod: formPedidoCod,
        desc: formPedidoDesc,
        comp,
        qtd,
        pesoTotal: peso.toFixed(2),
      },
    ]);
    resetItemPedidoComercial();
  };

  const removerItemPedidoComercial = (id) => {
    setItensPedidoComercial((prev) => prev.filter((i) => i.tempId !== id));
  };

  const salvarApontamentoEstoqueTelha = async () => {
    if (sandboxAtivo) {
      alert('Modo simulacao ativo: ajuste de estoque desativado.');
      return;
    }
    if (!formEstoqueTelhaCod || !formEstoqueTelhaQtd) {
      alert("Informe o codigo e a quantidade.");
      return;
    }

    const qtd = parseInt(formEstoqueTelhaQtd, 10) || 0;
    if (!qtd) {
      alert("Quantidade invalida.");
      return;
    }

    const produto = CATALOGO_PRODUTOS?.find((p) => p.cod === formEstoqueTelhaCod);
    const comp = parseFloat(formEstoqueTelhaComp) || produto?.comp || 0;
    if (produto?.custom && !comp) {
      alert("Informe o comprimento (m) para itens sob medida.");
      return;
    }

    const pesoPorPeca = produto
      ? produto.custom
        ? (produto.kgMetro || 0) * comp
        : produto.pesoUnit || 0
      : 0;
    const pesoTotal = pesoPorPeca * qtd;
    const agoraISO = new Date().toISOString();

    const obj = {
      data: formEstoqueTelhaData || getLocalISODate(),
      cod: formEstoqueTelhaCod,
      desc: formEstoqueTelhaDesc || produto?.desc || "Item s/ descricao",
      qtd,
      comp,
      pesoTotal,
      pesoPorPeca,
      m2Total: comp * qtd,
      destino: "Estoque",
      maquinaId: "",
      origem: "PCP_ESTOQUE",
      createdAt: agoraISO,
    };

    try {
    if (isSandboxed) {
      setHistoricoProducaoReal((prev) => [{ id: `local-${Date.now()}`, ...obj }, ...prev]);
      resetFormEstoqueTelha();
      alert(sandboxAtivo ? "Estoque apontado (modo simulacao)." : "Estoque apontado (modo local).");
      return;
    }

      const docRef = await safeAddDoc("producao", obj);
      const newId = docRef?.id || `local-${Date.now()}`;
      setHistoricoProducaoReal((prev) => [{ id: newId, ...obj }, ...prev]);
      resetFormEstoqueTelha();
      alert("Estoque apontado.");
    } catch (err) {
      console.error("Erro ao apontar estoque:", err);
      alert("Erro ao salvar estoque. Veja o console (F12).");
    }
  };

  const resetAjusteEstoque = () => {
    setAjusteEstoqueModo('novo');
    setAjusteEstoqueCod('');
    setAjusteEstoqueDesc('');
    setAjusteEstoqueComp('');
    setAjusteEstoqueQtd('');
    setAjusteEstoqueSaldoAtual(0);
  };

  const handleSelectAjusteEstoqueProduto = (e) => {
    const codigo = e.target.value;
    setAjusteEstoqueCod(codigo);
    if (CATALOGO_PRODUTOS) {
      const produto = CATALOGO_PRODUTOS.find((p) => p.cod === codigo);
      setAjusteEstoqueDesc(produto?.desc || '');
      setAjusteEstoqueComp(produto?.custom ? '' : String(produto?.comp || ''));
    }
    const saldoAtual = Number(
      estoqueComercialBase.find((item) => String(item.cod) === String(codigo))?.saldoQtd || 0
    );
    setAjusteEstoqueSaldoAtual(saldoAtual);
    if (ajusteEstoqueModo === 'editar') {
      setAjusteEstoqueQtd(String(saldoAtual));
    }
  };

  const abrirAjusteEstoqueNovo = () => {
    resetAjusteEstoque();
    setAjusteEstoqueModo('novo');
    setAjusteEstoqueLockProduto(false);
    setMostrarAjusteEstoque(true);
  };

  const abrirAjusteEstoqueInventario = () => {
    resetAjusteEstoque();
    setAjusteEstoqueModo('editar');
    setAjusteEstoqueLockProduto(false);
    setMostrarAjusteEstoque(true);
  };

  const abrirAjusteEstoqueEdicao = (item) => {
    const saldoAtual = Number(item?.saldoQtd || 0);
    setAjusteEstoqueModo('editar');
    setAjusteEstoqueLockProduto(true);
    setAjusteEstoqueCod(item?.cod || '');
    setAjusteEstoqueDesc(item?.desc || '');
    setAjusteEstoqueComp(
      item?.comp !== undefined && item?.comp !== null ? String(item.comp) : ''
    );
    setAjusteEstoqueSaldoAtual(saldoAtual);
    setAjusteEstoqueQtd(String(saldoAtual));
    setMostrarAjusteEstoque(true);
  };

  const zerarEstoqueDireto = async () => {
    if (estoqueResetando) return;
    if (IS_LOCALHOST) {
      alert('Modo local: limpeza bloqueada.');
      return;
    }

    const producaoAlvos = historicoProducaoReal.filter((item) => {
      const destino = String(item?.destino || '').toLowerCase();
      const origem = String(item?.origem || '').toLowerCase();
      const tipo = String(item?.tipo || '').toLowerCase();
      const cliente = String(item?.cliente || '').toLowerCase();
      const romaneioId = String(item?.romaneioId || item?.id || '').toLowerCase();
      return (
        destino.includes('estoque') ||
        origem.includes('estoque') ||
        tipo === 'est' ||
        cliente.includes('estoque') ||
        romaneioId === 'estoque'
      );
    });

    const slitterAlvos = slitterStockExt.filter((item) => item?.id);

    if (!producaoAlvos.length && !slitterAlvos.length) {
      alert('Nao ha registros de estoque para apagar.');
      return;
    }

    const ok = window.confirm(
      `Isso vai apagar ${producaoAlvos.length} registros de estoque e ${slitterAlvos.length} do slitterStock. Continuar?`
    );
    if (!ok) return;

    const okFinal = window.confirm('Acao irreversivel. Deseja confirmar?');
    if (!okFinal) return;

    setEstoqueResetando(true);
    try {
      let removidosProd = 0;
      for (const item of producaoAlvos) {
        if (!item?.id) continue;
        await safeDeleteDoc('producao', String(item.id));
        removidosProd += 1;
      }

      let removidosSlitter = 0;
      for (const item of slitterAlvos) {
        await safeDeleteDoc('slitterStock', String(item.id));
        removidosSlitter += 1;
      }

      alert(
        `Estoque zerado. Removidos: ${removidosProd} em producao e ${removidosSlitter} em slitterStock.`
      );
    } catch (err) {
      console.error('Erro ao zerar estoque:', err);
      alert('Erro ao apagar estoque. Veja o console (F12).');
    } finally {
      setEstoqueResetando(false);
    }
  };

  const salvarAjusteEstoque = async ({ cod, desc, comp, qtd }) => {
    const quantidade = Number(qtd);
    if (!Number.isFinite(quantidade) || quantidade === 0) {
      alert('Quantidade invalida.');
      return false;
    }

    const produto = CATALOGO_PRODUTOS?.find((p) => p.cod === cod);
    const compNumero = parseFloat(comp) || produto?.comp || 0;
    if (produto?.custom && !compNumero) {
      alert('Informe o comprimento (m) para itens sob medida.');
      return false;
    }

    const pesoPorPeca = produto
      ? produto.custom
        ? (produto.kgMetro || 0) * compNumero
        : produto.pesoUnit || 0
      : 0;
    const pesoTotal = pesoPorPeca * quantidade;
    const agoraISO = new Date().toISOString();

    const obj = {
      data: getLocalISODate(),
      cod,
      desc: desc || produto?.desc || 'Item s/ descricao',
      qtd: quantidade,
      comp: compNumero,
      pesoTotal,
      pesoPorPeca,
      m2Total: compNumero * quantidade,
      destino: 'Estoque',
      maquinaId: '',
      origem: 'AJUSTE_ESTOQUE',
      createdAt: agoraISO,
    };

    try {
      if (IS_LOCALHOST) {
        setHistoricoProducaoReal((prev) => [{ id: `local-${Date.now()}`, ...obj }, ...prev]);
        return true;
      }

      const docRef = await safeAddDoc('producao', obj);
      const newId = docRef?.id || `local-${Date.now()}`;
      setHistoricoProducaoReal((prev) => [{ id: newId, ...obj }, ...prev]);
      return true;
    } catch (err) {
      console.error('Erro ao ajustar estoque:', err);
      alert('Erro ao salvar estoque. Veja o console (F12).');
      return false;
    }
  };

  const aplicarAjusteEstoque = async () => {
    if (!ajusteEstoqueCod) {
      alert('Selecione um produto.');
      return;
    }

    const novaQtd = parseInt(ajusteEstoqueQtd, 10);
    if (!Number.isFinite(novaQtd)) {
      alert('Quantidade invalida.');
      return;
    }

    if (ajusteEstoqueModo === 'novo' && novaQtd <= 0) {
      alert('Informe uma quantidade maior que zero.');
      return;
    }

    const delta =
      ajusteEstoqueModo === 'editar'
        ? novaQtd - ajusteEstoqueSaldoAtual
        : novaQtd;

    if (!delta) {
      alert('Nada a ajustar.');
      return;
    }

    const ok = await salvarAjusteEstoque({
      cod: ajusteEstoqueCod,
      desc: ajusteEstoqueDesc,
      comp: ajusteEstoqueComp,
      qtd: delta,
    });

    if (ok) {
      resetAjusteEstoque();
      setMostrarAjusteEstoque(false);
      alert('Estoque ajustado.');
    }
  };

  const excluirItemEstoque = async (item) => {
    const saldoAtual = Number(item?.saldoQtd || 0);
    if (!saldoAtual) {
      alert('Item sem saldo para excluir.');
      return;
    }
    const ok = window.confirm('Excluir este item do estoque? Isso zera o saldo.');
    if (!ok) return;

    const salvou = await salvarAjusteEstoque({
      cod: item?.cod,
      desc: item?.desc,
      comp: item?.comp,
      qtd: -saldoAtual,
    });

    if (salvou) {
      alert('Estoque zerado.');
    }
  };
  
  const salvarRomaneio = async () => {
  try {
    const maquinaInferida = !maquinaSelecionada
      ? inferirMaquinaPorItens(itensNoPedido)
      : '';
    const maquinaEfetiva = maquinaSelecionada || maquinaInferida;
    if (!maquinaEfetiva) {
      alert("Selecione a mÇ­quina para esta ordem.");
      return;
    }
    if (!formRomaneioId || !formDataProducao) {
      alert("Preencha o Romaneio e a Data.");
      return;
    }

    if (!formCliente && !isEstoque) {
      alert("Preencha o Cliente.");
      return;
    }

    const agoraISO = new Date().toISOString();

    // 1) ROMANEIO DO DIA ATUAL (já sem os itens reprogramados)
    const objAtual = {
      // 🔹 padroniza o nome dos campos
      id: formRomaneioId,
      romaneioId: formRomaneioId,          // mantém espelho pra não quebrar nada
      data: formDataProducao,
      dataProducao: formDataProducao,      // idem

      cliente: formCliente || "",
      totvs: formTotvs || "",
      tipo: isEstoque ? "EST" : "PED",
      maquinaId: maquinaEfetiva,
      itens: itensNoPedido,
      updatedAt: agoraISO,
    };

    console.log(">>> Salvando romaneio atual...", {
      romaneioEmEdicaoId,
      objAtual,
      itensReprogramados,
      novaDataReprogramacao,
    });

    // Modo localhost: apenas atualiza estado/localStorage, sem Firebase
    if (isSandboxed) {
      const localPrefix = sandboxAtivo ? 'SANDBOX' : 'LOCAL';
      const editKey = romaneioEmEdicaoKey || romaneioEmEdicaoId;
      const sysIdAtual =
        romaneioEmEdicaoId ||
        (editKey && (String(editKey).startsWith('LOCAL-') || String(editKey).startsWith('SANDBOX-'))
          ? editKey
          : `${localPrefix}-${Date.now()}`);
      const atualizada = editKey
        ? filaProducao.map((r) =>
            (r.sysId || r.id) === editKey
              ? { ...r, ...objAtual, sysId: sysIdAtual }
              : r
          )
        : [...filaProducao, { ...objAtual, sysId: sysIdAtual }];

      let comReprogramado = atualizada;
      if (itensReprogramados && itensReprogramados.length > 0 && novaDataReprogramacao) {
        const objReprogramado = {
          ...objAtual,
          itens: itensReprogramados,
          data: novaDataReprogramacao,
          dataProducao: novaDataReprogramacao,
          origemReprogramacao: sysIdAtual,
          createdFromReprogramacao: true,
          createdAt: agoraISO,
          sysId: `${localPrefix}-${Date.now()}-R`,
        };
        comReprogramado = [...atualizada, objReprogramado];
      }

      setFilaProducao(comReprogramado);
      setItensReprogramados([]);
      setSelectedItemIds([]);
      setNovaDataReprogramacao("");
      alert(sandboxAtivo ? "Romaneio salvo (modo simulacao)." : "Romaneio salvo (modo local).");
      setShowModalNovaOrdem(false);
      return;
    }

    // 2) GRAVA / ATUALIZA ROMANEIO ATUAL
    let sysIdAtual = romaneioEmEdicaoId || null;

    if (romaneioEmEdicaoId) {
      await setDoc(doc(db, "romaneios", romaneioEmEdicaoId), objAtual, {
        merge: true,
      });
    } else {
      const docRef = await addDoc(collection(db, "romaneios"), objAtual);
      sysIdAtual = docRef.id;
    }

    // 3) SE TIVER ITENS REPROGRAMADOS + DATA NOVA, CRIA ROMANEIO DO OUTRO DIA
    if (
      itensReprogramados &&
      itensReprogramados.length > 0 &&
      novaDataReprogramacao
    ) {
      const objReprogramado = {
        id: formRomaneioId,
        romaneioId: formRomaneioId,
        data: novaDataReprogramacao,
        dataProducao: novaDataReprogramacao,

        cliente: formCliente || "",
        totvs: formTotvs || "",
        tipo: isEstoque ? "EST" : "PED",
        maquinaId: maquinaEfetiva,
        itens: itensReprogramados,
        origemReprogramacao: sysIdAtual,
        createdFromReprogramacao: true,
        createdAt: agoraISO,
        updatedAt: agoraISO,
      };

      await addDoc(collection(db, "romaneios"), objReprogramado);

      console.log("✅ Romaneio reprogramado criado:", objReprogramado);
    }

    // 4) RECARREGA A FILA TODA DO FIRESTORE
    const romaneiosSnapshot = await getDocs(collection(db, "romaneios"));
    const listaRomaneios = romaneiosSnapshot.docs.map((docSnap) => ({
      sysId: docSnap.id,
      ...docSnap.data(),
    }));
    setFilaProducao(listaRomaneios);

    // 5) LIMPA ESTADOS E FECHA MODAL
    setItensReprogramados([]);
    setSelectedItemIds([]);
    setNovaDataReprogramacao("");

    alert("Romaneio salvo com sucesso!");
    setShowModalNovaOrdem(false);
  } catch (err) {
    console.error("Erro ao salvar o romaneio no Firestore:", err);
    alert("Erro ao salvar romaneio. Veja o console (F12).");
  }
};

  const finalizarOrdemProgramada = async () => {
    if (sandboxAtivo) {
      alert('Modo simulacao ativo: finalize desativado.');
      return;
    }
    const maquinaInferida = !maquinaSelecionada
      ? inferirMaquinaPorItens(itensNoPedido)
      : '';
    const maquinaEfetiva = maquinaSelecionada || maquinaInferida;
    if (!maquinaEfetiva) {
      alert("Selecione a m\u00e1quina para esta ordem.");
      return;
    }
    if (!formRomaneioId) {
      alert("Salve o romaneio antes de finalizar.");
      return;
    }
    if (!Array.isArray(itensNoPedido) || itensNoPedido.length === 0) {
      alert("Adicione itens antes de finalizar.");
      return;
    }

    const alvo = filaProducao.find(
      (r) => r.sysId === romaneioEmEdicaoId || r.id === formRomaneioId
    );
    if (alvo?.status === "PRONTO" || alvo?.status === "FINALIZADO") {
      alert("Essa ordem j\u00e1 est\u00e1 finalizada.");
      return;
    }

    const agoraISO = new Date().toISOString();
    const dataApontamento = getLocalISODate();

    const itensApontar = itensNoPedido.map((item) => {
      const produto = CATALOGO_PRODUTOS?.find((p) => p.cod === item.cod);
      const qtd = Number(item.qtd || 0);
      const comp = Number(item.comp || produto?.comp || 0);
      const pesoTotal = Number(item.pesoTotal || 0);
      const pesoPorPeca = qtd ? pesoTotal / qtd : 0;
      return {
        data: dataApontamento,
        cod: item.cod,
        desc: item.desc || produto?.desc || "Item s/ descricao",
        qtd,
        comp,
        pesoTotal,
        pesoPorPeca,
        m2Total: comp * qtd,
        destino: "Estoque",
        maquinaId: maquinaEfetiva,
        origem: "FINALIZACAO_ORDEM",
        romaneioId: formRomaneioId,
        cliente: formCliente || "",
        createdAt: agoraISO,
      };
    });

    try {
      if (IS_LOCALHOST) {
        setHistoricoProducaoReal((prev) => [
          ...itensApontar.map((i) => ({ id: `local-${Date.now()}-${Math.random()}`, ...i })),
          ...prev,
        ]);
        setFilaProducao((prev) =>
          prev.map((r) =>
            r.sysId === romaneioEmEdicaoId || r.id === formRomaneioId
              ? { ...r, status: "PRONTO", updatedAt: agoraISO }
              : r
          )
        );
        alert("Ordem finalizada e enviada para estoque.");
        return;
      }

      for (const item of itensApontar) {
        await safeAddDoc("producao", item);
      }

      if (romaneioEmEdicaoId) {
        await safeUpdateDoc("romaneios", String(romaneioEmEdicaoId), {
          status: "PRONTO",
          updatedAt: agoraISO,
        });
      }

      setHistoricoProducaoReal((prev) => [
        ...itensApontar.map((i) => ({ id: `local-${Date.now()}-${Math.random()}`, ...i })),
        ...prev,
      ]);
      setFilaProducao((prev) =>
        prev.map((r) =>
          r.sysId === romaneioEmEdicaoId || r.id === formRomaneioId
            ? { ...r, status: "PRONTO", updatedAt: agoraISO }
            : r
        )
      );
      alert("Ordem finalizada e enviada para estoque.");
    } catch (err) {
      console.error("Erro ao finalizar ordem:", err);
      alert("Erro ao finalizar ordem. Veja o console (F12).");
    }
  };

  const togglePcpSelecionado = (id) => {
    setPcpSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const finalizarRomaneioRapido = async (romaneio) => {
    if (sandboxAtivo) {
      return { ok: false, motivo: 'sandbox' };
    }
    if (!romaneio) return { ok: false, motivo: 'invalido' };
    if (romaneio.status === 'PRONTO' || romaneio.status === 'FINALIZADO') {
      return { ok: false, motivo: 'ja_finalizado' };
    }

    const maquinaEfetiva =
      romaneio.maquinaId || inferirMaquinaPorItens(romaneio.itens);
    if (!maquinaEfetiva) {
      return { ok: false, motivo: 'sem_maquina' };
    }

    const agoraISO = new Date().toISOString();
    const dataApontamento = getLocalISODate();
    const itensApontar = (romaneio.itens || []).map((item) => {
      const produto = CATALOGO_PRODUTOS?.find((p) => p.cod === item.cod);
      const qtd = Number(item.qtd || 0);
      const comp = Number(item.comp || produto?.comp || 0);
      const pesoTotal = Number(item.pesoTotal || 0);
      const pesoPorPeca = qtd ? pesoTotal / qtd : 0;
      return {
        data: dataApontamento,
        cod: item.cod,
        desc: item.desc || produto?.desc || 'Item s/ descricao',
        qtd,
        comp,
        pesoTotal,
        pesoPorPeca,
        m2Total: comp * qtd,
        destino: 'Estoque',
        maquinaId: maquinaEfetiva,
        origem: 'FINALIZACAO_RAPIDA',
        romaneioId: romaneio.id || romaneio.romaneioId || '',
        cliente: romaneio.cliente || '',
        createdAt: agoraISO,
      };
    });

    try {
      if (IS_LOCALHOST) {
        setHistoricoProducaoReal((prev) => [
          ...itensApontar.map((i) => ({
            id: `local-${Date.now()}-${Math.random()}`,
            ...i,
          })),
          ...prev,
        ]);
        setFilaProducao((prev) =>
          prev.map((r) =>
            (r.sysId || r.id) === (romaneio.sysId || romaneio.id)
              ? { ...r, status: 'PRONTO', updatedAt: agoraISO }
              : r
          )
        );
        return { ok: true };
      }

      for (const item of itensApontar) {
        await safeAddDoc('producao', item);
      }
      if (romaneio.sysId) {
        await safeUpdateDoc('romaneios', String(romaneio.sysId), {
          status: 'PRONTO',
          updatedAt: agoraISO,
        });
      }
      setHistoricoProducaoReal((prev) => [
        ...itensApontar.map((i) => ({
          id: `local-${Date.now()}-${Math.random()}`,
          ...i,
        })),
        ...prev,
      ]);
      setFilaProducao((prev) =>
        prev.map((r) =>
          (r.sysId || r.id) === (romaneio.sysId || romaneio.id)
            ? { ...r, status: 'PRONTO', updatedAt: agoraISO }
            : r
        )
      );
      return { ok: true };
    } catch (err) {
      console.error('Erro ao finalizar rapido:', err);
      return { ok: false, motivo: 'erro' };
    }
  };

  const finalizarSelecionadosPCP = async () => {
    if (sandboxAtivo) {
      alert('Modo simulacao ativo: finalize desativado.');
      return;
    }
    if (pcpSelecionados.length === 0) {
      alert('Selecione ao menos uma ordem.');
      return;
    }

    const selecionados = filaProducao.filter((r) =>
      pcpSelecionados.includes(r.sysId || r.id)
    );
    if (selecionados.length === 0) {
      alert('Nenhuma ordem valida selecionada.');
      return;
    }

    let ok = 0;
    let semMaquina = 0;
    let jaFinalizado = 0;
    let erro = 0;

    for (const r of selecionados) {
      const res = await finalizarRomaneioRapido(r);
      if (res.ok) ok += 1;
      else if (res.motivo === 'sem_maquina') semMaquina += 1;
      else if (res.motivo === 'ja_finalizado') jaFinalizado += 1;
      else erro += 1;
    }

    setPcpSelecionados([]);
    const partes = [];
    if (ok) partes.push(`${ok} finalizada(s)`);
    if (semMaquina) partes.push(`${semMaquina} sem maquina`);
    if (jaFinalizado) partes.push(`${jaFinalizado} ja finalizada(s)`);
    if (erro) partes.push(`${erro} com erro`);
    alert(partes.join(' · ') || 'Nada a finalizar.');
  };

  const getStatusBadgeComercial = (status) => {
    if (status === 'EM ANDAMENTO' || status === 'PRODUZINDO') {
      return {
        label: 'PRODUZINDO',
        className: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      };
    }
    if (status === 'PROGRAMADO') {
      return {
        label: 'PROGRAMADO',
        className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      };
    }
    if (status === 'FALTA PROGRAMAR') {
      return {
        label: 'EM ABERTO',
        className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      };
    }
    if (status === 'PRONTO') {
      return {
        label: 'PRONTO',
        className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      };
    }
    return {
      label: 'EM ABERTO',
      className: 'bg-zinc-500/10 text-zinc-300 border-white/10',
    };
  };

  const selecionarTodosProgramadosPCP = () => {
    const programados = filaProducao
      .filter((r) => Boolean(getDataRomaneio(r)) && Boolean(r.maquinaId))
      .map((r) => r.sysId || r.id)
      .filter(Boolean);
    if (programados.length === 0) {
      alert('Nenhuma ordem programada para selecionar.');
      return;
    }
    setPcpSelecionados((prev) => {
      const todosSelecionados = programados.every((id) => prev.includes(id));
      return todosSelecionados ? prev.filter((id) => !programados.includes(id)) : programados;
    });
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo.'));
      reader.readAsDataURL(file);
    });

  const uploadRomaneioAnexo = async (file, idPedido) => {
    if (!file) return null;

    const safeName = String(file.name || 'romaneio.pdf').replace(/[^\w.-]+/g, '_');
    const payload = {
      name: file.name,
      size: file.size,
      type: file.type,
    };

    if (IS_LOCALHOST) {
      const localData = await readFileAsDataUrl(file);
      return { ...payload, local: true, localData };
    }

    const storagePath = `romaneios/${idPedido}/${Date.now()}-${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { ...payload, url, path: storagePath };
  };

  const abrirRomaneioAnexo = async (anexo) => {
    if (!anexo) return;

    const dataUrl =
      anexo.localData ||
      (typeof anexo.url === 'string' && anexo.url.startsWith('data:')
        ? anexo.url
        : null);

    if (dataUrl) {
      try {
        const blob = await fetch(dataUrl).then((res) => res.blob());
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return;
      } catch (err) {
        console.error('Erro ao abrir romaneio local:', err);
      }
    }

    if (anexo.url) {
      window.open(anexo.url, '_blank', 'noopener,noreferrer');
      return;
    }

    alert('Romaneio nao encontrado.');
  };

  const limparPedidoComercial = () => {
    setFormPedidoCliente('');
    setFormPedidoRequisicao('');
    setFormPedidoObs('');
    setItensPedidoComercial([]);
    setFormPedidoRomaneioFile(null);
    setFormPedidoRomaneioParsing(false);
    setFormPedidoRomaneioErro('');
    resetItemPedidoComercial();
  };

  const salvarPedidoComercial = async () => {
    if (!formPedidoCliente.trim()) {
      alert("Informe o cliente.");
      return;
    }
    if (itensPedidoComercial.length === 0) {
      alert("Adicione pelo menos um item.");
      return;
    }

    const agoraISO = new Date().toISOString();
    const requisicao = formPedidoRequisicao.trim();
    const idPedido = requisicao || `REQ-${Date.now()}`;
    const normalizeTexto = (v) => String(v || '').trim().toLowerCase();
    const estoquePorCod = new Map(
      estoqueComercialBase.map((item) => [String(item.cod), Number(item.saldoQtd || 0)])
    );
    const estoquePorDesc = new Map(
      estoqueComercialBase.map((item) => [normalizeTexto(item.desc), Number(item.saldoQtd || 0)])
    );
    const temEstoqueSuficiente = (itens) => {
      const qtdPorItem = new Map();
      itens.forEach((item) => {
        const cod = String(item.cod || '').trim();
        const descKey = normalizeTexto(item.desc);
        const key = cod || (descKey ? `desc:${descKey}` : '');
        if (!key) return;
        const prev = qtdPorItem.get(key) || 0;
        qtdPorItem.set(key, prev + Number(item.qtd || 0));
      });
      return Array.from(qtdPorItem.entries()).every(([key, qtd]) => {
        if (key.startsWith('desc:')) {
          const desc = key.slice(5);
          const saldo = estoquePorDesc.get(desc) ?? 0;
          return qtd <= saldo;
        }
        const saldo = estoquePorCod.get(key) ?? 0;
        return qtd <= saldo;
      });
    };

    const itensPorMaquina = itensPedidoComercial.reduce((acc, item) => {
      const maquinaId = inferirMaquinaPorItem(item) || 'CONFORMADORA_TELHAS';
      if (!acc[maquinaId]) acc[maquinaId] = [];
      acc[maquinaId].push(item);
      return acc;
    }, {});

    let romaneioAnexo = null;
    if (formPedidoRomaneioFile) {
      setFormPedidoRomaneioUploading(true);
      try {
        romaneioAnexo = await uploadRomaneioAnexo(formPedidoRomaneioFile, idPedido);
      } catch (err) {
        console.error('Erro ao enviar romaneio:', err);
        alert('Erro ao anexar romaneio. Tente novamente.');
        setFormPedidoRomaneioUploading(false);
        return;
      }
      setFormPedidoRomaneioUploading(false);
    }

    const grupos = Object.entries(itensPorMaquina).map(([maquinaId, itens]) => ({
      maquinaId,
      itens,
    }));

    const pedidos = grupos.map((grupo, idx) => {
      const idPedidoGrupo = grupos.length > 1 ? `${idPedido}-${idx + 1}` : idPedido;
      const temEstoque = temEstoqueSuficiente(grupo.itens);
      const base = {
        id: idPedidoGrupo,
        romaneioId: idPedido,
        data: "",
        dataProducao: "",
        cliente: formPedidoCliente.trim(),
        solicitante: formPedidoSolicitante.trim(),
        totvs: "",
        origem: "COMERCIAL",
        requisicao: requisicao || idPedido,
        observacao: formPedidoObs || "",
        itens: grupo.itens,
        romaneioAnexo,
        createdAt: agoraISO,
        updatedAt: agoraISO,
        maquinaId: grupo.maquinaId === 'SEM_MAQUINA' ? '' : grupo.maquinaId,
      };
      if (temEstoque) {
        return {
          obj: {
            ...base,
            tipo: "TRANSF",
            status: "TRANSFERENCIA SOLICITADA",
            observacao: formPedidoObs || "Estoque disponivel. Transferencia solicitada.",
            transferenciaDestino: formPedidoCliente.trim(),
            transferenciaObs: formPedidoObs || "",
            transferenciaItens: grupo.itens,
            transferenciaSolicitadaAt: agoraISO,
          },
          temEstoque: true,
        };
      }
      return {
        obj: {
          ...base,
          tipo: "REQ",
          status: "FALTA PROGRAMAR",
        },
        temEstoque: false,
      };
    });

    try {
      const countTransf = pedidos.filter((p) => p.temEstoque).length;
      const countReq = pedidos.length - countTransf;

      if (IS_LOCALHOST) {
        const baseNow = Date.now();
        const novos = pedidos.map((p, idx) => ({
          ...p.obj,
          sysId: `LOCAL-${baseNow}-${idx}`,
        }));
        setFilaProducao((prev) => [...novos, ...prev]);
        limparPedidoComercial();
        if (countTransf && countReq) {
          alert(`Solicitacoes criadas (modo local): ${countReq} para programar, ${countTransf} transferencia.`);
        } else if (countTransf) {
          alert(`Estoque disponivel. ${countTransf} transferencia(s) solicitada(s) (modo local).`);
        } else {
          alert(`Sem estoque. ${countReq} solicitacao(oes) enviada(s) para programar (modo local).`);
        }
        return;
      }

      const novosDocs = [];
      for (const pedido of pedidos) {
        const docRef = await addDoc(collection(db, "romaneios"), pedido.obj);
        novosDocs.push({ ...pedido.obj, sysId: docRef.id });
      }
      setFilaProducao((prev) => [...novosDocs, ...prev]);
      limparPedidoComercial();
      if (countTransf && countReq) {
        alert(`Solicitacoes criadas: ${countReq} para programar, ${countTransf} transferencia.`);
      } else if (countTransf) {
        alert(`Estoque disponivel. ${countTransf} transferencia(s) solicitada(s).`);
      } else {
        alert(`Sem estoque. ${countReq} solicitacao(oes) enviada(s) para programar.`);
      }
    } catch (err) {
      console.error("Erro ao salvar pedido comercial:", err);
      alert("Erro ao salvar pedido comercial. Veja o console (F12).");
    }
  };

  const atualizarStatusPedidoComercial = async (pedido, status, extras = {}) => {
    const agoraISO = new Date().toISOString();
    const idRef = pedido?.sysId || pedido?.id;
    if (!idRef) {
      alert("Pedido sem identificacao.");
      return;
    }

    const payload = {
      status,
      updatedAt: agoraISO,
      ...extras,
    };

    try {
      if (IS_LOCALHOST) {
        setFilaProducao((prev) =>
          prev.map((p) =>
            (p.sysId || p.id) === idRef ? { ...p, ...payload } : p
          )
        );
        return;
      }

      if (pedido?.sysId) {
        await safeUpdateDoc("romaneios", String(pedido.sysId), payload);
        setFilaProducao((prev) =>
          prev.map((p) =>
            p.sysId === pedido.sysId ? { ...p, ...payload } : p
          )
        );
      } else {
        setFilaProducao((prev) =>
          prev.map((p) =>
            (p.sysId || p.id) === idRef ? { ...p, ...payload } : p
          )
        );
      }
    } catch (err) {
      console.error("Erro ao atualizar pedido:", err);
      alert("Erro ao atualizar pedido. Veja o console (F12).");
    }
  };

  const abrirConclusaoSolicitacao = (pedido) => {
    setConclusaoSolicitacaoAtual(pedido);
    setConclusaoSolicitacaoPor('');
    setConclusaoSolicitacaoObs('');
    setMostrarConclusaoSolicitacao(true);
  };

  const confirmarConclusaoSolicitacao = async () => {
    if (!conclusaoSolicitacaoAtual) return;
    if (!conclusaoSolicitacaoPor.trim()) {
      alert('Informe quem concluiu.');
      return;
    }
    await atualizarStatusPedidoComercial(conclusaoSolicitacaoAtual, 'CONCLUIDO', {
      concluidoAt: new Date().toISOString(),
      concluidoPor: conclusaoSolicitacaoPor.trim(),
      concluidoObs: conclusaoSolicitacaoObs.trim(),
    });
    setMostrarConclusaoSolicitacao(false);
    setConclusaoSolicitacaoAtual(null);
  };


  const abrirModalTransferenciaPedido = (pedido) => {
    if (!pedido) return;
    setTransferPedidoSelecionado(pedido);
    setTransferDestino('');
    setTransferObs('');
    setTransferItens(
      (pedido.itens || []).map((item, idx) => ({
        key: item.tempId || `${item.cod}-${idx}`,
        cod: item.cod,
        desc: item.desc || '',
        comp: item.comp,
        qtd: Number(item.qtd || 0),
      }))
    );
    setTransferModalAberto(true);
  };

  const confirmarTransferenciaPedido = async () => {
    if (!transferPedidoSelecionado) return;
    if (!transferDestino.trim()) {
      alert('Informe o destino/cliente.');
      return;
    }
    const itensValidos = transferItens
      .map((item) => ({
        ...item,
        qtd: Number(item.qtd || 0),
      }))
      .filter((item) => item.qtd > 0);

    if (itensValidos.length === 0) {
      alert('Informe ao menos uma quantidade.');
      return;
    }

    await atualizarStatusPedidoComercial(transferPedidoSelecionado, 'TRANSFERENCIA SOLICITADA', {
      transferenciaDestino: transferDestino.trim(),
      transferenciaObs: transferObs.trim(),
      transferenciaItens: itensValidos,
      transferenciaSolicitadaAt: new Date().toISOString(),
    });
    setTransferModalAberto(false);
  };

  const abrirMovimentacaoEstoque = (item) => {
    if (item?.cod) {
      setFormTransfCod(item.cod);
      setFormTransfDesc(item.desc || '');
      setFormTransfComp(item.comp ? String(item.comp) : '');
    }
    setFormTransfQtd('');
    setMostrarTransferenciaEstoque(true);
  };

  const solicitarTransferenciaPedido = async (pedido) => {
    const chave = pedido?.sysId || pedido?.id;
    const obs = transferenciaObsPorPedido[chave] || '';
    await atualizarStatusPedidoComercial(pedido, "TRANSFERENCIA SOLICITADA", {
      transferenciaObs: obs,
    });
  };

  const solicitarTransferenciaEstoque = async () => {
    if (!formTransfCliente.trim()) {
      alert("Informe o destino/cliente.");
      return;
    }
    if (!formTransfCod || !formTransfQtd) {
      alert("Informe o produto e a quantidade.");
      return;
    }
    const qtd = parseInt(formTransfQtd, 10) || 0;
    if (!qtd) {
      alert("Quantidade invalida.");
      return;
    }

    const produto = CATALOGO_PRODUTOS?.find((p) => p.cod === formTransfCod);
    const comp = parseFloat(formTransfComp) || produto?.comp || 0;
    if (produto?.custom && !comp) {
      alert("Informe o comprimento (m) para itens sob medida.");
      return;
    }

    const saldoItem = estoqueComercialBase.find((p) => p.cod === formTransfCod);
    const saldoDisponivel = Number(saldoItem?.saldoQtd || 0);
    const qtdDisponivel = Math.max(0, Math.min(saldoDisponivel, qtd));
    const qtdFaltante = Math.max(0, qtd - saldoDisponivel);

    const peso = produto
      ? produto.custom
        ? comp * (produto.kgMetro || 0) * qtd
        : (produto.pesoUnit || 0) * qtd
      : 0;
    const pesoDisponivel = produto
      ? produto.custom
        ? comp * (produto.kgMetro || 0) * qtdDisponivel
        : (produto.pesoUnit || 0) * qtdDisponivel
      : 0;

    const agoraISO = new Date().toISOString();
    const idPedido = `TRANSF-${Date.now()}`;
    const objTransferencia = qtdDisponivel > 0 ? {
      id: idPedido,
      romaneioId: idPedido,
      data: "",
      dataProducao: "",
      cliente: formTransfCliente.trim(),
      totvs: "",
      tipo: "TRANSF",
      status: "TRANSFERENCIA SOLICITADA",
      origem: "COMERCIAL",
      requisicao: idPedido,
      observacao: formTransfObs || "",
      itens: [
        {
          tempId: Math.random(),
          cod: formTransfCod,
          desc: formTransfDesc || produto?.desc || "Item s/ descricao",
          comp,
          qtd: qtdDisponivel,
          pesoTotal: pesoDisponivel.toFixed(2),
        },
      ],
      createdAt: agoraISO,
      updatedAt: agoraISO,
    } : null;

    const objFaltante = qtdFaltante > 0 ? {
      id: `REQ-${Date.now()}`,
      romaneioId: `REQ-${Date.now()}`,
      data: "",
      dataProducao: "",
      cliente: formTransfCliente.trim(),
      totvs: "",
      tipo: "PED",
      status: "FALTA PROGRAMAR",
      origem: "COMERCIAL",
      requisicao: formTransfObs ? `${formTransfObs} (faltante)` : "FALTANTE ESTOQUE",
      observacao: `Faltante de estoque: ${qtdFaltante} un`,
      itens: [
        {
          tempId: Math.random(),
          cod: formTransfCod,
          desc: formTransfDesc || produto?.desc || "Item s/ descricao",
          comp,
          qtd: qtdFaltante,
          pesoTotal: (peso - pesoDisponivel).toFixed(2),
        },
      ],
      createdAt: agoraISO,
      updatedAt: agoraISO,
    } : null;

    try {
      if (IS_LOCALHOST) {
        const novos = [];
        if (objTransferencia) novos.push({ ...objTransferencia, sysId: `LOCAL-${Date.now()}` });
        if (objFaltante) novos.push({ ...objFaltante, sysId: `LOCAL-${Date.now()}-F` });
        if (novos.length > 0) {
          setFilaProducao((prev) => [...novos, ...prev]);
        }
        resetFormTransferencia();
        setFormTransfCliente('');
        setFormTransfObs('');
        if (qtdFaltante > 0 && qtdDisponivel > 0) {
          alert("Transferencia solicitada e falta foi enviada para programar.");
        } else if (qtdFaltante > 0) {
          alert("Sem estoque. Pedido enviado para programar.");
        } else {
          alert("Transferencia solicitada.");
        }
        return;
      }

      const novos = [];
      if (objTransferencia) {
        const docRef = await addDoc(collection(db, "romaneios"), objTransferencia);
        novos.push({ ...objTransferencia, sysId: docRef.id });
      }
      if (objFaltante) {
        const docRefF = await addDoc(collection(db, "romaneios"), objFaltante);
        novos.push({ ...objFaltante, sysId: docRefF.id });
      }
      if (novos.length > 0) {
        setFilaProducao((prev) => [...novos, ...prev]);
      }
      resetFormTransferencia();
      setFormTransfCliente('');
      setFormTransfObs('');
      if (qtdFaltante > 0 && qtdDisponivel > 0) {
        alert("Transferencia solicitada e falta foi enviada para programar.");
      } else if (qtdFaltante > 0) {
        alert("Sem estoque. Pedido enviado para programar.");
      } else {
        alert("Transferencia solicitada.");
      }
    } catch (err) {
      console.error("Erro ao solicitar transferencia:", err);
      alert("Erro ao solicitar transferencia. Veja o console (F12).");
    }
  };

  const finalizarPedidoComercial = async (pedido) => {
    await atualizarStatusPedidoComercial(pedido, "FINALIZADO", {
      baixaAt: new Date().toISOString(),
    });
  };

  const marcarRetiradaPedido = async (pedido) => {
    await atualizarStatusPedidoComercial(pedido, "RETIRADA", {
      retiradaAt: new Date().toISOString(),
    });
  };

  const moverRomaneioParaData = async (romaneioKey, dataISO) => {
    if (!romaneioKey || !dataISO) return;

    const agoraISO = new Date().toISOString();
    const alvo = filaProducao.find((r) => (r.sysId || r.id) === romaneioKey);
    if (!alvo) return;
    const novoStatus =
      alvo.status === 'FALTA PROGRAMAR' ? 'PROGRAMADO' : alvo.status;

    setFilaProducao((prev) =>
      prev.map((r) =>
        (r.sysId || r.id) === romaneioKey
          ? { ...r, data: dataISO, dataProducao: dataISO, status: novoStatus, updatedAt: agoraISO }
          : r
      )
    );

    if (isSandboxed) return;
    if (!alvo.sysId) return;

    try {
      await safeUpdateDoc("romaneios", String(alvo.sysId), {
        data: dataISO,
        dataProducao: dataISO,
        status: novoStatus,
        updatedAt: agoraISO,
      });
    } catch (err) {
      console.error("Erro ao mover romaneio:", err);
    }
  };





const abrirModalNovo = () => { limparFormularioGeral(); setShowModalNovaOrdem(true); };
const abrirModalEdicao = (r) => {
    setPdfItensEncontrados([]);
    setPdfItensSelecionados([]);
    setPdfItensMaquina({});
    setPdfInfoRomaneio(null);
    setPdfErro('');

    setRomaneioEmEdicaoId(r.sysId || null); // id do doc no Firebase
    setRomaneioEmEdicaoKey(r.sysId || r.id || null);
    setRomaneioEmEdicao(r || null);
    setMaquinaSelecionada(r.maquinaId || r.maquina || '');
    setFormRomaneioId(r.id || r.romaneioId || '');
    setFormCliente(r.cliente);
    setFormTotvs(r.totvs || '');
    setFormDataProducao(getDataRomaneio(r));
    setItensNoPedido(
      (r.itens || []).map((i) => ({ ...i, tempId: Math.random() }))
    );
    setIsEstoque((r.id || r.romaneioId) === 'ESTOQUE');
    setShowModalNovaOrdem(true);
  };

  const limparFormularioGeral = () => {
    setFormRomaneioId('');
    setFormCliente('');
    setFormTotvs('');
    setFormDataProducao(hoje);
    setItensNoPedido([]);
    setIsEstoque(false);
    resetItemFields();
    setRomaneioEmEdicaoId(null);
    setRomaneioEmEdicaoKey(null);
    setRomaneioEmEdicao(null);
    setPdfItensEncontrados([]);
    setPdfItensSelecionados([]);
    setPdfItensMaquina({});
    setPdfInfoRomaneio(null);
    setPdfErro('');
  };
  const abrirSelecaoMaquina = () => { limparFormularioGeral(); setShowModalSelecaoMaquina(true); };
  const handlePdfItemMaquinaChange = (tempId, maquinaId) => {
    setPdfItensMaquina((prev) => ({
      ...prev,
      [tempId]: maquinaId,
    }));
  };

  const criarOrdensPorMaquina = async () => {
    const baseRomaneioId = formRomaneioId || pdfInfoRomaneio?.id;
    if (!baseRomaneioId || !formDataProducao) {
      alert("Preencha o Romaneio e a Data.");
      return;
    }
    if (!formCliente && !isEstoque) {
      alert("Preencha o Cliente.");
      return;
    }
    if (!pdfItensEncontrados.length) {
      alert("Nenhum item do PDF encontrado.");
      return;
    }

    const itensSemMaquina = pdfItensEncontrados.filter(
      (item) => !pdfItensMaquina[item.tempId]
    );
    if (itensSemMaquina.length) {
      alert("Selecione a maquina para todos os itens.");
      return;
    }

    const agrupado = {};
    pdfItensEncontrados.forEach((item) => {
      const maquinaId = pdfItensMaquina[item.tempId];
      if (!maquinaId) return;
      if (!agrupado[maquinaId]) agrupado[maquinaId] = [];
      agrupado[maquinaId].push(item);
    });

    const maquinas = Object.keys(agrupado);
    if (!maquinas.length) {
      alert("Nenhuma maquina selecionada.");
      return;
    }

    const agoraISO = new Date().toISOString();
    const cliente = formCliente || pdfInfoRomaneio?.cliente || "";
    const totvs = formTotvs || "";
    const tipo = isEstoque ? "EST" : "PED";

    const ordens = maquinas.map((maquinaId, idx) => {
      const sufixo = maquinas.length > 1 ? `-${idx + 1}` : "";
      return {
        id: `${baseRomaneioId}${sufixo}`,
        romaneioId: baseRomaneioId,
        data: formDataProducao,
        dataProducao: formDataProducao,
        cliente,
        totvs,
        tipo,
        maquinaId,
        itens: agrupado[maquinaId],
        updatedAt: agoraISO,
      };
    });

    if (isSandboxed) {
      const localPrefix = sandboxAtivo ? 'SANDBOX' : 'LOCAL';
      const baseNow = Date.now();
      const novos = ordens.map((o, idx) => ({
        ...o,
        sysId: `${localPrefix}-${baseNow}-${idx}`,
      }));
      setFilaProducao((prev) => [...prev, ...novos]);
      alert(
        `${ordens.length} ordem(ns) criada(s) (${sandboxAtivo ? 'modo simulacao' : 'modo local'}).`
      );
    } else {
      for (const ordem of ordens) {
        await addDoc(collection(db, "romaneios"), ordem);
      }
      const romaneiosSnapshot = await getDocs(collection(db, "romaneios"));
      const listaRomaneios = romaneiosSnapshot.docs.map((docSnap) => ({
        sysId: docSnap.id,
        ...docSnap.data(),
      }));
      setFilaProducao(listaRomaneios);
      alert(`${ordens.length} ordem(ns) criada(s)!`);
    }

    setShowModalSelecaoMaquina(false);
    setShowModalNovaOrdem(false);
    setMaquinaSelecionada("");
    setItensNoPedido([]);
    setPdfItensEncontrados([]);
    setPdfItensSelecionados([]);
    setPdfItensMaquina({});
    setPdfInfoRomaneio(null);
    setPdfErro('');
  };
const deletarRomaneio = async (romaneioId) => {
  const ok = window.confirm("Excluir esse romaneio?");
  if (!ok) return;

  const alvoId = String(romaneioId || "");
  setFilaProducao((prev) =>
    prev.filter((r) => String(r.sysId || r.id) !== alvoId)
  );

  if (isSandboxed || !alvoId) return;

  // tenta apagar no Firestore
  try {
    await deleteDoc(doc(db, "romaneios", alvoId));
  } catch (err) {
    console.error("Erro ao apagar romaneio no Firebase:", err);
    alert("Erro ao apagar no servidor. Dá uma olhada no console (F12).");
  }
};


  // --- APONTAMENTOS ---
  const handleSelectProdApontamento = (e) => {
      const codigo = e.target.value; setFormApontProdCod(codigo);
      if(CATALOGO_PRODUTOS) {
        const produto = CATALOGO_PRODUTOS.find(p => p.cod === codigo);
        if(produto) {
          setFormApontProdDesc(produto.desc);
          // sugere o comprimento padrÇ½o ou limpa para sob medida
          setFormApontProdComp(produto.custom ? '' : (produto.comp || ''));
        } else {
          setFormApontProdDesc('');
          setFormApontProdComp('');
        }
      }
  };
const limparFormApontamentoProducao = () => {
  setProducaoEmEdicaoId(null);
  setFormApontProdData(hoje);
  setFormApontProdCod('');
  setFormApontProdDesc('');
  setFormApontProdQtd('');
  setFormApontProdComp('');
  setFormApontProdDestino('Estoque');
};

const iniciarEdicaoProducao = (registro) => {
  setProducaoEmEdicaoId(registro.id);
  setFormApontProdData(registro.data || hoje);
  setFormApontProdCod(registro.cod || '');
  setFormApontProdDesc(registro.desc || '');
  setFormApontProdQtd(String(registro.qtd || ''));
  setFormApontProdComp(
    registro.comp !== undefined && registro.comp !== null
      ? String(registro.comp)
      : ''
  );
  setFormApontProdDestino(registro.destino || 'Estoque');
};

const salvarApontamentoProducao = async (e) => {
  e.preventDefault();
  if (sandboxAtivo) {
    alert('Modo simulacao ativo: apontamento de producao desativado.');
    return;
  }

  if (!formApontProdCod || !formApontProdQtd) {
    alert("Preencha código e quantidade.");
    return;
  }

  const qtd = parseInt(formApontProdQtd, 10) || 0;
  if (!qtd) {
    alert("Quantidade inválida.");
    return;
  }

  const dataISO = String(formApontProdData || "").trim();

  // Dados do produto
  const produtoCatalogo = CATALOGO_PRODUTOS?.find(
    (p) => p.cod === formApontProdCod
  );

  const compNumero = (() => {
    const valor = formApontProdComp || produtoCatalogo?.comp || 0;
    const num = parseFloat(valor);
    return Number.isFinite(num) ? num : 0;
  })();

  if (produtoCatalogo?.custom && !compNumero) {
    alert("Informe o comprimento (m) para itens sob medida.");
    return;
  }

  const pesoPorPeca = (() => {
    if (produtoCatalogo?.custom) {
      const kgMetro = produtoCatalogo?.kgMetro || 0;
      return kgMetro * compNumero;
    }
    return produtoCatalogo?.pesoUnit || 0;
  })();

  const pesoTotal = pesoPorPeca * qtd;
  const m2Total = compNumero * qtd; // considera largura padronizada de 1m

  const obj = {
    data: dataISO,
    cod: formApontProdCod,
    desc: formApontProdDesc || "Item s/ descrição",
    qtd,
    comp: compNumero,
    pesoTotal,
    pesoPorPeca,
    m2Total,
    destino: formApontProdDestino || "Estoque",
    maquinaId: formApontProdMaquina || "",
    };

  try {
    if (apontamentoEmEdicaoId) {
      await safeUpdateDoc("producao", String(apontamentoEmEdicaoId), obj);

      setHistoricoProducaoReal((prev) =>
        prev.map((p) =>
          p.id === apontamentoEmEdicaoId ? { ...p, ...obj } : p
        )
      );
    } else {
      const docRef = await safeAddDoc("producao", obj);
      const newId = docRef?.id || `local-${Date.now()}`;
      setHistoricoProducaoReal((prev) => [{ id: newId, ...obj }, ...prev]);
    }

    // limpa o form
    setApontamentoEmEdicaoId(null);
    setFormApontProdQtd("");
    setFormApontProdCod("");
    setFormApontProdDesc("");
    setFormApontProdComp("");
    setFormApontProdDestino("Estoque");
    // se quiser, pode voltar a data pra hoje aqui
  } catch (err) {
    console.error("Erro ao salvar produção:", err);
    alert("Erro ao salvar no servidor. Veja o console (F12).");
  }
};


const deletarProducaoReal = async (id) => {
  if (!window.confirm("Remover esse apontamento?")) return;

  // Some da tela
  setHistoricoProducaoReal((prev) => prev.filter((i) => i.id !== id));

  try {
    await safeDeleteDoc("producao", id);
  } catch (err) {
    console.error("Erro ao apagar produção:", err);
    alert("Erro ao apagar no servidor. Veja o console (F12).");
  }
};

  
  const handleUploadApontamentoProducao = (e, maquinaId) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // exige maquina
  if (!maquinaId) {
    alert("Selecione uma maquina antes de importar a produção.");
    e.target.value = null;
    return;
  }

  const reader = new FileReader();

  reader.onload = async (evt) => {
    try {
      const wb = XLSX.read(evt.target.result, {
        type: "binary",
        cellDates: true,
      });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      const novos = data
        .map((row) => {
          const rawData = encontrarValorNaLinha(row, [
            "DATA",
            "DT",
            "DATA_APONTAMENTO",
          ]);
          const dataISO = processarDataExcel(rawData);

          const cod = String(
            encontrarValorNaLinha(row, ["CODIGO", "COD", "PRODUTO"]) || ""
          ).trim();

          const qtdRaw = encontrarValorNaLinha(row, ["QTD", "QUANTIDADE", "QDE"]);
          const qtd = parseInt(String(qtdRaw ?? 0).replace(",", "."), 10) || 0;

          const desc = String(
            encontrarValorNaLinha(row, ["DESCRICAO", "DESC"]) || ""
          ).trim();

          const destino = String(
            encontrarValorNaLinha(row, ["DESTINO", "LOCAL", "ARMAZEM"]) || "Estoque"
          ).trim();

          if (!cod || !qtd) return null;

          return {
            data: dataISO,
            cod,
            desc: desc || "Item s/ descrição",
            qtd,
            destino,

            // ✅ maquina vem do filtro selecionado na tela
            maquinaId,
            // opcional (se quiser redundância):
            // maquina: maquinaId,
          };
        })
        .filter(Boolean);

      if (!novos.length) {
        alert("Nenhuma linha válida encontrada no arquivo de produção.");
        return;
      }

      const salvos = await Promise.all(
        novos.map(async (item) => {
          const docRef = await addDoc(collection(db, "producao"), item);
          return { id: docRef.id, ...item };
        })
      );

      setHistoricoProducaoReal((prev) => [...salvos, ...prev]);
      alert(`${salvos.length} apontamentos de produção importados e salvos na nuvem.`);
    } catch (err) {
      console.error("Erro ao importar apontamentos de produção:", err);
      alert("Erro ao importar/salvar apontamentos de produção.");
    } finally {
      e.target.value = null;
    }
  };

  reader.readAsBinaryString(file);
};



  // --- SALVAR PARADA ---
  // --- SALVAR PARADA (apenas na nuvem, recebendo a parada pronta) ---
const salvarApontamentoParada = async (novaParada) => {
  try {
    const docRef = await addDoc(collection(db, "paradas"), novaParada);
    return docRef.id; // devolve o id gerado
  } catch (err) {
    console.error("Erro ao salvar parada no Firebase:", err);
    throw err; // deixa o handleRegistrarParada tratar o erro
  }
};


const deletarParada = async (id) => {
  const ok = window.confirm("Remover essa parada?");
  if (!ok) return;

  setHistoricoParadas((prev) => prev.filter((p) => p.id !== id));

  try {
    await deleteDoc(doc(db, "paradas", String(id)));
  } catch (err) {
    console.error("Erro ao apagar parada no Firebase:", err);
    alert("Erro ao apagar parada no servidor.");
  }
};

  const handleUploadDicionario = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const novoDic = data.map(r => ({
        codigo: String(encontrarValorNaLinha(r, ['CODIGO','COD','ID'])||''),
        evento: String(encontrarValorNaLinha(r, ['EVENTO','DESC','MOTIVO'])||''),
        grupo: String(encontrarValorNaLinha(r, ['GRUPO','TIPO'])||'GERAL')
      })).filter(i=>i.codigo&&i.evento);
      if(novoDic.length>0) { setDicionarioLocal(novoDic); alert("Dicionário atualizado!"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

    const handleUploadApontamentoParadas = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (evt) => {
    const bstr = evt.target.result;
    const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
    const data = XLSX.utils.sheet_to_json(
      wb.Sheets[wb.SheetNames[0]] || {}
    );

    const novos = [];

    data.forEach((row) => {
      const rawData = encontrarValorNaLinha(row, [
        "DATA",
        "DATA_EVENTO",
        "DT",
        "DIA",
      ]);
      const rawInicio = encontrarValorNaLinha(row, [
        "INICIO",
        "INÍCIO",
        "HR_INICIO",
        "HORA_INICIO",
        "START",
      ]);
      const rawFim = encontrarValorNaLinha(row, [
        "FIM",
        "HR_FIM",
        "HORA_FIM",
        "END",
      ]);
      const rawCod = encontrarValorNaLinha(row, [
        "COD_MOTIVO",
        "CÓD_MOTIVO",
        "CODIGO_MOTIVO",
        "CODIGO",
        "COD",
        "MOTIVO",
      ]);
      const rawObs = encontrarValorNaLinha(row, [
        "OBS",
        "OBSERVACAO",
        "OBSERVAÇÃO",
        "DETALHE",
      ]);

      const dataISO = processarDataExcel(rawData);
      const inicio = normalizarHoraExcel(rawInicio);
      const fim = normalizarHoraExcel(rawFim);

      if (!dataISO || !inicio || !fim) return;

      const d1 = new Date(`${dataISO}T${inicio}:00`);
      const d2 = new Date(`${dataISO}T${fim}:00`);
      if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return;

      const duracaoMin = Math.max(0, Math.round((d2 - d1) / 60000));
      if (duracaoMin <= 0) return;

      const codMotivo = rawCod ? String(rawCod).trim() : "";

      let motivo = null;
      if (codMotivo) {
        motivo = dicionarioLocal.find(
          (p) =>
            String(p.codigo).trim() === codMotivo ||
            String(p.cod ?? "").trim() === codMotivo ||
            String(p.evento ?? "")
              .trim()
              .toUpperCase() === codMotivo.toUpperCase()
        );
      }

      novos.push({
        data: dataISO,
        inicio,
        fim,
        duracao: duracaoMin,
        codMotivo: codMotivo || (motivo ? motivo.codigo : ""),
        descMotivo: motivo
          ? motivo.evento || motivo.desc
          : codMotivo || "Desconhecido",
        grupo: motivo ? motivo.grupo || "Geral" : "Geral",
        obs: rawObs ? String(rawObs) : "",
      });
    });

    if (!novos.length) {
      alert(
        "Nenhuma linha válida encontrada no arquivo de paradas.\n\n" +
          "Confere se o arquivo tem pelo menos as colunas DATA, INICIO e FIM preenchidas."
      );
      return;
    }

    try {
      const salvos = await Promise.all(
        novos.map(async (item) => {
          const docRef = await addDoc(collection(db, "paradas"), item);
          return { id: docRef.id, ...item };
        })
      );

      setHistoricoParadas((prev) => [...salvos, ...prev]);
      alert(
        `${salvos.length} apontamentos de parada importados e salvos na nuvem.`
      );
    } catch (err) {
      console.error("Erro ao importar apontamentos de parada:", err);
      alert("Erro ao salvar apontamentos de parada no servidor.");
    }
  };

  reader.readAsBinaryString(file);
  e.target.value = null;
};

const getDataRomaneio = (r) => String(r.data || r.dataProducao || "");
const getMaquinaNomeComercial = (maquinaId) => {
  if (!maquinaId) return "Sem maquina";
  const found = CATALOGO_MAQUINAS.find(
    (m) => m.maquinaId === maquinaId || m.id === maquinaId
  );
  return found?.nomeExibicao || maquinaId;
};
  const getMaquinaIdRomaneio = (r) =>
    r.maquinaId || r.maquina || inferirMaquinaPorItens(r.itens) || 'SEM_MAQUINA';

  const getPesoRomaneio = (r) =>
    (r.itens || []).reduce((acc, item) => acc + Number(item.pesoTotal || 0), 0);

  const isSandboxed = sandboxAtivo || IS_LOCALHOST;

  const sandboxOriginalMap = useMemo(() => {
    const map = new Map();
    (sandboxSnapshot || []).forEach((r) => {
      const key = r.sysId || r.id;
      if (key) map.set(String(key), r);
    });
    return map;
  }, [sandboxSnapshot]);

  const getSetorMaquina = (maquinaId, fallback) => {
    const meta = CATALOGO_MAQUINAS.find(
      (m) => m.maquinaId === maquinaId || m.id === maquinaId
    );
    const grupo = meta?.grupo || '';
    const mapa = {
      GRUPO_PERFIS: 'Perfiladeiras',
      GRUPO_TELHAS: 'Telhas',
    };
    if (mapa[grupo]) return mapa[grupo];
    const label = String(fallback || '').toUpperCase();
    if (label.includes('SLITTER')) return 'Slitter';
    if (label.includes('DOBRA')) return 'Dobra';
    return 'Outros';
  };

  const toggleCrpSetor = (setor) => {
    setCrpSetoresAbertos((prev) => ({
      ...prev,
      [setor]: prev[setor] === false ? true : false,
    }));
  };

  const getInicioSemana = (dataISO) => {
    const d = new Date(`${dataISO}T00:00:00`);
    const dia = d.getDay(); // 0 dom, 1 seg...
    d.setDate(d.getDate() - dia);
    return getLocalISODate(d);
  };

  const addDaysISO = (dataISO, deltaDias) => {
    const d = new Date(`${dataISO}T00:00:00`);
    d.setDate(d.getDate() + deltaDias);
    return getLocalISODate(d);
  };

  const getDiaSemanaLabel = (dataISO) => {
    const d = new Date(`${dataISO}T00:00:00`);
    const nome = d.toLocaleDateString('pt-BR', { weekday: 'short' });
    return String(nome || '').replace('.', '');
  };

  const getDiasDoMes = (dataISO) => {
    const d = new Date(`${dataISO}T00:00:00`);
    const ano = d.getFullYear();
    const mes = d.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const dias = [];
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      dias.push(getLocalISODate(new Date(ano, mes, i)));
    }
    return { dias, primeiroDia };
  };

  const getMesLabel = (dataISO) => {
    const d = new Date(`${dataISO}T00:00:00`);
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${mes}/${d.getFullYear()}`;
  };

  const toggleCrpMes = (maquinaId) => {
    setCrpMesAberto((prev) => ({ ...prev, [maquinaId]: !prev[maquinaId] }));
  };

  const getProximoDiaUtil = (dataISO) => {
    const d = new Date(`${dataISO}T00:00:00`);
    let tentativas = 0;
    do {
      d.setDate(d.getDate() + 1);
      tentativas += 1;
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) break;
    } while (tentativas < 7);
    return getLocalISODate(d);
  };

  const abrirModalReprogramar = (romaneio) => {
    if (!romaneio) return;
    const dataAtual = getDataRomaneio(romaneio) || hoje;
    setReprogramarRomaneio(romaneio);
    setReprogramarData(dataAtual);
    setReprogramarAberto(true);
  };

  const iniciarSandbox = () => {
    const snapshot = (filaProducao || []).map((r) => ({
      ...r,
      itens: Array.isArray(r.itens) ? r.itens.map((i) => ({ ...i })) : [],
    }));
    setSandboxSnapshot(snapshot);
    setSandboxAtivo(true);
  };

  const descartarSandbox = () => {
    setFilaProducao(sandboxSnapshot || []);
    setSandboxAtivo(false);
  };

  const aplicarSandbox = async () => {
    if (IS_LOCALHOST) {
      setSandboxAtivo(false);
      return;
    }

    setSandboxApplyPending(true);
    const original = sandboxSnapshot || [];
    const atual = filaProducao || [];
    const originalMap = new Map(original.map((r) => [String(r.sysId || r.id || ''), r]));
    const atualMap = new Map(atual.map((r) => [String(r.sysId || r.id || ''), r]));

    const isTempId = (id) => String(id || '').startsWith('LOCAL-') || String(id || '').startsWith('SANDBOX-');

    try {
      for (const [id, r] of originalMap.entries()) {
        if (!id) continue;
        if (!atualMap.has(id) && !isTempId(id)) {
          await safeDeleteDoc('romaneios', id);
        }
      }

      for (const r of atual) {
        const sysId = r.sysId || r.id || '';
        const payload = { ...r };
        delete payload.sysId;
        delete payload.id;

        if (!sysId || isTempId(sysId)) {
          await safeAddDoc('romaneios', payload);
        } else {
          await safeUpdateDoc('romaneios', String(sysId), payload);
        }
      }

      const romaneiosSnapshot = await getDocs(collection(db, 'romaneios'));
      const listaRomaneios = romaneiosSnapshot.docs.map((docSnap) => ({
        sysId: docSnap.id,
        ...docSnap.data(),
      }));
      setFilaProducao(listaRomaneios);
      setSandboxAtivo(false);
    } catch (err) {
      console.error('Erro ao aplicar sandbox:', err);
      alert('Erro ao aplicar o cenário. Veja o console (F12).');
    } finally {
      setSandboxApplyPending(false);
    }
  };

  const crpOcupacaoSemana = useMemo(() => {
    const dataBase = normalizeISODateInput(pcpCrpData || getLocalISODate());
    const inicioSemana = getInicioSemana(dataBase);
    const diasBase = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(`${inicioSemana}T00:00:00`);
      d.setDate(d.getDate() + idx);
      return getLocalISODate(d);
    });

    const pesoPorMaquinaDia = {};
    const ordensPorMaquinaDia = {};
    const diasComOrdem = new Set();

    filaProducao.forEach((r) => {
      const dataRomaneio = getDataRomaneio(r);
      if (!diasBase.includes(dataRomaneio)) return;
      diasComOrdem.add(dataRomaneio);
      const maquinaId = getMaquinaIdRomaneio(r);
      const pesoRomaneio = (r.itens || []).reduce(
        (acc, item) => acc + Number(item.pesoTotal || 0),
        0
      );
      const key = `${maquinaId}::${dataRomaneio}`;
      pesoPorMaquinaDia[key] = (pesoPorMaquinaDia[key] || 0) + pesoRomaneio;
      ordensPorMaquinaDia[key] = (ordensPorMaquinaDia[key] || 0) + 1;
    });

    const dias = diasBase;

    const itens = capacidadesMaquinas.map((maquina) => {
      const capacidade = Number(maquina.capacidade_kg_dia || 0);
      const maquinaId = maquina.maquinaId || '';
      const diasDetalhe = dias.map((dia) => {
        const key = `${maquinaId}::${dia}`;
        const peso = Number(pesoPorMaquinaDia[key] || 0);
        const ordens = Number(ordensPorMaquinaDia[key] || 0);
        const percent = capacidade > 0 ? (peso / capacidade) * 100 : 0;
        return { dia, peso, ordens, percent };
      });

      return {
        ...maquina,
        capacidade,
        label: getMaquinaNomeComercial(maquinaId) || maquina.maquina,
        diasDetalhe,
      };
    });

    const setores = itens.reduce((acc, item) => {
      const setor = getSetorMaquina(item.maquinaId, item.label);
      if (!acc[setor]) acc[setor] = [];
      acc[setor].push(item);
      return acc;
    }, {});

    return { inicioSemana, dias, itens, setores };
  }, [filaProducao, pcpCrpData, CATALOGO_MAQUINAS]);

  const pcpListaFiltrada = useMemo(() => {
    let lista = filaProducao || [];
    if (pcpFiltroData) {
      lista = lista.filter((r) => getDataRomaneio(r) === pcpFiltroData);
    }
    if (pcpFiltroMaquina) {
      lista = lista.filter((r) => r.maquinaId === pcpFiltroMaquina);
    }
    return lista;
  }, [filaProducao, pcpFiltroData, pcpFiltroMaquina]);

  const crpMesInfo = useMemo(() => {
    const base = pcpCrpData || hoje;
    const { dias, primeiroDia } = getDiasDoMes(base);
    const inicio = dias[0];
    const fim = dias[dias.length - 1];
    const pesoMap = {};

    (filaProducao || []).forEach((r) => {
      const data = getDataRomaneio(r);
      if (!data || data < inicio || data > fim) return;
      const maquinaId = getMaquinaIdRomaneio(r);
      if (!maquinaId) return;
      if (!pesoMap[maquinaId]) pesoMap[maquinaId] = {};
      pesoMap[maquinaId][data] = (pesoMap[maquinaId][data] || 0) + getPesoRomaneio(r);
    });

    return { dias, primeiroDia, pesoMap, mesLabel: getMesLabel(base) };
  }, [filaProducao, pcpCrpData, hoje]);

  const crpDetalheOrdens = useMemo(() => {
    if (!crpDetalheData || !crpDetalheMaquinaId) return [];
    return (filaProducao || [])
      .filter((r) => getDataRomaneio(r) === crpDetalheData)
      .filter((r) => r.maquinaId === crpDetalheMaquinaId)
      .sort((a, b) => String(a.id || a.romaneioId || '').localeCompare(String(b.id || b.romaneioId || '')));
  }, [filaProducao, crpDetalheData, crpDetalheMaquinaId]);

  const criarMockOcupacaoSemana = () => {
    if (!IS_LOCALHOST) return;
    const dias = crpOcupacaoSemana.dias;
    if (!dias.length) return;

    const baseAgora = Date.now();
    let idx = 0;
    const mocks = [];

    capacidadesMaquinas.forEach((maquina) => {
      const capacidade = Number(maquina.capacidade_kg_dia || 0);
      dias.forEach((dia) => {
        const dow = new Date(`${dia}T00:00:00`).getDay();
        if (dow === 0 || dow === 6) return;
        const peso = Math.round(capacidade * (0.3 + Math.random() * 0.9));
        mocks.push({
          sysId: `MOCK-${baseAgora}-${idx++}`,
          id: `MOCK-${dia}-${maquina.maquinaId || maquina.maquina}-${idx}`,
          romaneioId: `MOCK-${dia}`,
          data: dia,
          dataProducao: dia,
          cliente: 'MOCK',
          totvs: '',
          tipo: 'PED',
          maquinaId: maquina.maquinaId || '',
          itens: [
            {
              tempId: Math.random(),
              cod: 'MOCK',
              desc: `Carga mock ${maquina.maquina}`,
              comp: 0,
              qtd: 1,
              pesoTotal: peso,
            },
          ],
          origem: 'MOCK_CRP',
          updatedAt: new Date().toISOString(),
        });
      });
    });

    const mesInfo = getDiasDoMes(pcpCrpData || hoje);
    const diasMes = mesInfo.dias;
    let idxMes = mocks.length;
    const mocksMes = [];
    capacidadesMaquinas.forEach((maquina) => {
      const capacidade = Number(maquina.capacidade_kg_dia || 0);
      diasMes.forEach((dia) => {
        const dow = new Date(`${dia}T00:00:00`).getDay();
        if (dow === 0 || dow === 6) return;
        if (dias.includes(dia)) return;
        const peso = Math.round(capacidade * (0.2 + Math.random() * 0.95));
        mocksMes.push({
          sysId: `MOCK-${baseAgora}-${idxMes++}`,
          id: `MOCK-${dia}-${maquina.maquinaId || maquina.maquina}-${idxMes}`,
          romaneioId: `MOCK-${dia}`,
          data: dia,
          dataProducao: dia,
          cliente: 'MOCK',
          totvs: '',
          tipo: 'PED',
          maquinaId: maquina.maquinaId || '',
          itens: [
            {
              tempId: Math.random(),
              cod: 'MOCK',
              desc: `Carga mock ${maquina.maquina}`,
              comp: 0,
              qtd: 1,
              pesoTotal: peso,
            },
          ],
          origem: 'MOCK_CRP',
          updatedAt: new Date().toISOString(),
        });
      });
    });

    setFilaProducao((prev) => [
      ...prev.filter((r) => r.origem !== 'MOCK_CRP'),
      ...mocks,
      ...mocksMes,
    ]);
  };

  const isSemProgramar = (r) => {
    const dataRomaneio = getDataRomaneio(r);
    const status = String(r?.status || '').toUpperCase().trim();
    const tipo = String(r?.tipo || '').toUpperCase().trim();
    if (status === 'TRANSFERENCIA SOLICITADA' || tipo === 'TRANSF') return false;
    return !dataRomaneio;
  };

  const isTransferenciaSolicitada = (r) => {
    const status = String(r?.status || '').toUpperCase().trim();
    const tipo = String(r?.tipo || '').toUpperCase().trim();
    return status === 'TRANSFERENCIA SOLICITADA' || tipo === 'TRANSF';
  };

  const colunasAgenda = {
  semProgramar: filaProducao.filter((r) => isSemProgramar(r)),
  transferir: filaProducao.filter((r) => isTransferenciaSolicitada(r)),
  hoje: filaProducao.filter((r) => !isSemProgramar(r) && getDataRomaneio(r) === hoje),
  amanha: filaProducao.filter((r) => !isSemProgramar(r) && getDataRomaneio(r) === amanha),
  futuro: filaProducao.filter((r) => {
    const dataRomaneio = getDataRomaneio(r);
    return !isSemProgramar(r) && dataRomaneio && dataRomaneio > amanha;
  }),
};

const parseNumberBR = (v) => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

  const getEstoqueGrupoLabel = (item) => {
    const grupo = String(item?.grupo || "");
    if (grupo === "GRUPO_TELHAS") return "Telhas";
    if (grupo === "GRUPO_PERFIS") return "Perfis";
    return "Outros";
  };

  const estoqueTelhasSaldo = useMemo(() => {
    const producaoEstoque = historicoProducaoReal.filter((item) =>
      String(item?.destino || "").toLowerCase().includes("estoque")
    );

    const saldoPorCod = {};
    const saldoKgPorCod = {};

    producaoEstoque.forEach((item) => {
      if (!item?.cod) return;
      const qtd = Number(item.qtd || 0);
      const peso = Number(item.pesoTotal || 0);
      saldoPorCod[item.cod] = (saldoPorCod[item.cod] || 0) + qtd;
      saldoKgPorCod[item.cod] = (saldoKgPorCod[item.cod] || 0) + peso;
    });

    return { saldoPorCod, saldoKgPorCod };
  }, [historicoProducaoReal]);

  const estoqueTelhasAll = useMemo(() => {
    const telhas = (CATALOGO_PRODUTOS || []).filter(
      (p) => p.grupo === "GRUPO_TELHAS"
    );
    return telhas
      .map((p) => ({
        ...p,
        saldoQtd: estoqueTelhasSaldo.saldoPorCod[p.cod] || 0,
        saldoKg: estoqueTelhasSaldo.saldoKgPorCod[p.cod] || 0,
      }))
      .sort((a, b) => String(a.cod).localeCompare(String(b.cod)));
  }, [CATALOGO_PRODUTOS, estoqueTelhasSaldo]);

  const estoqueTelhas = useMemo(
    () =>
      estoqueTelhasAll.filter(
        (p) => (p.saldoQtd || 0) !== 0 || (p.saldoKg || 0) !== 0
      ),
    [estoqueTelhasAll]
  );

  const estoquePerfis = useMemo(() => {
    const itens = [];

    slitterStockExt.forEach((item) => {
      const code = String(item?.cod || item?.productCode || item?.id || '').trim();
      if (!code) return;
      const saldoQtd = Number(item?.saldoQtd || 0);
      if (!saldoQtd) return;

      const catalogo = CATALOGO_PRODUTOS?.find((p) => p.cod === code);
      const desc =
        catalogo?.desc ||
        item?.productName ||
        item?.desc ||
        'Item sem descricao';
      const pesoUnit = Number(catalogo?.pesoUnit || item?.pesoUnit || 0);
      const saldoKg = pesoUnit ? saldoQtd * pesoUnit : 0;

      itens.push({
        cod: code,
        desc,
        saldoQtd,
        saldoKg,
        pesoUnit,
        grupo: 'GRUPO_PERFIS',
        origem: 'SLITTER',
      });
    });

    return itens.sort((a, b) => String(a.cod).localeCompare(String(b.cod)));
  }, [slitterStockExt, CATALOGO_PRODUTOS]);

  const estoqueComercialBase = useMemo(
    () => [...estoqueTelhas, ...estoquePerfis],
    [estoqueTelhas, estoquePerfis]
  );

  const estoqueComercialBaseComZeros = useMemo(
    () => [...estoqueTelhasAll, ...estoquePerfis],
    [estoqueTelhasAll, estoquePerfis]
  );

  const estoqueComercialHasTelhas = useMemo(
    () => estoqueComercialBase.some((item) => item.grupo === 'GRUPO_TELHAS'),
    [estoqueComercialBase]
  );
  const estoqueComercialHasPerfis = useMemo(
    () => estoqueComercialBase.some((item) => item.grupo === 'GRUPO_PERFIS'),
    [estoqueComercialBase]
  );

  useEffect(() => {
    if (filtroEstoque === 'telhas' && !estoqueComercialHasTelhas) {
      setFiltroEstoque('todos');
      return;
    }
    if (filtroEstoque === 'perfis' && !estoqueComercialHasPerfis) {
      setFiltroEstoque('todos');
    }
  }, [filtroEstoque, estoqueComercialHasTelhas, estoqueComercialHasPerfis]);

  const pedidosComercial = useMemo(
    () =>
      filaProducao.filter(
        (r) =>
          (!getDataRomaneio(r)) &&
          (r.origem === "COMERCIAL" || r.status === "FALTA PROGRAMAR") &&
          r.status !== "FINALIZADO"
      ),
    [filaProducao]
  );
  const pedidosComercialProntos = useMemo(
    () =>
      filaProducao.filter((p) => {
        if (p.origem !== "COMERCIAL") return false;
        if (p.status === "CONCLUIDO") return true;
        if (p.status !== "PRONTO") return false;
        const data = getDataRomaneio(p);
        return data === hoje || data === amanha;
      }),
    [filaProducao, hoje, amanha]
  );
  const pedidosComercialAbertos = useMemo(
    () =>
      filaProducao.filter(
        (p) =>
          p.origem === "COMERCIAL" &&
          p.status !== "FINALIZADO" &&
          p.status !== "PRONTO" &&
          p.status !== "RETIRADA"
      ),
    [filaProducao]
  );
  const ordensProgramadasOrdenadas = useMemo(() => {
    const lista = filaProducao.filter(
      (r) => getDataRomaneio(r) && r.maquinaId
    );
    return lista
      .slice()
      .sort(
        (a, b) =>
          new Date(getDataRomaneio(a)).getTime() -
          new Date(getDataRomaneio(b)).getTime()
      );
  }, [filaProducao]);
  const ordensComercialFiltradas = useMemo(() => {
    const termo = comercialBusca.trim().toLowerCase();
    const base = ordensProgramadasOrdenadas.filter(
      (r) => r.status !== 'PRONTO'
    );
    if (!termo) return base;
    return base.filter((r) => {
      const cliente = String(r.cliente || '').toLowerCase();
      const pedido = String(r.id || r.romaneioId || '').toLowerCase();
      const item = String(r.itens?.[0]?.desc || '').toLowerCase();
      const maquina = String(getMaquinaNomeComercial(r.maquinaId) || '').toLowerCase();
      return (
        cliente.includes(termo) ||
        pedido.includes(termo) ||
        item.includes(termo) ||
        maquina.includes(termo)
      );
    });
  }, [ordensProgramadasOrdenadas, comercialBusca]);
  const solicitacoesComercial = useMemo(
    () =>
      filaProducao.filter(
        (p) =>
          p.origem === 'COMERCIAL' &&
          (p.status === 'TRANSFERENCIA SOLICITADA' ||
            p.status === 'PRONTO' ||
            p.status === 'RETIRADA' ||
            p.status === 'CONCLUIDO')
      ),
    [filaProducao]
  );
  const estoqueTelhasFiltrado = useMemo(() => {
    const termo = comercialEstoqueBusca.trim().toLowerCase();
    if (!termo) return estoqueComercialBase;
    return estoqueComercialBase.filter((item) => {
      const cod = String(item.cod || '').toLowerCase();
      const desc = String(item.desc || '').toLowerCase();
      return cod.includes(termo) || desc.includes(termo);
    });
  }, [estoqueComercialBase, comercialEstoqueBusca]);

  const estoqueFiltradoComercial = useMemo(() => {
    let lista = [
      ...(mostrarZeradosEstoque ? estoqueComercialBaseComZeros : estoqueComercialBase),
    ];
    if (filtroEstoque === 'critico') {
      lista = lista.filter((item) => Number(item.saldoQtd || 0) <= 500);
    }
    if (filtroEstoque === 'telhas') {
      lista = lista.filter((item) => item.grupo === 'GRUPO_TELHAS');
    }
    if (filtroEstoque === 'perfis') {
      lista = lista.filter((item) => item.grupo === 'GRUPO_PERFIS');
    }
    if (comercialVisao === 'estoque' && comercialBusca.trim()) {
      const termo = comercialBusca.trim().toLowerCase();
      lista = lista.filter((item) => {
        const cod = String(item.cod || '').toLowerCase();
        const desc = String(item.desc || '').toLowerCase();
        return cod.includes(termo) || desc.includes(termo);
      });
    }
    return lista;
  }, [
    estoqueComercialBase,
    estoqueComercialBaseComZeros,
    mostrarZeradosEstoque,
    filtroEstoque,
    comercialVisao,
    comercialBusca,
  ]);

  const handleDownloadEstoqueExcel = () => {
    if (!estoqueFiltradoComercial.length) {
      alert('Nenhum item para exportar.');
      return;
    }

    const rows = estoqueFiltradoComercial.map((item) => {
      const estudo = estoqueEstudo[item.cod] || {};
      const status = getStockStatusComercial(item, estudo);
      const demandaBase = Number(estudo.demandaDiaria || 0);
      const estoqueMaxBase = Number(estudo.estoqueMaximo || 0);
      const saldoQtd = Number(item.saldoQtd || 0);
      const saldoKg = Number(item.saldoKg || 0);
      const pesoUnit = Number(item.pesoUnit || 0);
      const unidade = String(estudo.unidade || 'kg').toLowerCase();
      const demandaUn = demandaBase;
      const estoqueMaxUn = estoqueMaxBase;

      return {
        COD: item.cod || '',
        PRODUTO: item.desc || '',
        GRUPO: getEstoqueGrupoLabel(item),
        QTD_ATUAL: saldoQtd,
        SALDO_KG: Number(saldoKg.toFixed(2)),
        DEMANDA_DIARIA: Number(demandaUn.toFixed(2)),
        ESTOQUE_MAXIMO: Number(estoqueMaxUn.toFixed(2)),
        UNIDADE_BASE: unidade,
        PESO_UNITARIO: Number(pesoUnit.toFixed(4)),
        STATUS: status.label,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const sugestoes = estoqueFiltradoComercial
      .map((item) => {
        const estudo = estoqueEstudo[item.cod] || {};
        const demandaBase = Number(estudo.demandaDiaria || 0);
        const estoqueMaxBase = Number(estudo.estoqueMaximo || 0);
        const saldoKg = Number(item.saldoKg || 0);
        const pesoUnit = Number(item.pesoUnit || 0);
        const unidade = String(estudo.unidade || 'kg').toLowerCase();
        const demandaUn = demandaBase;
        const estoqueMaxUn = estoqueMaxBase;
        const faltaReposicao =
          estoqueMaxUn && estoqueMaxUn > 0 ? Math.max(0, estoqueMaxUn - saldoQtd) : 0;
        const coberturaDias = demandaUn ? saldoQtd / demandaUn : null;

        return {
          COD: item.cod || '',
          PRODUTO: item.desc || '',
          GRUPO: getEstoqueGrupoLabel(item),
          SALDO_UN: Number(saldoQtd.toFixed(2)),
          DEMANDA_DIARIA: Number(demandaUn.toFixed(2)),
          ESTOQUE_MAXIMO: Number(estoqueMaxUn.toFixed(2)),
          FALTA_REPOR_UN: Number(faltaReposicao.toFixed(2)),
          COBERTURA_DIAS: coberturaDias != null ? Number(coberturaDias.toFixed(2)) : '',
        };
      })
      .filter((row) => Number(row.FALTA_REPOR_UN || 0) > 0);

    const wsSugestoes = XLSX.utils.json_to_sheet(sugestoes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    XLSX.utils.book_append_sheet(wb, wsSugestoes, 'Sugestoes');
    XLSX.writeFile(wb, `Estoque_${getLocalISODate()}.xlsx`);
  };

  const estoqueCriticoComercial = useMemo(
    () => estoqueComercialBase.filter((item) => Number(item.saldoQtd || 0) <= 500).slice(0, 4),
    [estoqueComercialBase]
  );
  const saldoPedidoComercialSelecionado = useMemo(() => {
    const cod = String(formPedidoCod || '').trim();
    const desc = String(formPedidoDesc || '').trim().toLowerCase();
    if (!cod && !desc) return null;
    if (cod) {
      const item = estoqueComercialBase.find((p) => String(p.cod) === cod);
      return item ? Number(item.saldoQtd || 0) : 0;
    }
    const item = estoqueComercialBase.find((p) => String(p.desc || '').trim().toLowerCase() === desc);
    return item ? Number(item.saldoQtd || 0) : 0;
  }, [estoqueComercialBase, formPedidoCod, formPedidoDesc]);

  const getStockStatusComercial = (item, estudo = {}) => {
    const saldoKg = Number(item.saldoKg || 0);
    const saldoQtd = Number(item.saldoQtd || 0);
    const unidade = String(estudo.unidade || 'kg').toLowerCase();
    const demandaBase = Number(estudo.demandaDiaria || 0);
    const estoqueMaxBase = Number(estudo.estoqueMaximo || 0);
    const pesoUnit = Number(item.pesoUnit || 0);
    const usaConversaoKg = unidade === 'pc' && pesoUnit;
    const estoqueMaxKg = usaConversaoKg ? estoqueMaxBase * pesoUnit : estoqueMaxBase;

    if (estoqueMaxKg > 0) {
      const ratio = saldoKg / estoqueMaxKg;
      if (ratio <= 0.25) {
        return {
          label: 'Critico',
          text: 'text-red-400',
          bg: 'bg-red-500',
          border: 'border-red-500/20',
          bgSoft: 'bg-red-500/10',
        };
      }
      if (ratio <= 0.6) {
        return {
          label: 'Baixo',
          text: 'text-amber-400',
          bg: 'bg-amber-500',
          border: 'border-amber-500/20',
          bgSoft: 'bg-amber-500/10',
        };
      }
      return {
        label: 'Bom',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500',
        border: 'border-emerald-500/20',
        bgSoft: 'bg-emerald-500/10',
      };
    }

    if (demandaBase > 0) {
      const diasCobertura = saldoKg / demandaBase;
      if (diasCobertura <= 3) {
        return {
          label: 'Critico',
          text: 'text-red-400',
          bg: 'bg-red-500',
          border: 'border-red-500/20',
          bgSoft: 'bg-red-500/10',
        };
      }
      if (diasCobertura <= 7) {
        return {
          label: 'Baixo',
          text: 'text-amber-400',
          bg: 'bg-amber-500',
          border: 'border-amber-500/20',
          bgSoft: 'bg-amber-500/10',
        };
      }
      return {
        label: 'Bom',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500',
        border: 'border-emerald-500/20',
        bgSoft: 'bg-emerald-500/10',
      };
    }

    if (saldoQtd <= 500) {
      return {
        label: 'Critico',
        text: 'text-red-400',
        bg: 'bg-red-500',
        border: 'border-red-500/20',
        bgSoft: 'bg-red-500/10',
      };
    }
    if (saldoQtd <= 1500) {
      return {
        label: 'Baixo',
        text: 'text-amber-400',
        bg: 'bg-amber-500',
        border: 'border-amber-500/20',
        bgSoft: 'bg-amber-500/10',
      };
    }
    return {
      label: 'Bom',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500',
      border: 'border-emerald-500/20',
      bgSoft: 'bg-emerald-500/10',
    };
  };

  const isVisaoGeralComercial = comercialVisao === 'visao';
  const mostrarPedidosComercial = isVisaoGeralComercial || comercialVisao === 'pedidos';
  const mostrarEstoqueComercial = isVisaoGeralComercial || comercialVisao === 'estoque';
  const mostrarSolicitacoesComercial =
    isVisaoGeralComercial || comercialVisao === 'solicitacoes';
  const mostrarProntosComercial = isVisaoGeralComercial || comercialVisao === 'prontos';
  const canManageEstoque = effectiveViewMode === 'admin';


  const calcResumo = (lista) => ({ itens: lista.reduce((a,r)=>a+r.itens.length,0), peso: lista.reduce((a,r)=>a+r.itens.reduce((s,i)=>s+parseFloat(i.pesoTotal||0),0),0) });

  // --- DASHBOARD E OEE ---
  // --- DASHBOARD E OEE (Lógica Atualizada) ---
  // --- DASHBOARD E OEE (Lógica Atualizada com Filtros) ---
  // --- SUBSTITUA O SEU 'const dadosIndicadores' ATUAL POR ESTE INTEIRO ---
  const dadosIndicadores = useMemo(() => {
  const agrupadoPorDia = {};

  // ========= helpers =========
    const toISO = (d) => {
      const iso = normalizeISODateInput(d);
      if (!ISO_DATE_RE.test(iso)) return "";
      const dt = new Date(`${iso}T12:00:00`);
      return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().split("T")[0];
    };

  const isDiaUtil = (iso) => {
    const dow = new Date(iso + "T12:00:00").getDay();
    return dow !== 0 && dow !== 6;
  };

  const MAQUINA_SEM = "SEM_MAQUINA";

  const getMaquina = (p) => {
    const m = (p.maquina ?? p.nomeMaquina ?? p.eqp ?? p.equipamento ?? "")
      .toString()
      .trim();
    return m || MAQUINA_SEM;
  };

  // peso executado: usa pesoTotal se existir; senão fallback catálogo
  const calcPesoExecutadoKg = (p) => {
    const pesoDireto = Number(p.pesoTotal || 0);
    if (pesoDireto > 0) return pesoDireto;

    const prod = CATALOGO_PRODUTOS?.find((c) => c.cod === p.cod);
    if (!prod) return 0;

    const qtd = Number(p.qtd || 0);

    if (prod.pesoUnit != null) {
      return Number(prod.pesoUnit || 0) * qtd;
    }

    if (prod.kgMetro != null) {
      const metros = Number(p.metros || p.comp || p.comprimento || 0);
      return Number(prod.kgMetro || 0) * metros * qtd;
    }

    return 0;
  };

  // ========= 1) cria range dia a dia (para o gráfico) =========
  let currDate = new Date(dataInicioInd + "T12:00:00");
  const lastDate = new Date(dataFimInd + "T12:00:00");

  while (currDate <= lastDate) {
    const iso = toISO(currDate);
    agrupadoPorDia[iso] = { pesoPlanejado: 0, pesoExecutado: 0 };
    currDate.setDate(currDate.getDate() + 1);
  }

  // ========= 2) planejado no período (romaneio) =========
  const romaneiosNoPeriodo = filaProducao.filter(
    (r) => r.data >= dataInicioInd && r.data <= dataFimInd
  );

  romaneiosNoPeriodo.forEach((r) => {
    const iso = String(r.data);
    if (!agrupadoPorDia[iso]) return;

    const pesoDia = (r.itens || []).reduce(
      (acc, i) => acc + Number(i.pesoTotal || 0),
      0
    );

    agrupadoPorDia[iso].pesoPlanejado += pesoDia;
  });

  // ========= 3) executado no período + filtro por maquina =========
  const producaoNoPeriodoBase = historicoProducaoReal.filter(
    (p) => p.data >= dataInicioInd && p.data <= dataFimInd
  );

  const producaoNoPeriodo = producaoNoPeriodoBase.filter((p) => {
    if (!maquinaSelecionada || maquinaSelecionada === "TODAS") return true;
    return getMaquina(p) === maquinaSelecionada;
  });

  producaoNoPeriodo.forEach((p) => {
    const iso = String(p.data);
    if (!agrupadoPorDia[iso]) return;

    agrupadoPorDia[iso].pesoExecutado += calcPesoExecutadoKg(p);
  });

  // ========= 4) array do gráfico =========
  const arrayGrafico = Object.keys(agrupadoPorDia)
    .sort()
    .map((data) => ({ data, ...agrupadoPorDia[data] }));

  // ========= 5) totais do período =========
  const totalPesoPlanejado = Object.values(agrupadoPorDia).reduce(
    (acc, d) => acc + d.pesoPlanejado,
    0
  );

  const totalPesoExecutado = Object.values(agrupadoPorDia).reduce(
    (acc, d) => acc + d.pesoExecutado,
    0
  );

  // ========= 6) META / SALDO / RITMO / PROJEÇÃO =========
  const capacidadeNum = Number(capacidadeDiaria) || 0;

  // mês de referência = mês do dataInicioInd
  const baseMes = new Date(dataInicioInd + "T12:00:00");
  const inicioMes = new Date(baseMes.getFullYear(), baseMes.getMonth(), 1);
  const fimMes = new Date(baseMes.getFullYear(), baseMes.getMonth() + 1, 0);

  const hojeDate = new Date(hojeISO + "T12:00:00");

  // ---- A) SALDO: ignora dias sem programação (barra clara)
  // programação do mês inteiro (pra saber quais dias tiveram programação)
  const planejadoPorDiaMes = {};
  filaProducao
    .filter((r) => r.data >= toISO(inicioMes) && r.data <= toISO(fimMes))
    .forEach((r) => {
      const pesoDia = (r.itens || []).reduce(
        (acc, i) => acc + Number(i.pesoTotal || 0),
        0
      );
      planejadoPorDiaMes[r.data] = (planejadoPorDiaMes[r.data] || 0) + pesoDia;
    });

  // dias úteis COM programação até hoje
  let diasProgramadosAteHoje = 0;
  for (
    let d = new Date(inicioMes);
    d <= hojeDate;
    d.setDate(d.getDate() + 1)
  ) {
    const iso = toISO(d);
    if (!isDiaUtil(iso)) continue;
    if ((planejadoPorDiaMes[iso] || 0) > 0) diasProgramadosAteHoje++;
  }
  if (diasProgramadosAteHoje === 0) diasProgramadosAteHoje = 1;

  const metaAteHoje = capacidadeNum * diasProgramadosAteHoje;
  const saldoTotal = totalPesoExecutado - metaAteHoje; // ✅ saldo “cobrando só dia programado”

  // ---- B) META do mês (dias úteis do CALENDÁRIO)
  let diasUteisMes = 0;
  for (
    let d = new Date(inicioMes);
    d <= fimMes;
    d.setDate(d.getDate() + 1)
  ) {
    const iso = toISO(d);
    if (!isDiaUtil(iso)) continue;
    diasUteisMes++;
  }
  if (diasUteisMes === 0) diasUteisMes = 1;

  const metaAteFimMes = capacidadeNum * diasUteisMes; // ✅ agora é calendário

  // ---- C) Ritmo necessário: rateia o déficit pelos dias úteis restantes (CALENDÁRIO)
  let diasUteisRestantes = 0;
  const amanha = new Date(hojeDate);
  amanha.setDate(amanha.getDate() + 1);

  for (
    let d = new Date(amanha);
    d <= fimMes;
    d.setDate(d.getDate() + 1)
  ) {
    const iso = toISO(d);
    if (!isDiaUtil(iso)) continue;
    diasUteisRestantes++;
  }

  const deficit = Math.max(0, -saldoTotal); // KG
  const extraPorDia =
    diasUteisRestantes > 0 ? deficit / diasUteisRestantes : 0;

  const ritmoNecessario = capacidadeNum + extraPorDia;

  // ---- D) Projeção até fim do mês: média diária (dias úteis passados) * dias úteis do mês (CALENDÁRIO)
  let diasUteisPassados = 0;
  for (
    let d = new Date(inicioMes);
    d <= hojeDate;
    d.setDate(d.getDate() + 1)
  ) {
    const iso = toISO(d);
    if (!isDiaUtil(iso)) continue;
    diasUteisPassados++;
  }
  if (diasUteisPassados === 0) diasUteisPassados = 1;

  const mediaAtual = totalPesoExecutado / diasUteisPassados;
  const projecaoFinal = mediaAtual * diasUteisMes;

  return {
    arrayGrafico,
    totalPesoPlanejado,
    totalPesoExecutado,
    saldoTotal,
    ritmoNecessario,
    projecaoFinal,
    metaAteFimMes,
  };
}, [
  filaProducao,
  historicoProducaoReal,
  dataInicioInd,
  dataFimInd,
  capacidadeDiaria,
  hojeISO,
  CATALOGO_PRODUTOS,
  maquinaSelecionada,
]);






// --- Helper: evento de tempo útil (maquina rodando) -----------------
const ehTempoUtil = (evento) => {
  const grupo = String(evento.grupo || '').toUpperCase().trim();
  const cod   = String(evento.codMotivo || evento.codigo || '').toUpperCase().trim();

  // Grupo TU cadastrado no dicionário
  if (grupo === 'TU') return true;

  // Segurança extra: códigos TU01, TU02 etc
  if (cod.startsWith('TU')) return true;

  return false;
};

const handleReprogramarItensSelecionados = () => {
  if (!novaDataReprogramacao) {
    alert("Escolha a nova data para reprogramar.");
    return;
  }

  if (!selectedItemIds || selectedItemIds.length === 0) {
    alert("Selecione pelo menos um item para reprogramar.");
    return;
  }

  const itensParaMover = itensNoPedido.filter((i) =>
    selectedItemIds.includes(i.tempId)
  );
  const itensQueFicam = itensNoPedido.filter(
    (i) => !selectedItemIds.includes(i.tempId)
  );

  if (itensParaMover.length === 0) {
    alert("Nenhum item válido encontrado para reprogramar.");
    return;
  }

  setItensNoPedido(itensQueFicam);
  setItensReprogramados(itensParaMover);

  console.log(
    "🔁 Itens marcados para reprogramar em",
    novaDataReprogramacao,
    itensParaMover
  );

  setSelectedItemIds([]);
};





const handleRegistrarParada = async (novaParada) => {
  // gera um ID temporário local
  const paradaLocal = {
    id: `par_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...novaParada,
  };

  // 1) SEMPRE joga no histórico local
  setHistoricoParadas((prev) => [...prev, paradaLocal]);

  // 2) Em localhost, não chama Firebase
  if (IS_LOCALHOST) {
    console.info("[Paradas] Rodando em localhost, não salvando no Firebase.");
    return;
  }

  // 3) Em produção, salva e troca o id temporário pelo id real
  try {
    const idGerado = await salvarApontamentoParada(novaParada);

    if (idGerado) {
      setHistoricoParadas((prev) =>
        prev.map((p) =>
          p.id === paradaLocal.id ? { ...p, id: idGerado } : p
        )
      );
    }
  } catch (erro) {
    console.error("Erro ao salvar parada no Firebase:", erro);
    alert("Erro ao salvar parada, tenta de novo.");
  }
};



const gerarNovoIdRomaneio = (romaneiosExistentes, dataISO) => {
  const base = dataISO.replaceAll('-', '');
  const sequencial =
    romaneiosExistentes.filter((r) => r.dataProducao === dataISO).length + 1;
  return `${base}-${String(sequencial).padStart(2, '0')}`; // ex: 20250209-01
};



    const dadosOEE = useMemo(() => {
    // Se não tiver dado nenhum, já volta zerado
    if (!Array.isArray(historicoParadas) || !historicoParadas.length) {
      return {
        oee: 0,
        disponibilidade: 0,
        performance: 100,
        qualidade: 100,
        tempoProduzindo: 0,
        tempoParadoTotal: 0,
        tempoTurnoTotal: 0,
        diasPeriodo: 0,
        listaPareto: [],
      };
    }

    // Helpers de data
    const parseISODate = (iso) => {
      if (!iso) return null;
      const dt = new Date(`${iso}T00:00:00`);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const inicio = parseISODate(dataInicioInd);
    const fim = parseISODate(dataFimInd);

    // Se as datas estiverem zoada, não calcula nada
    if (!inicio || !fim || fim < inicio) {
      return {
        oee: 0,
        disponibilidade: 0,
        performance: 100,
        qualidade: 100,
        tempoProduzindo: 0,
        tempoParadoTotal: 0,
        tempoTurnoTotal: 0,
        diasPeriodo: 0,
        listaPareto: [],
      };
    }

    const MS_DIA = 24 * 60 * 60 * 1000;
    const diasPeriodo = Math.floor((fim - inicio) / MS_DIA) + 1;

    const turnoHorasNum = Number(turnoHoras) || 0;
    const tempoTurnoTotal = diasPeriodo * turnoHorasNum * 60; // minutos de turno no período

    // Convenção: códigos que começam com "TU" = maquina rodando
    const ehCodigoRodando = (cod) =>
      String(cod || "").toUpperCase().startsWith("TU");

    // Filtrar eventos de parada / funcionamento dentro do período
    const eventosPeriodo = historicoParadas.filter((p) => {
      if (!p?.data) return false;
      const d = parseISODate(p.data);
      return d && d >= inicio && d <= fim;
    });

    let tempoProduzindoMin = 0;
    let tempoParadoMin = 0;

    const mapaPareto = {};

    eventosPeriodo.forEach((p) => {
      const dur = Number(p.duracao) || 0;
      const cod = p.codMotivo || "";
      const desc = p.descMotivo || cod || "Motivo não informado";

      if (ehCodigoRodando(cod)) {
        // TU = maquina rodando
        tempoProduzindoMin += dur;
      } else {
        // Qualquer outro código = parada
        tempoParadoMin += dur;
        mapaPareto[desc] = (mapaPareto[desc] || 0) + dur;
      }
    });

    // Se por algum motivo não tiver TU apontado, mas tiver turno configurado,
    // assume que o resto do turno foi tempo rodando
    if (!tempoProduzindoMin && tempoTurnoTotal > 0) {
      tempoProduzindoMin = Math.max(tempoTurnoTotal - tempoParadoMin, 0);
    }

    // Disponibilidade = tempo rodando / tempo de turno
    const disponibilidade =
      tempoTurnoTotal > 0
        ? (tempoProduzindoMin / tempoTurnoTotal) * 100
        : 0;

    // Performance e Qualidade fixadas em 100% por enquanto
    const performance = 100;
    const qualidade = 100;

    // OEE = A * P * Q
    const oee = (disponibilidade * performance * qualidade) / 10000;

    // Pareto só com PARADAS (sem TU)
    const listaPareto = Object.entries(mapaPareto)
      .map(([motivo, tempo]) => ({ motivo, tempo }))
      .sort((a, b) => b.tempo - a.tempo)
      .slice(0, 5);

    return {
      oee,
      disponibilidade,
      performance,
      qualidade,
      tempoProduzindo: tempoProduzindoMin,
      tempoParadoTotal: tempoParadoMin,
      tempoTurnoTotal,
      diasPeriodo,
      listaPareto,
    };
  }, [historicoParadas, dataInicioInd, dataFimInd, turnoHoras]);



const migrarDadosParaNuvem = async () => {
    if (!confirm("Isso vai enviar todos os dados locais para o Firebase. Continuar?")) 
      
      return;

    try {
      console.log("Iniciando migração...");

      // 1. Subir Romaneios (PCP)
      console.log("Subindo Romaneios...");
      for (const item of filaProducao) {
        // removemos o sysId local para o Firebase criar o ID dele automático
        const { sysId, ...dados } = item; 
        await addDoc(collection(db, "romaneios"), dados);
      }

      // 2. Subir Histórico de Produção
      console.log("Subindo Produção...");
      for (const item of historicoProducaoReal) {
  const { id, ...rest } = item; // tira o id local
  await addDoc(collection(db, "producao"), rest);
}

      // 3. Subir Paradas
      console.log("Subindo Paradas...");
      for (const item of historicoParadas) {
        await addDoc(collection(db, "paradas"), item);
      }

      alert("SUCESSO! Todos os dados estão no Firebase agora. 🚀");
    } catch (erro) {
      console.error("Erro na migração:", erro);
      alert("Erro ao subir dados. Veja o console (F12).");
    }
  };


  // Exemplo simples de export
// --- BACKUP: EXPORTA TODAS AS COLEÇÕES PRINCIPAIS ---
// --- BACKUP: EXPORTA TODAS AS COLEÇÕES PRINCIPAIS ---
const handleExportBackup = async () => {
  try {
    // Lê direto do Firestore (do projeto DEV ou PROD, conforme firebase.js)
    const [romSnap, prodSnap, parSnap] = await Promise.all([
      getDocs(collection(db, 'romaneios')),
      getDocs(collection(db, 'producao')),
      getDocs(collection(db, 'paradas')),
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      romaneios: romSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      producao: prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      paradas: parSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-painelpcp-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Erro ao gerar backup:', err);
    alert('Erro ao gerar backup. Veja o console (F12).');
  }
};



// --- BACKUP: IMPORTA (SÓ ESCREVE EM PRODUÇÃO) ---
// --- BACKUP: IMPORTAÇÃO LOCAL (MODO PLAYGROUND) ---
const handleImportBackup = (json) => {
  if (!json) return;

  console.log("📂 Carregando dados do backup na memória...", json);

  // 1. Atualiza os ROMANEIOS (PCP)
  if (Array.isArray(json.romaneios)) {
    setFilaProducao(json.romaneios);
  }

  // 2. Atualiza a PRODUÇÃO (Apontamentos)
  if (Array.isArray(json.producao)) {
    // Garante que o campo 'cod' existe para não quebrar tabelas
    const prodFormatada = json.producao.map(p => ({
        ...p,
        cod: p.cod || p.codigo || '' // fallback se o nome estiver diferente
    }));
    setHistoricoProducaoReal(prodFormatada);
  }

  // 3. Atualiza as PARADAS
  if (Array.isArray(json.paradas)) {
    setHistoricoParadas(json.paradas);
  }

  alert('Dados carregados! O app está rodando com os dados do arquivo (Modo Offline).');
};

  const formatarDescricaoImpressao = (item) => {
    const desc = String(item?.desc || '').trim();
    const comp = Number(item?.comp);
    if (!Number.isFinite(comp) || comp <= 0) return desc;
    return `${desc} ${comp.toFixed(2)}M`;
  };

  const romaneiosParaImpressao = filaProducao
    .filter((r) => getDataRomaneio(r) === dataFiltroImpressao)
    .filter((r) => {
      const temItens = Array.isArray(r.itens) && r.itens.length > 0;
      if (!temItens) return false;
      const pesoTotal = r.itens.reduce((a, b) => a + parseFloat(b.pesoTotal || 0), 0);
      return pesoTotal > 0;
    })
    .sort((a, b) => (a.cliente || '').localeCompare(b.cliente || ''));

  const getRomaneioLabel = (romaneio) => {
    const idLabel = romaneio?.id || romaneio?.romaneioId || '';
    if (romaneio?.tipo === 'EST') return idLabel || 'ESTOQUE';
    return idLabel;
  };

  const romaneiosPorMaquina = romaneiosParaImpressao.reduce((acc, r) => {
    const maquinaId = getMaquinaIdRomaneio(r);
    if (!acc[maquinaId]) acc[maquinaId] = [];
    acc[maquinaId].push(r);
    return acc;
  }, {});

  const impressaoPorMaquina = Object.entries(romaneiosPorMaquina).map(
    ([maquinaId, romaneios]) => {
      const itens = romaneios.flatMap((r) =>
        (r.itens || []).map((item, idx) => ({
          key: `${r.sysId || r.id || 'rom'}-${item.tempId || idx}`,
          cod: item.cod || '',
          desc: formatarDescricaoImpressao(item),
          romaneioId: getRomaneioLabel(r),
          destino: r.destino || r.transferenciaDestino || r.cliente || 'ESTOQUE',
          qtd: item.qtd || '',
          comp: Number(item.comp || 0),
          obs: r.totvs || '',
          pesoTotal: Number(item.pesoTotal || 0),
        }))
      );

      const totalQtd = itens.reduce((acc, item) => acc + Number(item.qtd || 0), 0);
      const totalMetros = itens.reduce(
        (acc, item) => acc + Number(item.comp || 0) * Number(item.qtd || 0),
        0
      );
      const totalPeso = itens.reduce((acc, item) => acc + Number(item.pesoTotal || 0), 0);

      return {
        maquinaId,
        maquinaLabel: getMaquinaNomeComercial(maquinaId),
        romaneiosCount: romaneios.length,
        itens,
        totalQtd,
        totalMetros,
        totalPeso,
      };
    }
  );




    return authGate || (
    <>
      <PrintStyles />
      <ProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        email={authUser?.email || ''}
        name={profileName}
        setor={profileSetor}
        onSave={handleSaveProfile}
        onLogout={handleLogout}
        error={profileError}
        saving={profileSaving}
      />

      {/* --- ÁREA DE IMPRESSÃO --- */}
      <div id="printable-area" className="print-page-container">
        {impressaoPorMaquina.map((bloco) => (
          <div key={bloco.maquinaId} className="print-section">
            <div className="print-header">
              <div className="print-header-top">
                <div className="print-brand">
                  <img src={logoMetalosa} alt="Metalosa" className="print-logo" />
                </div>
                <div className="print-headings">
                  <div className="print-title">ORDEM DE PRODUCAO</div>
                  <div className="print-subtitle">{bloco.maquinaLabel}</div>
                </div>
                <div className="print-control">
                  <div className="print-control-label">No</div>
                  <div className="print-control-value">{numeroControleImpressao || '---'}</div>
                </div>
              </div>
              <div className="print-meta-row">
                <div className="print-meta-chip">
                  <span>Prev. ini</span>
                  <strong>{formatarDataBR(dataFiltroImpressao)}</strong>
                </div>
                <div className="print-meta-chip">
                  <span>Prev. fim</span>
                  <strong>{formatarDataBR(dataFiltroImpressao)}</strong>
                </div>
                <div className="print-meta-chip">
                  <span>Romaneios</span>
                  <strong>{bloco.romaneiosCount}</strong>
                </div>
                <div className="print-meta-chip">
                  <span>Itens</span>
                  <strong>{bloco.itens.length}</strong>
                </div>
                <div className="print-meta-chip">
                  <span>Peso</span>
                  <strong>{bloco.totalPeso.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <table className="print-table">
              <thead>
                <tr>
                  <th className="center">COD</th>
                  <th>DESCRICAO DO PRODUTO</th>
                  <th className="center">ROMANEIO</th>
                  <th>DESTINO</th>
                  <th className="center">METROS</th>
                  <th className="center">QUANT. PCS</th>
                  <th className="center">OBS</th>
                </tr>
              </thead>
              <tbody>
                {bloco.itens.map((item) => (
                  <tr key={item.key}>
                    <td className="center">{item.cod}</td>
                    <td className="left">{item.desc}</td>
                    <td className="center">{item.romaneioId}</td>
                    <td className="center">{item.destino}</td>
                    <td className="center">{item.comp ? (item.comp * Number(item.qtd || 0)).toFixed(2) : ''}</td>
                    <td className="center">{item.qtd}</td>
                    <td className="center">{item.obs}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="left" colSpan={4}>TOTAL</td>
                  <td className="center">{bloco.totalMetros.toFixed(2)}</td>
                  <td className="center">{bloco.totalQtd}</td>
                  <td className="center">{bloco.totalPeso.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>

      {/* --- APP CONTAINER --- */}
      <div className="app-container relative flex flex-col md:flex-row h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
        
        {/* --- MENU DE NAVEGAÇÃO (CORRIGIDO COM OEE) --- */}
        <nav className="
            bg-[#09090b] border-t md:border-t-0 md:border-r border-white/10 z-50 shrink-0
            fixed bottom-0 w-full h-16 flex flex-row items-center px-2
            md:relative md:w-20 md:h-full md:flex-col md:justify-start md:py-6 md:px-0
        ">
          <div className="hidden md:flex flex-col items-center gap-2 mb-6 px-2 w-full">
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/20"
              aria-label="Editar perfil"
            >
              <User size={16} className="text-emerald-300" />
            </button>
            <div className="text-[10px] text-white font-semibold text-center truncate w-full">
              {profileName || authUser?.email || 'Usuario'}
            </div>
          <div className="text-[9px] text-zinc-500 text-center truncate w-full">
            {profileSetor || 'Sem setor'}
          </div>
        </div>
        {IS_LOCALHOST && isAdminUser && (
          <button
            type="button"
            onClick={() =>
              setDevViewMode((prev) =>
                prev === 'admin' ? 'comercial' : 'admin'
              )
            }
            className="hidden md:inline-flex mx-auto mb-4 px-2 py-1 text-[9px] font-bold uppercase tracking-wide bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg"
          >
            Modo: {devViewMode === 'admin' ? 'Admin' : 'Comercial'}
          </button>
        )}
          <div className="flex flex-row w-full gap-2 overflow-x-auto md:flex-col md:gap-4 md:px-2 md:overflow-y-auto md:pb-6 hide-scrollbar">
            {effectiveViewMode !== 'comercial' && (
              <BotaoMenu ativo={abaAtiva === 'agenda'} onClick={() => setAbaAtiva('agenda')} icon={<CalendarDays size={20} />} label="Agenda" />
            )}
            {effectiveViewMode !== 'comercial' && (
              <BotaoMenu ativo={abaAtiva === 'planejamento'} onClick={() => setAbaAtiva('planejamento')} icon={<ClipboardList size={20} />} label="PCP" />
            )}
            <BotaoMenu ativo={abaAtiva === 'comercial'} onClick={() => setAbaAtiva('comercial')} icon={<Box size={20} />} label="Comercial" />
            {effectiveViewMode !== 'comercial' && (
              <BotaoMenu ativo={abaAtiva === 'producao'} onClick={() => setAbaAtiva('producao')} icon={<Factory size={20} />} label="Prod" />
            )}
            {effectiveViewMode !== 'comercial' && (
              <BotaoMenu ativo={abaAtiva === 'apontamento'} onClick={() => setAbaAtiva('apontamento')} icon={<AlertOctagon size={20} />} label="Paradas" />
            )}
            
            {/* --- OEE ESTÁ DE VOLTA AQUI --- */}
            {effectiveViewMode !== 'comercial' && (
              <BotaoMenu ativo={abaAtiva === 'oee'} onClick={() => setAbaAtiva('oee')} icon={<Activity size={20} />} label="OEE" />
            )}

            {effectiveViewMode !== 'comercial' && (
              <BotaoMenu ativo={abaAtiva === 'indicadores'} onClick={() => setAbaAtiva('indicadores')} icon={<BarChart3 size={20} />} label="Carga" />
            )}
            <div className="md:hidden">
              <BotaoMenu
                ativo={false}
                onClick={() => setShowProfileModal(true)}
                icon={<User size={20} />}
                label="Perfil"
              />
            </div>
            {IS_LOCALHOST && isAdminUser && (
              <div className="md:hidden">
                <BotaoMenu
                  ativo={false}
                  onClick={() =>
                    setDevViewMode((prev) =>
                      prev === 'admin' ? 'comercial' : 'admin'
                    )
                  }
                  icon={<Layout size={20} />}
                  label={devViewMode === 'admin' ? 'Admin' : 'Comercial'}
                />
              </div>
            )}
            {effectiveViewMode !== 'comercial' && (
              <BotaoMenu
                ativo={abaAtiva === 'global'}
                onClick={() => setAbaAtiva('global')}
                icon={<TrendingUp size={20} />}   // ou outro ?cone
                label="Global"
              />
            )}
            <BotaoMenu
              ativo={false}
              onClick={handleLogout}
              icon={<LogOut size={20} />}
              label="Sair"
            />

          </div>
        </nav>
        <div style={{ display: abaAtiva === 'global' ? 'block' : 'none' }}>
  <GlobalScreen />
</div>


        {/* --- CONTEÚDO --- */}


    
        <div className="flex-1 flex overflow-hidden bg-[#09090b] pb-16 md:pb-0">
          {/* ABA AGENDA */}
          {abaAtiva === 'agenda' && (
            <div className="flex-1 bg-[#09090b] p-4 md:p-6 overflow-hidden flex flex-col">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
    <h1 className="text-2xl font-bold flex gap-3">
      <Layers className="text-purple-500" size={28} /> Gestão
    </h1>

  <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto md:items-center">
    <BackupControls
      onExportBackup={handleExportBackup}
      onImportBackup={handleImportBackup}
    />

    <div className="flex gap-3 w-full md:w-auto">
      <input
        type="date"
        value={dataFiltroImpressao}
        onChange={(e) => setDataFiltroImpressao(e.target.value)}
        className="bg-zinc-800 border border-white/10 rounded p-2 text-white text-xs flex-1 md:flex-none"
      />
      <button onClick={handlePrint} className="p-2 bg-zinc-700 rounded text-white">
        <FileText size={20} />
      </button>
      <button
        onClick={abrirSelecaoMaquina}
        className="bg-purple-600 px-4 py-2 rounded font-bold text-white flex gap-2 items-center flex-1 md:flex-none justify-center"
      >
        <Plus size={20} /> Novo
      </button>
    </div>
  </div>
</header>

              {/* Grid Agenda: 1 coluna no mobile (com scroll) */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 overflow-y-auto pb-20 md:pb-4">

                <ColunaKanban
                    titulo="FALTA PROGRAMAR"
                    tituloCabecalho="COMERCIAL"
                    data={null}
                    cor="purple"
                    lista={colunasAgenda.semProgramar}
                    resumo={calcResumo(colunasAgenda.semProgramar)}
                    listaSecundaria={colunasAgenda.transferir}
                    resumoSecundario={calcResumo(colunasAgenda.transferir)}
                    tituloSecundario="FALTA TRANSFERIR"
                    onEdit={abrirModalEdicao}
                    enableDrag={effectiveViewMode !== 'comercial'}
                />
                
                <ColunaKanban 
                    titulo="HOJE" 
                    data={hoje} 
                    cor="emerald" 
                    lista={colunasAgenda.hoje} 
                    resumo={calcResumo(colunasAgenda.hoje)} 
                    onEdit={abrirModalEdicao}
                    enableDrag={effectiveViewMode !== 'comercial'}
                    enableDrop={effectiveViewMode !== 'comercial'}
                    onDropRomaneio={(key) => moverRomaneioParaData(key, hoje)}
                />
                
                <ColunaKanban 
                    titulo="AMANHÃ" 
                    data={amanha} 
                    cor="blue" 
                    lista={colunasAgenda.amanha} 
                    resumo={calcResumo(colunasAgenda.amanha)} 
                    onEdit={abrirModalEdicao}
                    enableDrag={effectiveViewMode !== 'comercial'}
                    enableDrop={effectiveViewMode !== 'comercial'}
                    onDropRomaneio={(key) => moverRomaneioParaData(key, amanha)}
                />
                
                {/* Coluna PRÓXIMOS com altura mínima corrigida */}
                <div className="flex flex-col min-h-[400px] md:h-full bg-zinc-900/30 rounded-2xl border border-white/5 overflow-hidden">
                  <div className="p-4 border-b border-white/5 bg-zinc-900/80">
                    <h2 className="text-lg font-black text-zinc-400">PRÓXIMOS</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {colunasAgenda.futuro.map((r) => (
                        <CardRomaneio key={r.sysId} romaneio={r} onEdit={() => abrirModalEdicao(r)} />
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}




          {/* ABA PCP */}
          {abaAtiva === 'planejamento' && (
    <div className="flex-1 bg-[#09090b] p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div className="flex flex-col gap-3">
              <h1 className="text-2xl md:text-3xl font-bold flex gap-3"><ClipboardList className="text-blue-500" size={32} /> PCP Geral</h1>
              <div className="inline-flex rounded-full bg-black/70 border border-white/10 text-[11px] overflow-hidden self-start">
                <button
                  onClick={() => setPcpAbaAtiva('ordens')}
                  className={`px-4 py-1.5 ${pcpAbaAtiva === 'ordens' ? 'bg-emerald-500 text-black font-semibold' : 'text-zinc-400 hover:bg-white/5'}`}
                >
                  Ordens
                </button>
                <button
                  onClick={() => setPcpAbaAtiva('crp')}
                  className={`px-4 py-1.5 ${pcpAbaAtiva === 'crp' ? 'bg-emerald-500 text-black font-semibold' : 'text-zinc-400 hover:bg-white/5'}`}
                >
                  CRP
                </button>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 text-xs text-zinc-300">
                  <span>Modo simulacao</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (sandboxAtivo) {
                        descartarSandbox();
                      } else {
                        iniciarSandbox();
                      }
                    }}
                    className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${
                      sandboxAtivo ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-black/80 transition-transform ${
                        sandboxAtivo ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  {sandboxAtivo && (
                    <span className="text-[10px] text-emerald-300">ativo</span>
                  )}
                </div>
                {sandboxAtivo && (
                  <>
                    <button
                      type="button"
                      onClick={aplicarSandbox}
                      disabled={sandboxApplyPending}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded text-sm flex gap-2 whitespace-nowrap disabled:opacity-50"
                    >
                      Aplicar cenario
                    </button>
                    <button
                      type="button"
                      onClick={descartarSandbox}
                      className="bg-zinc-800 text-white px-3 py-2 rounded text-sm flex gap-2 whitespace-nowrap"
                    >
                      Descartar
                    </button>
                  </>
                )}
                <button onClick={handleDownloadModelo} className="bg-zinc-800 text-white px-3 py-2 rounded text-sm flex gap-2 whitespace-nowrap"><Download size={16} /> Modelo</button>
                <label className="bg-emerald-600 text-white px-3 py-2 rounded text-sm flex gap-2 cursor-pointer whitespace-nowrap"><Upload size={16} /> Importar <input type="file" onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" /></label>
                <button
                  onClick={selecionarTodosProgramadosPCP}
                  className="bg-zinc-700 text-white px-3 py-2 rounded text-sm flex gap-2 whitespace-nowrap"
                >
                  <CheckCircle2 size={16} /> Selecionar todos
                </button>
                <button
                  onClick={finalizarSelecionadosPCP}
                  className="bg-amber-500/90 text-black px-3 py-2 rounded text-sm flex gap-2 whitespace-nowrap disabled:opacity-50"
                  disabled={pcpSelecionados.length === 0}
                >
                  <CheckCircle2 size={16} /> Finalizar selecionados
                </button>
                <button onClick={abrirModalNovo} className="bg-blue-600 text-white px-3 py-2 rounded text-sm flex gap-2 whitespace-nowrap"><Plus size={16} /> Novo</button>
            </div>
        </header>
        {pcpAbaAtiva === 'ordens' && (
          <>
            <div className="bg-zinc-900 rounded-xl border border-white/10 p-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <h2 className="text-lg font-bold text-white">Apontar estoque de telha</h2>
                    <span className="text-[11px] text-zinc-500">Lanca saldo no estoque (destino: Estoque)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-2">
                        <label className="text-[11px] text-zinc-400">Data</label>
                        <input
                          type="date"
                          value={formEstoqueTelhaData}
                          onChange={(e) => setFormEstoqueTelhaData(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                        />
                    </div>
                    <div className="md:col-span-4">
                        <label className="text-[11px] text-zinc-400">Produto</label>
                        <select
                          value={formEstoqueTelhaCod}
                          onChange={handleSelectEstoqueTelhaProduto}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                        >
                          <option value="">Selecionar telha...</option>
                          {CATALOGO_PRODUTOS
                            .filter((p) => p.grupo === 'GRUPO_TELHAS')
                            .map((p) => (
                              <option key={p.cod} value={p.cod}>
                                {p.cod} - {p.desc}
                              </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-3">
                        <label className="text-[11px] text-zinc-400">Descricao</label>
                        <input
                          value={formEstoqueTelhaDesc}
                          onChange={(e) => setFormEstoqueTelhaDesc(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                          placeholder="Descricao"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-[11px] text-zinc-400">Comp (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formEstoqueTelhaComp}
                          onChange={(e) => setFormEstoqueTelhaComp(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                          placeholder="0"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-[11px] text-zinc-400">Qtd</label>
                        <input
                          type="number"
                          value={formEstoqueTelhaQtd}
                          onChange={(e) => setFormEstoqueTelhaQtd(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                          placeholder="0"
                        />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                        <button
                          type="button"
                          onClick={salvarApontamentoEstoqueTelha}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded p-2 text-sm font-bold"
                        >
                          Salvar
                        </button>
                    </div>
                </div>
            </div>
            {(pcpFiltroData || pcpFiltroMaquina) && (
              <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-3 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="text-xs text-zinc-400">
                  Filtro ativo:
                  {pcpFiltroData ? (
                    <span className="ml-2 text-zinc-200">Data {formatarDataBR(pcpFiltroData)}</span>
                  ) : null}
                  {pcpFiltroMaquina ? (
                    <span className="ml-2 text-zinc-200">
                      Maquina {getMaquinaNomeComercial(pcpFiltroMaquina)}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPcpFiltroData('');
                    setPcpFiltroMaquina('');
                  }}
                  className="px-3 py-1.5 bg-zinc-800 text-white text-xs rounded"
                >
                  Limpar filtro
                </button>
              </div>
            )}
            <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                    <thead><tr className="bg-black/40 text-zinc-400 text-xs border-b border-white/10">
                        <th className="p-4 w-10 text-center">Sel</th>
                        <th className="p-4">ID FIREBASE</th> {/* T?tulo da coluna atualizado */}
                    <th className="p-4">Data</th>
                    <th className="p-4 text-center">Reprogramar</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4 text-center">Peso</th>
                    <th className="p-4 text-right">#</th>
                </tr></thead>
                    <tbody className="divide-y divide-white/5">
                        {pcpListaFiltrada
                            // 1. Cria uma c?pia e ordena: mais recente (b) - mais antigo (a)
                            .slice()
                            .sort((a, b) => {
                              const dataA = getDataRomaneio(a);
                              const dataB = getDataRomaneio(b);
                              const timeA = dataA ? new Date(dataA).getTime() : 0;
                              const timeB = dataB ? new Date(dataB).getTime() : 0;
                              return timeB - timeA;
                            })
                            // 2. Limita a 50 itens para exibi??o
                            .slice(0, 300) 
                            .map((r) => {
                               const rowId = r.sysId || r.id;
                               const dataRomaneio = getDataRomaneio(r);
                               const programado = Boolean(dataRomaneio) && Boolean(r.maquinaId);
                           const original = sandboxAtivo ? sandboxOriginalMap.get(String(rowId)) : null;
                           const originalData = original ? getDataRomaneio(original) : '';
                           return (
                           <tr key={rowId} className="hover:bg-white/5">
                                    <td className="p-4 text-center">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-amber-500"
                                        disabled={!programado}
                                        checked={pcpSelecionados.includes(rowId)}
                                        onChange={() => togglePcpSelecionado(rowId)}
                                      />
                                    </td>
                                     {/* Exibindo o ID do Firebase (assumindo que est? em r.sysId) */}
                                    <td className="p-4 text-blue-400 font-mono text-xs">#{r.sysId}</td> 
    <td className="p-4 text-zinc-300">
      {formatarDataBR(getDataRomaneio(r))}
      {sandboxAtivo && originalData && originalData !== getDataRomaneio(r) ? (
        <div className="text-[10px] text-zinc-500">
          antes: {formatarDataBR(originalData)}
        </div>
      ) : null}
    </td>
                                <td className="p-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => abrirModalReprogramar(r)}
                                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] rounded"
                                  >
                                    Reagendar
                                  </button>
                                </td>
                                <td className="p-4">{r.cliente}</td>
                                    <td className="p-4 text-center">{r.itens.reduce((a, b) => a + parseFloat(b.pesoTotal || 0), 0).toFixed(1)}</td>
                                    <td className="p-4 text-right">
                                        {(IS_LOCALHOST || r.sysId) ? (
                                            <button onClick={() => deletarRomaneio(rowId)} className="text-zinc-400 hover:text-red-500">
                                                <Trash2 size={16} />
                                            </button>
                                        ) : (
                                            <span className="text-zinc-600 cursor-not-allowed">--</span>
                                        )}
                                    </td>                           </tr>
                            );
                            })}
                    </tbody>
                </table>
            </div>
          </>
        )}
        {pcpAbaAtiva === 'crp' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-xl border border-white/10 p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Ocupacao de maquina</h2>
                  <p className="text-sm text-zinc-400">
                    Carga planejada por dia da semana vs. capacidade diaria.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500">Semana de</span>
                  <input
                    type="date"
                    value={pcpCrpData}
                    onChange={(e) => setPcpCrpData(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded px-3 py-1.5 text-white text-xs"
                  />
                  {IS_LOCALHOST ? (
                    <button
                      type="button"
                      onClick={criarMockOcupacaoSemana}
                      className="ml-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded"
                    >
                      Mock ocupacao
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="px-4 md:px-8 mb-4">
                <div
                  className="grid gap-3 text-[11px] text-zinc-500"
                  style={{
                    gridTemplateColumns: `repeat(${crpOcupacaoSemana.dias.length}, minmax(0, 1fr))`,
                  }}
                >
                  {crpOcupacaoSemana.dias.map((dia) => (
                    <div
                      key={dia}
                      className={`text-center rounded-lg border px-2 py-2 ${
                        dia === hoje ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/5 bg-zinc-950/30'
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                        {getDiaSemanaLabel(dia)}
                      </div>
                      <div className={`text-sm font-semibold ${dia === hoje ? 'text-emerald-200' : 'text-zinc-200'}`}>
                        {formatarDataBR(dia)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {Object.entries(crpOcupacaoSemana.setores).map(([setor, maquinas]) => {
                  const aberto = crpSetoresAbertos[setor] !== false;
                  return (
                    <div key={setor} className="rounded-2xl border border-white/10 bg-zinc-950/40">
                      <button
                        type="button"
                        onClick={() => toggleCrpSetor(setor)}
                        className="w-full flex items-center justify-between px-4 py-3 border-b border-white/10 text-left"
                      >
                        <div className="text-sm font-semibold text-white">{setor}</div>
                        <div className="text-xs text-zinc-500">
                          {maquinas.length} maquina{maquinas.length === 1 ? '' : 's'} {aberto ? 'ocultar' : 'mostrar'}
                        </div>
                      </button>
                      {aberto ? (
                        <div className="p-4 space-y-4">
                          {maquinas.map((maquina) => {
                            const totalPesoSemana = maquina.diasDetalhe.reduce(
                              (acc, d) => acc + Number(d.peso || 0),
                              0
                            );
                            const diasSemana = maquina.diasDetalhe.length || 1;
                            const mediaOcupSemana =
                              maquina.capacidade > 0
                                ? (totalPesoSemana / (maquina.capacidade * diasSemana)) * 100
                                : 0;
                            const totalTonSemana = totalPesoSemana / 1000;
                            const status =
                              mediaOcupSemana >= 100
                                ? { label: 'Sobrecarregada', className: 'bg-red-500/10 text-red-300 border-red-500/30' }
                                : mediaOcupSemana <= 60
                                  ? { label: 'Ociosa', className: 'bg-sky-500/10 text-sky-300 border-sky-500/30' }
                                  : { label: 'Equilibrada', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };

                            const maquinaKey = maquina.maquinaId || maquina.maquina;
                            const mesAberto = Boolean(crpMesAberto[maquinaKey]);
                            const diasMes = crpMesInfo.dias;
                            const offset = crpMesInfo.primeiroDia.getDay();
                            const diasMesGrid = [
                              ...Array.from({ length: offset }).map(() => null),
                              ...diasMes,
                            ];

                            return (
                              <div
                                key={maquinaKey}
                                className="rounded-2xl border border-white/10 bg-black/60 p-4"
                              >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                  <div>
                                    <div className="text-xs text-zinc-500 uppercase">Maquina</div>
                                    <div className="text-lg font-bold text-white">{maquina.label}</div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs">
                                    <div className="text-zinc-400">Media {Math.round(mediaOcupSemana)}%</div>
                                    <div className="text-zinc-400">Semana {totalTonSemana.toFixed(1)}t</div>
                                    <div className={`px-2 py-1 rounded-full border ${status.className}`}>
                                      {status.label}
                                    </div>
                                    <div className="text-zinc-500">
                                      Cap {Math.round(maquina.capacidade).toLocaleString('pt-BR')} kg/dia
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleCrpMes(maquinaKey)}
                                      className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                                    >
                                      {mesAberto ? 'Fechar mes' : 'Ver mes'}
                                    </button>
                                  </div>
                                </div>
                                <div
                                  className="grid gap-3"
                                  style={{
                                    gridTemplateColumns: `repeat(${crpOcupacaoSemana.dias.length}, minmax(0, 1fr))`,
                                  }}
                                >
                                  {maquina.diasDetalhe.map((dia) => {
                                    const percent = Number.isFinite(dia.percent) ? dia.percent : 0;
                                    const percentFill = Math.min(percent, 100);
                                    const acima = percent > 100;
                                    const excedenteKg = Math.max(0, Math.round(dia.peso - maquina.capacidade));
                                    const overflowPercent = percent > 100 ? Math.min(percent - 100, 100) : 0;
                                    const barBaseClass =
                                      acima ? 'bg-red-800' : percent >= 85 ? 'bg-amber-500' : 'bg-emerald-500';
                                    const barOverflowClass = 'bg-red-500';
                                    return (
                                      <div
                                        key={dia.dia}
                                        className={`flex flex-col gap-2 rounded-xl border p-3 cursor-pointer ${
                                          dia.dia === hoje
                                            ? 'border-emerald-500/60 bg-emerald-500/10'
                                            : 'border-white/5 bg-zinc-950/60'
                                        }`}
                                        onClick={() => {
                                          setCrpDetalheData(dia.dia);
                                          setCrpDetalheMaquinaId(maquina.maquinaId || '');
                                          setCrpDetalheMaquinaLabel(maquina.label || '');
                                          setCrpDetalheAberto(true);
                                        }}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="text-[10px] uppercase text-zinc-500">Ocupacao</div>
                                          {acima ? (
                                            <div className="text-[11px] font-semibold text-red-300">
                                              +{excedenteKg.toLocaleString('pt-BR')}kg ({Math.round(percent)}%)
                                            </div>
                                          ) : (
                                            <div className="text-[11px] font-semibold text-zinc-200">
                                              {Math.round(percent)}%
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="relative h-20 w-5 rounded-full bg-black/60 border border-white/10 overflow-hidden">
                                            <div
                                              className={`absolute left-0 right-0 bottom-0 ${barBaseClass}`}
                                              style={{ height: `${percentFill}%` }}
                                            />
                                            {overflowPercent > 0 ? (
                                              <>
                                                <div className="absolute left-0 right-0 top-0 h-1 border-t border-dashed border-red-300/80" />
                                                <div
                                                  className={`absolute left-0 right-0 bottom-0 ${barOverflowClass}`}
                                                  style={{ height: `${overflowPercent}%`, opacity: 0.85 }}
                                                />
                                              </>
                                            ) : null}
                                          </div>
                                          <div className="flex-1">
                                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                              <span>Kg</span>
                                              <span
                                                className={`font-semibold ${acima ? 'text-red-300' : 'text-zinc-100'}`}
                                              >
                                                {Math.round(dia.peso).toLocaleString('pt-BR')}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                              <span>Ordens</span>
                                              <span className="text-zinc-300">{dia.ordens}</span>
                                            </div>
                                            {overflowPercent > 0 ? (
                                              <div className="mt-1 text-[10px] text-red-300 font-semibold">
                                                +{excedenteKg.toLocaleString('pt-BR')}kg acima
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {mesAberto ? (
                                  <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="text-xs text-zinc-400">
                                        Calendario - {crpMesInfo.mesLabel}
                                      </div>
                                      <div className="text-[10px] text-zinc-500">
                                        Ocupacao mensal
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-2 text-[10px] text-zinc-500 mb-2">
                                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((label) => (
                                        <div key={label} className="text-center">{label}</div>
                                      ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-2">
                                      {diasMesGrid.map((dia, idx) => {
                                        if (!dia) {
                                          return <div key={`empty-${idx}`} className="h-12 rounded bg-black/20 border border-white/5" />;
                                        }
                                        const pesoDia = crpMesInfo.pesoMap[maquinaKey]?.[dia] || 0;
                                        const percent = maquina.capacidade > 0 ? (pesoDia / maquina.capacidade) * 100 : 0;
                                        const percentFill = Math.min(percent, 100);
                                        const acima = percent > 100;
                                        const barClass = acima
                                          ? 'bg-red-600'
                                          : percent >= 85
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500';
                                        return (
                                          <div key={dia} className="h-12 rounded border border-white/10 bg-black/40 p-1 flex flex-col justify-between">
                                            <div className="text-[10px] text-zinc-400">{dia.slice(-2)}</div>
                                            <div className="text-[10px] text-zinc-200 text-right">
                                              {Math.round(percent)}%
                                            </div>
                                            <div className="h-1 bg-white/10 rounded overflow-hidden">
                                              <div className={`${barClass} h-full`} style={{ width: `${percentFill}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {crpDetalheAberto && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[75] flex items-center justify-center p-4">
            <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-3xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                <div>
                  <div className="text-sm font-semibold text-white">Ordens do dia</div>
                  <div className="text-xs text-zinc-400">
                    {crpDetalheMaquinaLabel || 'Maquina'} - {formatarDataBR(crpDetalheData)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCrpDetalheAberto(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {crpDetalheOrdens.length === 0 ? (
                  <div className="text-sm text-zinc-500">Nenhuma ordem para este dia.</div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-xs text-zinc-500">
                      <tr>
                        <th className="p-3">OP</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Produto</th>
                        <th className="p-3 text-center">Peso</th>
                        <th className="p-3 text-center">Entrega</th>
                        <th className="p-3 text-right">Acoes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {crpDetalheOrdens.map((r) => {
                        const rowId = r.sysId || r.id;
                        const itens = r.itens || [];
                        const produtoBase = itens[0]?.desc || '-';
                        const produtoExtra = itens.length > 1 ? ` (+${itens.length - 1})` : '';
                        const peso = getPesoRomaneio(r);
                        const entrega = getDataRomaneio(r);
                        const rowKey =
                          rowId ||
                          r.romaneioId ||
                          r.id ||
                          `${r.cliente || 'cliente'}-${entrega}`;
                        return (
                          <tr key={rowKey}>
                            <td className="p-3 text-zinc-300">{r.id || r.romaneioId || rowId}</td>
                            <td className="p-3">{r.cliente || '-'}</td>
                            <td className="p-3 text-zinc-300">
                              {produtoBase}{produtoExtra}
                            </td>
                            <td className="p-3 text-center text-zinc-200">{peso.toFixed(1)}</td>
                            <td className="p-3 text-center text-zinc-200">{formatarDataBR(entrega)}</td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={!rowId}
                                  onClick={() => abrirModalReprogramar(r)}
                                  className="px-2 py-1 bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-semibold rounded disabled:opacity-40"
                                >
                                  Reagendar
                                </button>
                                <button
                                  type="button"
                                  disabled={!rowId}
                                  onClick={() => {
                                    setCrpDetalheAberto(false);
                                    abrirModalEdicao(r);
                                  }}
                                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-semibold rounded disabled:opacity-40"
                                >
                                  Dividir lote
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {reprogramarAberto && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                <div>
                  <div className="text-sm font-semibold text-white">Reagendar ordem</div>
                  <div className="text-xs text-zinc-400">
                    {(reprogramarRomaneio?.id || reprogramarRomaneio?.romaneioId || reprogramarRomaneio?.sysId || '')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReprogramarAberto(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="text-xs text-zinc-500">
                  Atual: {formatarDataBR(getDataRomaneio(reprogramarRomaneio || {}))}
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400">Nova data</label>
                  <input
                    type="date"
                    value={reprogramarData}
                    onChange={(e) => setReprogramarData(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setReprogramarData(hoje)}
                    className="px-3 py-1 bg-zinc-800 text-white text-xs rounded"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setReprogramarData(amanha)}
                    className="px-3 py-1 bg-zinc-800 text-white text-xs rounded"
                  >
                    Amanhã
                  </button>
                  <button
                    type="button"
                    onClick={() => setReprogramarData(getProximoDiaUtil(reprogramarData || hoje))}
                    className="px-3 py-1 bg-zinc-800 text-white text-xs rounded"
                  >
                    Prox. util
                  </button>
                  <button
                    type="button"
                    onClick={() => setReprogramarData(addDaysISO(reprogramarData || hoje, 7))}
                    className="px-3 py-1 bg-zinc-800 text-white text-xs rounded"
                  >
                    +7 dias
                  </button>
                </div>
              </div>
              <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReprogramarAberto(false)}
                  className="px-3 py-2 bg-zinc-800 text-white text-sm rounded"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rowId = reprogramarRomaneio?.sysId || reprogramarRomaneio?.id;
                    if (rowId && reprogramarData) {
                      moverRomaneioParaData(rowId, reprogramarData);
                    }
                    setReprogramarAberto(false);
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
)}

          {/* ABA PRODUCAO */}
{abaAtiva === "producao" && (
  <ProducaoScreen
    formApontProdData={formApontProdData}
    setFormApontProdData={setFormApontProdData}
    formApontProdCod={formApontProdCod}
    setFormApontProdCod={setFormApontProdCod}
    formApontProdQtd={formApontProdQtd}
    setFormApontProdQtd={setFormApontProdQtd}
    formApontProdComp={formApontProdComp}
    setFormApontProdComp={setFormApontProdComp}
    formApontProdDestino={formApontProdDestino}
    setFormApontProdDestino={setFormApontProdDestino}
    
    // --- LINHAS ADICIONADAS PARA MÁQUINA ---
    catalogoMaquinas={CATALOGO_MAQUINAS}             // <--- NOVO: Envia a lista
    formApontProdMaquina={formApontProdMaquina}      // <--- NOVO: Envia o valor selecionado
    setFormApontProdMaquina={setFormApontProdMaquina} // <--- NOVO: Envia a função de atualizar
    // ---------------------------------------

    handleSelectProdApontamento={handleSelectProdApontamento}
    salvarApontamentoProducao={salvarApontamentoProducao}
    apontamentoEmEdicaoId={apontamentoEmEdicaoId}
    limparFormApontamentoProducao={limparFormApontamentoProducao}
    historicoProducaoReal={historicoProducaoReal}
    iniciarEdicaoProducao={iniciarEdicaoProducao}
    deletarProducaoReal={deletarProducaoReal}
    handleUploadApontamentoProducao={handleUploadApontamentoProducao}
    handleDownloadModeloApontProd={handleDownloadModeloApontProd}
  />
)}


          
          {/* ABA PARADAS */}
          {abaAtiva === 'apontamento' && (
  <ParadasScreen
    eventosParada={historicoParadas}
    onRegistrarParada={handleRegistrarParada}
    deletarParada={deletarParada}
  />
)}



          {/* ABA OEE (AQUI ESTÁ ELA!) */}
          {abaAtiva === "oee" && (
  <OeeDashboard
    historicoProducaoReal={historicoProducaoReal}
    historicoParadas={historicoParadas}
    dataInicioInd={dataInicioInd}
    dataFimInd={dataFimInd}
    capacidadeDiaria={capacidadeDiaria}
    turnoHoras={turnoHoras}
  />
)}


          {/* ABA CARGA MÁQUINA */}
          {abaAtiva === 'indicadores' && (
            <div className="flex-1 bg-[#09090b] p-4 md:p-8 overflow-y-auto flex flex-col">
              
              <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold flex gap-3 text-white items-center">
                  <TrendingUp className="text-pink-500" size={28} /> 
                  <span className="truncate">Carga Máquina</span>
                </h1>
                <div className="w-full md:w-auto flex flex-col gap-2">
                  <div className="inline-flex rounded-full bg-black/70 border border-white/10 text-[11px] overflow-hidden self-end">
                    <button
                      onClick={() => {
                        setDataInicioInd(hoje);
                        setDataFimInd(hoje);
                      }}
                      className="px-3 py-1.5 text-zinc-400 hover:bg-white/5"
                    >
                      Hoje
                    </button>
                    <button
                      onClick={() => {
                        const inicio = getLocalISODate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
                        setDataInicioInd(inicio);
                        setDataFimInd(hoje);
                      }}
                      className="px-3 py-1.5 text-zinc-400 hover:bg-white/5"
                    >
                      7 Dias
                    </button>
                    <button
                      onClick={() => {
                        setDataInicioInd(primeiroDiaMesAtual);
                        setDataFimInd(hoje);
                      }}
                      className="px-3 py-1.5 bg-emerald-500 text-black font-semibold"
                    >
                      Mês
                    </button>
                    <button
                      onClick={() => {
                        const inicioAno = getLocalISODate(new Date(hojeDate.getFullYear(), 0, 1));
                        setDataInicioInd(inicioAno);
                        setDataFimInd(hoje);
                      }}
                      className="px-3 py-1.5 text-zinc-400 hover:bg-white/5"
                    >
                      Ano
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:flex gap-3 bg-zinc-900/50 p-3 rounded-xl border border-white/10 shadow-xl items-center">
                    <div className="col-span-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Início</label>
                      <input
                        type="date"
                        value={dataInicioIndDraft}
                        onChange={(e) => {
                          setDataInicioIndDraft(e.target.value);
                        }}
                        onBlur={() => {
                          const normalized = normalizeISODateInput(dataInicioIndDraft);
                          if (ISO_DATE_RE.test(normalized)) {
                            setDataInicioInd(normalized);
                          } else {
                            setDataInicioIndDraft(lastValidInicioIndRef.current);
                          }
                        }}
                        className="w-full bg-black/50 border border-white/10 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Fim</label>
                      <input
                        type="date"
                        value={dataFimIndDraft}
                        onChange={(e) => {
                          setDataFimIndDraft(e.target.value);
                        }}
                        onBlur={() => {
                          const normalized = normalizeISODateInput(dataFimIndDraft);
                          if (ISO_DATE_RE.test(normalized)) {
                            setDataFimInd(normalized);
                          } else {
                            setDataFimIndDraft(lastValidFimIndRef.current);
                          }
                        }}
                        className="w-full bg-black/50 border border-white/10 rounded p-1.5 text-white text-xs"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-[10px] text-pink-500 font-bold uppercase block mb-1">Meta/Dia</label>
                      <input type="number" value={capacidadeDiaria} onChange={(e) => setCapacidadeDiaria(e.target.value)} className="w-full bg-black/50 border border-pink-500/30 rounded p-1.5 text-white text-xs font-mono" />
                    </div>
                  </div>
                </div>
              </header>

              {/* Cards KPIs (1) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <CardIndicador label="Planejado (Ton)" valor={(dadosIndicadores.totalPesoPlanejado / 1000).toFixed(1)} icon={<Scale size={24} className="text-zinc-400" />} />
                <CardIndicador label="Executado (Ton)" valor={(dadosIndicadores.totalPesoExecutado / 1000).toFixed(1)} icon={<CheckCircle2 size={24} className="text-blue-500" />} />
                <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl flex items-center gap-4 relative overflow-hidden">
                  <div className={`absolute right-0 top-0 bottom-0 w-1 ${dadosIndicadores.totalPesoExecutado >= dadosIndicadores.totalPesoPlanejado ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
                  <div className="p-3 bg-zinc-950 rounded-lg border border-white/5"><Activity size={24} className={dadosIndicadores.totalPesoExecutado >= dadosIndicadores.totalPesoPlanejado ? "text-emerald-500" : "text-yellow-500"} /></div>
                  <div><div className="text-zinc-500 text-[10px] uppercase font-bold">Aderência</div><div className="text-2xl font-black text-white">{dadosIndicadores.totalPesoPlanejado > 0 ? ((dadosIndicadores.totalPesoExecutado / dadosIndicadores.totalPesoPlanejado) * 100).toFixed(0) : 0}%</div></div>
                </div>
                <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-2"><span className="text-[10px] text-zinc-500 font-bold uppercase">Meta Global</span><span className="text-xs font-mono text-pink-400">{(capacidadeDiaria/1000).toFixed(1)}t/dia</span></div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5"><div className="bg-gradient-to-r from-pink-600 to-purple-600 h-1.5 rounded-full" style={{ width: '65%' }}></div></div>
                </div>
              </div>

              {/* Cards Avançados (2) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className={`p-4 rounded-xl border flex items-center gap-4 ${dadosIndicadores.saldoTotal >= 0 ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-red-950/20 border-red-500/20'}`}>
                  <div className={`p-3 rounded-lg border ${dadosIndicadores.saldoTotal >= 0 ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
                    {dadosIndicadores.saldoTotal >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  </div>
                  <div><div className="text-zinc-400 text-[10px] uppercase font-bold">Saldo</div><div className={`text-2xl font-black ${dadosIndicadores.saldoTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{dadosIndicadores.saldoTotal > 0 ? '+' : ''}{(dadosIndicadores.saldoTotal / 1000).toFixed(1)} t</div></div>
                </div>
                <div className="bg-zinc-900 p-4 rounded-xl border border-white/10 flex items-center gap-4">
                  <div className="p-3 bg-zinc-950 rounded-lg border border-white/5 text-amber-500"><Activity size={24} /></div>
                  <div><div className="text-zinc-500 text-[10px] uppercase font-bold">Ritmo Necessário</div><div className="text-2xl font-black text-white">{(dadosIndicadores.ritmoNecessario / 1000).toFixed(1)} <span className="text-sm font-normal text-zinc-500">t/dia</span></div></div>
                </div>
                <div className="bg-zinc-900 p-4 rounded-xl border border-white/10 flex flex-col justify-center gap-2">
  <div className="flex justify-between items-end">
    <div>
      <div className="text-zinc-500 text-[10px] uppercase font-bold">
        Projeção até fim do mês
      </div>
      <div
        className={`text-xl font-black ${
          dadosIndicadores.projecaoFinal >= dadosIndicadores.metaAteFimMes
            ? 'text-emerald-400'
            : 'text-zinc-200'
        }`}
      >
        {(dadosIndicadores.projecaoFinal / 1000).toFixed(0)} t
      </div>
    </div>

    <div className="text-right">
      <div className="text-[10px] text-zinc-500">Meta do mês (dias úteis)</div>
      <div className="text-sm font-bold text-zinc-400">
        {(dadosIndicadores.metaAteFimMes / 1000).toFixed(0)} t
      </div>
    </div>
  </div>

  {/* Barra de progresso: projeção / meta */}
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${Math.min(
                          (dadosIndicadores.projecaoFinal / (dadosIndicadores.metaAteFimMes || 1)) * 100,
                          100
                        )}%`
                      }}
                    ></div>
                  </div>
                </div>

              </div>


              {/* Gráfico Side-by-Side */}
              <div className="flex-1 bg-zinc-900/40 rounded-2xl border border-white/10 p-4 md:p-6 relative flex flex-col min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-zinc-400 flex items-center gap-2"><BarChart3 size={16} /> Evolução Diária</h3>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dadosIndicadores.arrayGrafico} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barGap={2}>
                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={1}/><stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8}/></linearGradient>
                      <linearGradient id="grayArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#52525b" stopOpacity={0.4}/><stop offset="90%" stopColor="#52525b" stopOpacity={0.05}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="data" tickFormatter={(val) => formatarDataBR(val).slice(0, 5)} stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val/1000).toFixed(0)}`} />
                    <Tooltip cursor={{ fill: '#ffffff05' }} content={<CustomTooltip />} />
                    <ReferenceLine y={capacidadeDiaria} stroke="#be185d" strokeDasharray="3 3" strokeOpacity={0.6} />
                    
                    <Area type="monotone" dataKey="pesoPlanejado" fill="url(#grayArea)" stroke="#71717a" strokeWidth={2} dot={{ r: 3, fill: "#3f3f46", strokeWidth: 0 }} >
                        {/* Rótulo para Peso Planejado (Linha) */}
                        <LabelList 
                            dataKey="pesoPlanejado" 
                            position="top" 
                            formatter={(val) => `${(val / 1000).toFixed(1)}t`}
                            style={{ fill: '#71717a', fontSize: 9 }} 
                            dy={-10}
                        />
                    </Area>
                    
                    <Bar dataKey="pesoExecutado" barSize={30} fill="url(#blueGradient)" radius={[4, 4, 0, 0]}>
                        {/* Rótulo para Peso Executado (Barras) */}
                        <LabelList 
                            dataKey="pesoExecutado" 
                            position="top" 
                            formatter={(val) => `${(val / 1000).toFixed(1)}t`}
                            style={{ fill: '#ffffff', fontSize: 10, fontWeight: 'bold' }} 
                            dy={-10}
                        />
                    </Bar>

                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ABA COMERCIAL */}
          {abaAtiva === 'comercial' && (
            <div className="flex-1 bg-[#09090b] px-4 pb-8 pt-5 md:px-6 md:pt-6 overflow-y-auto">
              <div className="w-full space-y-5">
                <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                      <Scale className="text-orange-300" size={22} />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-white">Cockpit Comercial</h1>
                      <div className="text-[11px] text-zinc-500">Visao do estoque, pedidos e solicitacoes.</div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="flex items-center bg-zinc-950 rounded-lg px-3 py-2 border border-white/10 w-full lg:w-[380px]">
                      <Search size={14} className="text-zinc-500" />
                      <input
                        type="text"
                        value={comercialBusca}
                        onChange={(e) => setComercialBusca(e.target.value)}
                        placeholder={comercialVisao === 'estoque' ? 'Buscar produto...' : 'Buscar ordem, cliente ou produto'}
                        className="bg-transparent border-none outline-none text-sm text-zinc-200 ml-2 w-full placeholder-zinc-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setMostrarSolicitarProducao(true)}
                      className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 justify-center"
                    >
                      <Plus size={16} />
                      Nova solicitacao
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                  <button
                    type="button"
                    onClick={() => setComercialVisao('estoque')}
                    className={`relative overflow-hidden rounded-2xl p-5 text-left border transition-all duration-300 group w-full ${
                      comercialVisao === 'estoque'
                        ? 'bg-zinc-900 border-sky-500/50 shadow-[0_0_20px_rgba(0,0,0,0.3)] ring-1 ring-sky-500/50'
                        : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/50 hover:border-white/10'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-sky-500">
                      <Box size={80} strokeWidth={1} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-400">
                            <Box size={16} />
                          </div>
                          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Estoque</span>
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{estoqueComercialBase.length}</div>
                      </div>
                      <div className="text-xs text-zinc-500 mt-2 font-medium">Itens cadastrados</div>
                    </div>
                    {comercialVisao === 'estoque' && <div className="absolute bottom-0 left-0 h-1 w-full bg-sky-500" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setComercialVisao('visao')}
                    className={`relative overflow-hidden rounded-2xl p-5 text-left border transition-all duration-300 group w-full ${
                      comercialVisao === 'visao'
                        ? 'bg-zinc-900 border-orange-500/50 shadow-[0_0_20px_rgba(0,0,0,0.3)] ring-1 ring-orange-500/50'
                        : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/50 hover:border-white/10'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-orange-500">
                      <TrendingUp size={80} strokeWidth={1} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-400">
                            <TrendingUp size={16} />
                          </div>
                          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Producao ativa</span>
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{ordensProgramadasOrdenadas.length.toString().padStart(2, '0')}</div>
                      </div>
                      <div className="text-xs text-zinc-500 mt-2 font-medium">Ordens em andamento</div>
                    </div>
                    {comercialVisao === 'visao' && <div className="absolute bottom-0 left-0 h-1 w-full bg-orange-500" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setComercialVisao('pedidos')}
                    className={`relative overflow-hidden rounded-2xl p-5 text-left border transition-all duration-300 group w-full ${
                      comercialVisao === 'pedidos'
                        ? 'bg-zinc-900 border-amber-500/50 shadow-[0_0_20px_rgba(0,0,0,0.3)] ring-1 ring-amber-500/50'
                        : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/50 hover:border-white/10'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-amber-500">
                      <ClipboardList size={80} strokeWidth={1} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
                            <ClipboardList size={16} />
                          </div>
                          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pedidos abertos</span>
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{pedidosComercialAbertos.length}</div>
                      </div>
                      <div className="text-xs text-zinc-500 mt-2 font-medium">Em atendimento</div>
                    </div>
                    {comercialVisao === 'pedidos' && <div className="absolute bottom-0 left-0 h-1 w-full bg-amber-500" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setComercialVisao('prontos')}
                    className={`relative overflow-hidden rounded-2xl p-5 text-left border transition-all duration-300 group w-full ${
                      comercialVisao === 'prontos'
                        ? 'bg-zinc-900 border-emerald-500/50 shadow-[0_0_20px_rgba(0,0,0,0.3)] ring-1 ring-emerald-500/50'
                        : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/50 hover:border-white/10'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-500">
                      <CheckCircle2 size={80} strokeWidth={1} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
                            <CheckCircle2 size={16} />
                          </div>
                          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Prontos</span>
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{pedidosComercialProntos.length}</div>
                      </div>
                      <div className="text-xs text-zinc-500 mt-2 font-medium">Aguardando retirada</div>
                    </div>
                    {comercialVisao === 'prontos' && <div className="absolute bottom-0 left-0 h-1 w-full bg-emerald-500" />}
                  </button>
                </div>

                {comercialVisao === 'visao' && (
                <div
                  className={
                    isVisaoGeralComercial
                      ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr),340px] gap-5'
                      : 'grid grid-cols-1 gap-5'
                  }
                >
                  {mostrarPedidosComercial && (
                  <section className="flex flex-col gap-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <Factory className="text-orange-400" size={20} />
                          Ordens de Producao em Aberto
                        </h2>
                        <p className="text-xs text-zinc-500">Acompanhe e movimente o fluxo produtivo.</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[10px] px-2 py-1 rounded-full border border-red-500/30 text-red-300 bg-red-500/10">Critico</span>
                        <span className="text-[10px] px-2 py-1 rounded-full border border-amber-500/30 text-amber-300 bg-amber-500/10">Em aberto</span>
                      </div>
                    </div>

                    <div className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[680px]">
                          <thead className="bg-black/40 text-zinc-400 text-xs border-b border-white/10">
                            <tr>
                              <th className="px-4 py-3.5">OP / Cliente</th>
                              <th className="px-4 py-3.5">Produto / Maquina</th>
                              <th className="px-4 py-3.5">Status</th>
                              <th className="px-4 py-3.5">Data</th>
                              <th className="px-4 py-3.5 text-right">Acao</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {ordensComercialFiltradas.length === 0 && (
                              <tr>
                                <td className="px-4 py-3.5 text-zinc-500" colSpan={5}>
                                  Nenhuma ordem encontrada.
                                </td>
                              </tr>
                            )}
                            {ordensComercialFiltradas.map((r) => {
                              const badge = getStatusBadgeComercial(r.status);
                              const chave = r.sysId || r.id;
                              const itensAbertos = Boolean(comercialItensAbertos[chave]);
                              const itens = Array.isArray(r.itens) ? r.itens : [];
                              return (
                                <Fragment key={chave}>
                                  <tr className="hover:bg-white/5">
                                    <td className="px-4 py-3.5">
                                      <div className="text-white font-semibold">#{r.id || r.romaneioId}</div>
                                      <div className="text-[11px] text-zinc-500">{r.cliente}</div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="text-zinc-200">{r.itens?.[0]?.desc || 'Item'}</div>
                                      <div className="text-[11px] text-zinc-500">{getMaquinaNomeComercial(r.maquinaId)}</div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <span className={`text-[10px] px-2 py-1 rounded-full border ${badge.className}`}>
                                        {badge.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-zinc-300">{formatarDataBR(getDataRomaneio(r))}</td>
                                    <td className="px-4 py-3.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => toggleItensComercial(chave)}
                                        className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
                                      >
                                        Itens
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handlePrint}
                                        className="ml-2 px-3 py-1.5 rounded bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
                                      >
                                        Imprimir
                                      </button>
                                    </td>
                                  </tr>
                                  {itensAbertos && (
                                    <tr className="bg-black/30">
                                      <td className="px-4 py-3.5" colSpan={5}>
                                        <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Itens</div>
                                        <div className="mt-2 grid gap-2">
                                          {itens.length === 0 ? (
                                            <div className="text-sm text-zinc-500">Sem itens.</div>
                                          ) : (
                                            itens.map((item, idx) => (
                                              <div key={`${chave}-item-${idx}`} className="flex flex-wrap items-center gap-3 text-xs text-zinc-200">
                                                <span className="font-semibold text-white">{item.cod || '-'}</span>
                                                <span className="text-zinc-300">{item.desc || 'Item'}</span>
                                                <span className="text-zinc-400">{Number(item.qtd || 0)} un</span>
                                                <span className="text-zinc-400">{Number(item.comp || 0)} m</span>
                                                <span className="text-zinc-400">{Number(item.pesoTotal || 0)} kg</span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Pedidos em aberto</h3>
                        <span className="text-[11px] text-zinc-500">{pedidosComercialAbertos.length} pedidos</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {pedidosComercialAbertos.length === 0 && (
                          <div className="px-4 py-3 text-zinc-500 text-sm">Nenhum pedido em aberto.</div>
                        )}
                        {pedidosComercialAbertos.map((p) => {
                          const chave = p.sysId || p.id;
                          const itensAbertos = Boolean(comercialItensAbertos[chave]);
                          const itens = Array.isArray(p.itens) ? p.itens : [];
                          const tipoPedido =
                            String(p?.status || '').toUpperCase().trim() ===
                              'TRANSFERENCIA SOLICITADA' ||
                            String(p?.tipo || '').toUpperCase().trim() === 'TRANSF'
                              ? 'Transferencia'
                              : 'Producao';
                          return (
                            <div key={chave} className="px-4 py-3 flex flex-col gap-3">
                              <div>
                                <div className="text-white font-semibold">{p.cliente}</div>
                                <div className="text-[11px] text-zinc-500">#{p.requisicao || p.id} | {p.itens?.length || 0} itens</div>
                                <div className="mt-1 inline-flex items-center gap-2">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-500/30 text-sky-300 bg-sky-500/10">
                                    {tipoPedido}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col md:flex-row gap-2 md:items-center w-full md:w-auto">
                                <button
                                  type="button"
                                  onClick={() => abrirModalTransferenciaPedido(p)}
                                  className="px-3 py-2 rounded bg-amber-500/90 text-black text-xs font-bold hover:bg-amber-500"
                                >
                                  Transferir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleItensComercial(chave)}
                                  className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
                                >
                                  Itens
                                </button>
                                <button
                                  type="button"
                                  onClick={handlePrint}
                                  className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
                                >
                                  Imprimir
                                </button>
                              </div>
                              {itensAbertos && (
                                <div className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-zinc-200">
                                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Itens</div>
                                  <div className="mt-2 grid gap-2">
                                    {itens.length === 0 ? (
                                      <div className="text-sm text-zinc-500">Sem itens.</div>
                                    ) : (
                                      itens.map((item, idx) => (
                                        <div key={`${chave}-pedido-item-${idx}`} className="flex flex-wrap items-center gap-3">
                                          <span className="font-semibold text-white">{item.cod || '-'}</span>
                                          <span className="text-zinc-300">{item.desc || 'Item'}</span>
                                          <span className="text-zinc-400">{Number(item.qtd || 0)} un</span>
                                          <span className="text-zinc-400">{Number(item.comp || 0)} m</span>
                                          <span className="text-zinc-400">{Number(item.pesoTotal || 0)} kg</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                  )}

                  {(mostrarEstoqueComercial || mostrarSolicitacoesComercial || mostrarProntosComercial) && (
                  <aside className="flex flex-col gap-5">
                    {mostrarEstoqueComercial && (
                    <div className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Box size={16} className="text-sky-400" />
                          Estoque Disponivel
                        </h3>
                        <button
                          type="button"
                          onClick={() => setMostrarTransferenciaEstoque((prev) => !prev)}
                          className="text-[11px] px-2 py-1 rounded border border-white/10 text-zinc-300 hover:bg-white/5"
                        >
                          Solicitar transferencia
                        </button>
                      </div>
                      <div className="px-4 py-3.5 space-y-3.5">
                        <div className="flex items-center bg-black/50 border border-white/10 rounded px-2 py-1.5 text-xs">
                          <Search size={12} className="text-zinc-500" />
                          <input
                            value={comercialEstoqueBusca}
                            onChange={(e) => setComercialEstoqueBusca(e.target.value)}
                            placeholder="Filtrar estoque..."
                            className="bg-transparent border-none outline-none text-xs text-zinc-200 ml-2 w-full placeholder-zinc-600"
                          />
                        </div>
                        {estoqueTelhasFiltrado.length === 0 && (
                          <div className="text-xs text-zinc-500">Nenhum item em estoque.</div>
                        )}
                        {estoqueTelhasFiltrado.slice(0, 8).map((item) => (
                          <div key={item.cod} className="space-y-2">
                            <div className="flex justify-between text-xs text-zinc-300">
                              <span className="truncate">{item.desc}</span>
                              <span className="font-semibold">{Number(item.saldoQtd || 0)}</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full">
                              <div
                                className="h-1.5 bg-emerald-500/80 rounded-full"
                                style={{ width: `${Math.min(100, (Number(item.saldoQtd || 0) / 5000) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {mostrarTransferenciaEstoque && (
                        <div className="border-t border-white/10 px-4 py-3.5 space-y-3">
                          <div className="text-xs text-zinc-400">Solicitar transferencia</div>
                          <input
                            value={formTransfCliente}
                            onChange={(e) => setFormTransfCliente(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-xs"
                            placeholder="Destino / Cliente"
                          />
                          <select
                            value={formTransfCod}
                            onChange={handleSelectTransfProduto}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-xs"
                          >
                            <option value="">Selecionar produto...</option>
                            {estoqueComercialBase.map((p) => (
                              <option key={p.cod} value={p.cod}>
                                {p.cod} - {p.desc}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={formTransfQtd}
                              onChange={(e) => setFormTransfQtd(e.target.value)}
                              className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-xs"
                              placeholder="Qtd"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={formTransfComp}
                              onChange={(e) => setFormTransfComp(e.target.value)}
                              className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-xs"
                              placeholder="Comp"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={solicitarTransferenciaEstoque}
                            className="w-full px-3 py-2 bg-amber-500/90 hover:bg-amber-500 text-black rounded text-xs font-bold"
                          >
                            Enviar solicitacao
                          </button>
                        </div>
                      )}
                    </div>
                    )}

                    {mostrarSolicitacoesComercial && (
                    <div className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <ClipboardList size={16} className="text-purple-400" />
                          Minhas solicitacoes
                        </h3>
                        <span className="text-[11px] text-zinc-500">{solicitacoesComercial.length}</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {solicitacoesComercial.length === 0 && (
                          <div className="px-4 py-3 text-zinc-500 text-sm">Sem solicitacoes recentes.</div>
                        )}
                        {solicitacoesComercial.map((req) => (
                          <div key={req.sysId || req.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs text-zinc-500 uppercase">{req.tipo || 'Pedido'}</div>
                              <div className="text-sm text-zinc-100">{req.cliente}</div>
                              <div className="text-[11px] text-zinc-500">{req.itens?.[0]?.desc || 'Item'}</div>
                              {req.romaneioAnexo?.url || req.romaneioAnexo?.localData ? (
                                <button
                                  type="button"
                                  onClick={() => abrirRomaneioAnexo(req.romaneioAnexo)}
                                  className="text-[11px] text-sky-400 hover:text-sky-300"
                                >
                                  Romaneio: {req.romaneioAnexo.name || 'Abrir'}
                                </button>
                              ) : req.romaneioAnexo?.name ? (
                                <div className="text-[11px] text-zinc-500">
                                  Romaneio: {req.romaneioAnexo.name}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => abrirConclusaoSolicitacao(req)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition ${
                                  req.status === 'CONCLUIDO'
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                                    : 'bg-zinc-900 text-zinc-200 border-white/10 hover:border-emerald-500/40 hover:text-emerald-200'
                                }`}
                                disabled={req.status === 'CONCLUIDO'}
                              >
                                {req.status === 'CONCLUIDO' ? 'Concluido' : 'Marcar concluido'}
                              </button>
                              <span
                                className={`text-[10px] px-2 py-1 rounded-full border ${
                                  req.status === 'PRONTO'
                                    ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                                    : req.status === 'RETIRADA' || req.status === 'CONCLUIDO'
                                    ? 'border-sky-500/30 text-sky-300 bg-sky-500/10'
                                    : 'border-amber-500/30 text-amber-300 bg-amber-500/10'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    )}

                    {mostrarProntosComercial && (
                    <div className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Pedidos prontos (hoje/amanha)</h3>
                        <span className="text-[11px] text-zinc-500">{pedidosComercialProntos.length}</span>
                      </div>
                      <div className="divide-y divide-white/5 max-h-44 overflow-y-auto">
                        {pedidosComercialProntos.length === 0 && (
                          <div className="px-4 py-3 text-zinc-500 text-sm">Nenhum pedido pronto.</div>
                        )}
                        {pedidosComercialProntos.slice(0, 4).map((p) => (
                          <div key={p.sysId || p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm text-zinc-100">{p.cliente}</div>
                              <div className="text-[11px] text-zinc-500">#{p.requisicao || p.id}</div>
                            </div>
                        </div>
                      ))}
                      </div>
                    </div>
                    )}
                  </aside>
                  )}
                </div>
                )}

                {comercialVisao === 'estoque' && (
                  <div className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
                    <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <Package className="text-sky-400" size={18} />
                          Gestao de estoque
                        </h2>
                        <p className="text-sm text-zinc-500">Controle de niveis e movimentacoes</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-white/5">
                          <button
                            type="button"
                            onClick={() => setFiltroEstoque('todos')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroEstoque === 'todos' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setFiltroEstoque('critico')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${filtroEstoque === 'critico' ? 'bg-red-500/10 text-red-400 shadow-sm border border-red-500/10' : 'text-zinc-400 hover:text-white'}`}
                          >
                            <AlertCircle size={12} />
                            Criticos
                          </button>
                          {estoqueComercialHasTelhas && (
                            <button
                              type="button"
                              onClick={() => setFiltroEstoque('telhas')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroEstoque === 'telhas' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                            >
                              Telhas
                            </button>
                          )}
                          {estoqueComercialHasPerfis && (
                            <button
                              type="button"
                              onClick={() => setFiltroEstoque('perfis')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroEstoque === 'perfis' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                            >
                              Perfis
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadEstoqueExcel}
                          className="px-3 py-2 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-2"
                        >
                          <Download size={14} />
                          Baixar Excel
                        </button>
                        <button
                          type="button"
                          onClick={() => setMostrarZeradosEstoque((prev) => !prev)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                            mostrarZeradosEstoque
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                              : 'bg-zinc-900 border-white/10 text-zinc-300 hover:text-white'
                          }`}
                        >
                          {mostrarZeradosEstoque ? 'Ocultar zerados' : 'Mostrar zerados'}
                        </button>
                        {canManageEstoque && (
                          <>
                            <button
                              type="button"
                              onClick={abrirAjusteEstoqueNovo}
                              className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              + Adicionar estoque
                            </button>
                            <button
                              type="button"
                              onClick={abrirAjusteEstoqueInventario}
                              className="px-3 py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white"
                            >
                              Ajustar estoque
                            </button>
                            <button
                              type="button"
                              onClick={zerarEstoqueDireto}
                              disabled={estoqueResetando}
                              className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
                            >
                              {estoqueResetando ? 'Zerando...' : 'Zerar estoque'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-zinc-950/30 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-white/5">
                          <tr>
                            <th className="px-5 py-3">Produto</th>
                            <th className="px-5 py-3">Disponibilidade visual</th>
                            <th className="px-5 py-3">Qtd atual</th>
                            <th className="px-5 py-3">Demanda diaria</th>
                            <th className="px-5 py-3">Estoque maximo</th>
                            {canManageEstoque && (
                              <th className="px-5 py-3">Aviso producao</th>
                            )}
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">
                              {canManageEstoque ? 'Acoes' : 'Solicitar'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {estoqueFiltradoComercial.map((item) => {
                            const estudo = estoqueEstudo[item.cod] || {};
                            const status = getStockStatusComercial(item, estudo);
                            const demandaBase = Number(estudo.demandaDiaria || 0);
                            const estoqueMaxBase = Number(estudo.estoqueMaximo || 0);
                            const saldoQtd = Number(item.saldoQtd || 0);
                            const saldoKg = Number(item.saldoKg || 0);
                            const pesoUnit = Number(item.pesoUnit || 0);
                            const unidade = String(estudo.unidade || 'kg').toLowerCase();
                            const usaConversaoKg = unidade === 'pc' && pesoUnit;
                            const demandaUn = demandaBase;
                            const estoqueMaxUn = estoqueMaxBase;
                            const maxBase = estoqueMaxUn && estoqueMaxUn > 0 ? estoqueMaxUn : 5000;
                            const percent = Math.min(
                              100,
                              Math.max(0, (saldoQtd / maxBase) * 100)
                            );
                            const faltaReposicao =
                              estoqueMaxUn && estoqueMaxUn > 0
                                ? Math.max(0, estoqueMaxUn - saldoQtd)
                                : 0;
                            const coberturaDias = demandaUn ? saldoQtd / demandaUn : null;
                            const sugestaoAberta = estoqueSugestaoCod === item.cod;
                            const colSpan = canManageEstoque ? 8 : 7;
                            const toggleSugestao = () => {
                              setEstoqueSugestaoCod((prev) =>
                                prev === item.cod ? null : item.cod
                              );
                            };
                            const capacidadeDia = Number(capacidadeDiaria || 0);
                            const aviso =
                              estoqueMaxUn && capacidadeDia
                                ? faltaReposicao <= 0
                                  ? { label: 'OK', tone: 'text-emerald-300' }
                                  : (() => {
                                      const dias = Math.ceil(faltaReposicao / capacidadeDia);
                                      const tone =
                                        dias >= 3
                                          ? 'text-red-300'
                                          : dias >= 2
                                          ? 'text-amber-300'
                                          : 'text-emerald-300';
                                      return {
                                        label: `Repor ${Math.round(faltaReposicao)} un (~${dias}d)`,
                                        tone,
                                      };
                                    })()
                                : { label: '--', tone: 'text-zinc-500' };
                            return (
                              <>
                                <tr className="group hover:bg-white/[0.02] transition-colors border-b border-white/5">
                                  <td className="px-5 py-4">
                                    <div className="flex items-start gap-3">
                                      <div>
                                        <div className="text-sm font-semibold text-white">
                                          {item.cod} - {item.desc}
                                        </div>
                                        <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2">
                                          <span>{getEstoqueGrupoLabel(item)}</span>
                                          {estudo.maquina && (
                                            <>
                                              <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                              <span>{estudo.maquina}</span>
                                            </>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={toggleSugestao}
                                          className="mt-2 text-[11px] text-emerald-300 hover:text-emerald-200 font-medium"
                                        >
                                          {sugestaoAberta ? 'Ocultar sugestoes' : 'Ver sugestoes'}
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                <td className="px-5 py-4 w-52">
                                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
                                    <span className="uppercase tracking-wide">Nivel</span>
                                    <span className="font-mono text-white">{percent.toFixed(0)}%</span>
                                  </div>
                                  <div className="relative h-3 w-full rounded-full bg-zinc-900 border border-white/10 overflow-hidden shadow-inner">
                                    <div className={`absolute inset-y-0 left-0 ${status.bg} rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} />
                                    <div className="absolute inset-y-0 right-0 w-px bg-white/15" />
                                  </div>
                                  <div className="mt-1 text-[10px] text-zinc-500">Base un</div>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="text-sm font-bold text-white tabular-nums">
                                    {Number(item.saldoKg || 0).toFixed(1)} kg
                                  </div>
                                  <div className="text-[10px] text-zinc-500">
                                    {Number(item.saldoQtd || 0).toLocaleString()} un
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="text-sm font-medium text-zinc-100 tabular-nums">
                                    {demandaUn ? Math.round(demandaUn).toLocaleString() : '--'}
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="text-sm font-medium text-zinc-100 tabular-nums">
                                    {estoqueMaxUn ? Math.round(estoqueMaxUn).toLocaleString() : '--'}
                                  </div>
                                </td>
                                {canManageEstoque && (
                                  <td className="px-5 py-4">
                                    <div className={`text-xs font-medium ${aviso.tone}`}>{aviso.label}</div>
                                  </td>
                                )}
                                <td className="px-5 py-4">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${status.text} ${status.border} ${status.bgSoft}`}>
                                    {status.label}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-right">
                                  {canManageEstoque ? (
                                    <div className="flex flex-wrap justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => abrirAjusteEstoqueEdicao(item)}
                                        className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg border border-white/5 transition-colors"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => excluirItemEstoque(item)}
                                        className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors"
                                      >
                                        Excluir
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => abrirMovimentacaoEstoque(item)}
                                        className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg border border-white/5 transition-colors flex items-center gap-2"
                                      >
                                        <ArrowRightLeft size={12} /> Solicitar
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => abrirMovimentacaoEstoque(item)}
                                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg border border-white/5 transition-colors flex items-center gap-2 ml-auto"
                                    >
                                      <ArrowRightLeft size={12} /> Solicitar
                                    </button>
                                  )}
                                </td>
                                </tr>
                                {sugestaoAberta && (
                                  <tr className="bg-zinc-950/40 border-b border-white/5">
                                    <td colSpan={colSpan} className="px-5 py-4">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-zinc-300">
                                        <div className="p-3 rounded-xl bg-zinc-900/70 border border-white/5">
                                          <div className="text-xs uppercase text-zinc-500">Sugestao</div>
                                          <div className="mt-1 text-white font-semibold">
                                            {faltaReposicao > 0
                                              ? `Repor ${Math.round(faltaReposicao)} un`
                                              : 'Estoque dentro do limite'}
                                          </div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-zinc-900/70 border border-white/5">
                                          <div className="text-xs uppercase text-zinc-500">Cobertura</div>
                                          <div className="mt-1 text-white font-semibold">
                                            {coberturaDias != null
                                              ? `${coberturaDias.toFixed(1)} dias`
                                              : 'Sem demanda'}
                                          </div>
                                          <div className="text-[11px] text-zinc-500">
                                            Demanda: {demandaUn ? Math.round(demandaUn) : '--'} un/dia
                                          </div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-zinc-900/70 border border-white/5">
                                          <div className="text-xs uppercase text-zinc-500">Limites</div>
                                          <div className="mt-1 text-white font-semibold">
                                            Max: {estoqueMaxUn ? Math.round(estoqueMaxUn) : '--'} un
                                          </div>
                                          <div className="text-[11px] text-zinc-500">
                                            Saldo: {saldoQtd.toLocaleString()} un
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })}
                          {estoqueFiltradoComercial.length === 0 && (
                            <tr>
                              <td colSpan={canManageEstoque ? 8 : 7} className="py-20 text-center text-zinc-500">
                                <Box size={40} className="mx-auto mb-3 opacity-20" />
                                Nenhum item encontrado com este filtro.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {comercialVisao === 'pedidos' && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Pedidos em aberto</h3>
                        <span className="text-[11px] text-zinc-500">{pedidosComercialAbertos.length} pedidos</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {pedidosComercialAbertos.length === 0 && (
                          <div className="px-5 py-4 text-zinc-500 text-sm">Nenhum pedido em aberto.</div>
                        )}
                        {pedidosComercialAbertos.map((p) => {
                          const chave = p.sysId || p.id;
                          const itensAbertos = Boolean(comercialItensAbertos[chave]);
                          const itens = Array.isArray(p.itens) ? p.itens : [];
                          const tipoPedido =
                            String(p?.status || '').toUpperCase().trim() ===
                              'TRANSFERENCIA SOLICITADA' ||
                            String(p?.tipo || '').toUpperCase().trim() === 'TRANSF'
                              ? 'Transferencia'
                              : 'Producao';
                          return (
                            <div key={chave} className="px-5 py-4 flex flex-col gap-3">
                              <div>
                                <div className="text-white font-semibold">{p.cliente}</div>
                                <div className="text-[11px] text-zinc-500">#{p.requisicao || p.id} | {p.itens?.length || 0} itens</div>
                                <div className="mt-1 inline-flex items-center gap-2">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-500/30 text-sky-300 bg-sky-500/10">
                                    {tipoPedido}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                                <button
                                  type="button"
                                  onClick={() => abrirModalTransferenciaPedido(p)}
                                  className="px-3 py-2 rounded bg-amber-500/90 text-black text-xs font-bold hover:bg-amber-500"
                                >
                                  Transferir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleItensComercial(chave)}
                                  className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
                                >
                                  Itens
                                </button>
                                <button
                                  type="button"
                                  onClick={handlePrint}
                                  className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
                                >
                                  Imprimir
                                </button>
                              </div>
                              {itensAbertos && (
                                <div className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-zinc-200">
                                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Itens</div>
                                  <div className="mt-2 grid gap-2">
                                    {itens.length === 0 ? (
                                      <div className="text-sm text-zinc-500">Sem itens.</div>
                                    ) : (
                                      itens.map((item, idx) => (
                                        <div key={`${chave}-pedido-list-item-${idx}`} className="flex flex-wrap items-center gap-3">
                                          <span className="font-semibold text-white">{item.cod || '-'}</span>
                                          <span className="text-zinc-300">{item.desc || 'Item'}</span>
                                          <span className="text-zinc-400">{Number(item.qtd || 0)} un</span>
                                          <span className="text-zinc-400">{Number(item.comp || 0)} m</span>
                                          <span className="text-zinc-400">{Number(item.pesoTotal || 0)} kg</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Solicitacoes</h3>
                        <span className="text-[11px] text-zinc-500">{solicitacoesComercial.length}</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {solicitacoesComercial.length === 0 && (
                          <div className="px-5 py-4 text-zinc-500 text-sm">Sem solicitacoes recentes.</div>
                        )}
                        {solicitacoesComercial.map((req) => (
                          <div key={req.sysId || req.id} className="px-5 py-4 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs text-zinc-500 uppercase">{req.tipo || 'Pedido'}</div>
                              <div className="text-sm text-zinc-100">{req.cliente}</div>
                              <div className="text-[11px] text-zinc-500">{req.itens?.[0]?.desc || 'Item'}</div>
                              {req.romaneioAnexo?.url || req.romaneioAnexo?.localData ? (
                                <button
                                  type="button"
                                  onClick={() => abrirRomaneioAnexo(req.romaneioAnexo)}
                                  className="text-[11px] text-sky-400 hover:text-sky-300"
                                >
                                  Romaneio: {req.romaneioAnexo.name || 'Abrir'}
                                </button>
                              ) : req.romaneioAnexo?.name ? (
                                <div className="text-[11px] text-zinc-500">
                                  Romaneio: {req.romaneioAnexo.name}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => abrirConclusaoSolicitacao(req)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition ${
                                  req.status === 'CONCLUIDO'
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                                    : 'bg-zinc-900 text-zinc-200 border-white/10 hover:border-emerald-500/40 hover:text-emerald-200'
                                }`}
                                disabled={req.status === 'CONCLUIDO'}
                              >
                                {req.status === 'CONCLUIDO' ? 'Concluido' : 'Marcar concluido'}
                              </button>
                              <span
                                className={`text-[10px] px-2 py-1 rounded-full border ${
                                  req.status === 'PRONTO'
                                    ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                                    : req.status === 'RETIRADA' || req.status === 'CONCLUIDO'
                                    ? 'border-sky-500/30 text-sky-300 bg-sky-500/10'
                                    : 'border-amber-500/30 text-amber-300 bg-amber-500/10'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {comercialVisao === 'prontos' && (
                  <div className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Pedidos prontos (hoje/amanha)</h3>
                      <span className="text-[11px] text-zinc-500">{pedidosComercialProntos.length}</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {pedidosComercialProntos.length === 0 && (
                        <div className="px-5 py-4 text-zinc-500 text-sm">Nenhum pedido pronto.</div>
                      )}
                      {pedidosComercialProntos.map((p) => (
                        <div key={p.sysId || p.id} className="px-5 py-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm text-zinc-100">{p.cliente}</div>
                            <div className="text-[11px] text-zinc-500">#{p.requisicao || p.id}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>


              {mostrarSolicitarProducao && (
                <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-5xl overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-lg font-bold text-white">Nova solicitacao de producao</h3>
                      <button
                        type="button"
                        onClick={() => setMostrarSolicitarProducao(false)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-6 space-y-6 overflow-y-auto flex-1">
                      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-6">
                        <div className="space-y-4">
                          <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Dados do solicitante</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400">Cliente</label>
                                <input
                                  value={formPedidoCliente}
                                  onChange={(e) => setFormPedidoCliente(e.target.value)}
                                  className="w-full bg-zinc-950/80 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                  placeholder="Nome do cliente"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400">Solicitante</label>
                                <input
                                  value={formPedidoSolicitante}
                                  onChange={(e) => setFormPedidoSolicitante(e.target.value)}
                                  className="w-full bg-zinc-950/80 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                  placeholder="Nome do solicitante"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Detalhes do pedido</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400">Requisicao</label>
                                <input
                                  value={formPedidoRequisicao}
                                  onChange={(e) => setFormPedidoRequisicao(e.target.value)}
                                  className="w-full bg-zinc-950/80 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                  placeholder="REQ / Pedido"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400">Observacao</label>
                                <input
                                  value={formPedidoObs}
                                  onChange={(e) => setFormPedidoObs(e.target.value)}
                                  className="w-full bg-zinc-950/80 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                  placeholder="Ex: urgente"
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <label className="text-[11px] text-zinc-400">Romaneio (PDF)</label>
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  onChange={handleUploadPedidoRomaneio}
                                  className="w-full text-xs text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:font-bold file:text-zinc-100 hover:file:bg-zinc-700"
                                />
                                {formPedidoRomaneioParsing && (
                                  <div className="text-xs text-zinc-400">Lendo PDF...</div>
                                )}
                                {formPedidoRomaneioErro && (
                                  <div className="text-xs text-red-400">{formPedidoRomaneioErro}</div>
                                )}
                                {formPedidoRomaneioFile && itensPedidoComercial.length > 0 && (
                                  <div className="text-xs text-zinc-400">
                                    Itens importados: {itensPedidoComercial.length}
                                  </div>
                                )}
                                {formPedidoRomaneioFile && (
                                  <div className="flex items-center justify-between text-xs text-zinc-400">
                                    <span className="truncate">{formPedidoRomaneioFile.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormPedidoRomaneioFile(null);
                                        setFormPedidoRomaneioParsing(false);
                                        setFormPedidoRomaneioErro('');
                                        setItensPedidoComercial([]);
                                      }}
                                      className="text-zinc-500 hover:text-zinc-200"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Itens do pedido</div>
                            <select
                              value={formPedidoCod}
                              onChange={handleSelectProdutoPedidoComercial}
                              className="w-full bg-zinc-950/80 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                            >
                              <option value="">Manual...</option>
                              {CATALOGO_PRODUTOS.filter((p) => p.grupo === 'GRUPO_TELHAS').map((p) => (
                                <option key={p.cod} value={p.cod}>
                                  {p.cod} - {p.desc}
                                </option>
                              ))}
                            </select>
                            <input
                              value={formPedidoDesc}
                              onChange={(e) => setFormPedidoDesc(e.target.value)}
                              className="w-full bg-zinc-950/80 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                              placeholder="Descricao"
                            />
                            {saldoPedidoComercialSelecionado !== null && (
                              <div className="text-xs text-zinc-400">
                                Saldo disponivel: {saldoPedidoComercialSelecionado.toLocaleString()}
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="number"
                                step="0.01"
                                value={formPedidoComp}
                                onChange={(e) => setFormPedidoComp(e.target.value)}
                                className="w-full bg-zinc-950/80 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                placeholder="Comp (m)"
                              />
                              <input
                                type="number"
                                value={formPedidoQtd}
                                onChange={(e) => setFormPedidoQtd(e.target.value)}
                                className="w-full bg-zinc-950/80 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                placeholder="Qtd"
                              />
                            </div>
                            {saldoPedidoComercialSelecionado !== null && (
                              <div className="text-xs text-zinc-400">
                                Saldo atual: {saldoPedidoComercialSelecionado.toLocaleString()}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={adicionarItemPedidoComercial}
                              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold"
                            >
                              Adicionar item
                            </button>
                          </div>

                          <div className="bg-zinc-950 rounded-xl border border-white/10 overflow-hidden">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-white/5 text-xs text-zinc-500">
                                <tr>
                                  <th className="p-3">Item</th>
                                  <th className="p-3 text-center">Qtd</th>
                                  <th className="p-3 text-right">Peso</th>
                                  <th className="p-3 text-right">#</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {itensPedidoComercial.map((i) => (
                                  <tr key={i.tempId}>
                                    <td className="p-3 text-zinc-300">
                                      <div className="font-semibold">{i.desc}</div>
                                      <div className="text-[10px] text-zinc-500">{i.cod}</div>
                                    </td>
                                    <td className="p-3 text-center text-white">{i.qtd}</td>
                                    <td className="p-3 text-right text-zinc-300">{i.pesoTotal}</td>
                                    <td className="p-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => removerItemPedidoComercial(i.tempId)}
                                        className="text-zinc-500 hover:text-red-400"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {itensPedidoComercial.length === 0 && (
                                  <tr>
                                    <td className="p-3 text-zinc-500" colSpan={4}>
                                      Nenhum item adicionado.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setMostrarSolicitarProducao(false)}
                        className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={salvarPedidoComercial}
                        disabled={formPedidoRomaneioUploading}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {formPedidoRomaneioUploading ? 'Enviando...' : 'Enviar pedido'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              

              {mostrarConclusaoSolicitacao && (
                <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-lg font-bold text-white">Concluir solicitacao</h3>
                      <button
                        type="button"
                        onClick={() => setMostrarConclusaoSolicitacao(false)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Concluido por</label>
                        <input
                          value={conclusaoSolicitacaoPor}
                          onChange={(e) => setConclusaoSolicitacaoPor(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                          placeholder="Nome de quem concluiu"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Observacao</label>
                        <input
                          value={conclusaoSolicitacaoObs}
                          onChange={(e) => setConclusaoSolicitacaoObs(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                          placeholder="Detalhes da conclusao (opcional)"
                        />
                      </div>
                    </div>
                    <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setMostrarConclusaoSolicitacao(false)}
                        className="px-4 py-2 text-sm text-zinc-300 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={confirmarConclusaoSolicitacao}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded"
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {mostrarTransferenciaEstoque && (
                <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-lg font-bold text-white">Movimentar estoque</h3>
                      <button
                        type="button"
                        onClick={() => setMostrarTransferenciaEstoque(false)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Destino / Cliente</label>
                        <input
                          value={formTransfCliente}
                          onChange={(e) => setFormTransfCliente(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                          placeholder="Ex: Expedição / Cliente"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Produto</label>
                        <select
                          value={formTransfCod}
                          onChange={handleSelectTransfProduto}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                        >
                          <option value="">Selecionar produto...</option>
                          {estoqueComercialBase.map((p) => (
                            <option key={p.cod} value={p.cod}>
                              {p.cod} - {p.desc}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-zinc-400">Qtd</label>
                          <input
                            type="number"
                            value={formTransfQtd}
                            onChange={(e) => setFormTransfQtd(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                            placeholder="Qtd"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-zinc-400">Comp (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formTransfComp}
                            onChange={(e) => setFormTransfComp(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                            placeholder="Comp"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Observacao</label>
                        <input
                          value={formTransfObs}
                          onChange={(e) => setFormTransfObs(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                          placeholder="Ex: urgente"
                        />
                      </div>
                    </div>
                    <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setMostrarTransferenciaEstoque(false)}
                        className="px-4 py-2 text-sm text-zinc-300 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={solicitarTransferenciaEstoque}
                        className="px-4 py-2 bg-amber-500/90 hover:bg-amber-500 text-black text-sm font-bold rounded"
                      >
                        Enviar solicitacao
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {canManageEstoque && mostrarAjusteEstoque && (
                <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-lg font-bold text-white">
                        {ajusteEstoqueModo === 'editar'
                          ? ajusteEstoqueLockProduto
                            ? 'Editar estoque'
                            : 'Ajustar estoque'
                          : 'Adicionar estoque'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setMostrarAjusteEstoque(false)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Produto</label>
                        <select
                          value={ajusteEstoqueCod}
                          onChange={handleSelectAjusteEstoqueProduto}
                          disabled={ajusteEstoqueModo === 'editar' && ajusteEstoqueLockProduto}
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm disabled:opacity-60"
                        >
                          <option value="">Selecionar telha...</option>
                          {CATALOGO_PRODUTOS.filter((p) => p.grupo === 'GRUPO_TELHAS').map((p) => (
                            <option key={p.cod} value={p.cod}>
                              {p.cod} - {p.desc}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-zinc-400">
                            {ajusteEstoqueModo === 'editar' ? 'Novo saldo (qtd)' : 'Quantidade'}
                          </label>
                          <input
                            type="number"
                            value={ajusteEstoqueQtd}
                            onChange={(e) => setAjusteEstoqueQtd(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-zinc-400">Comp (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={ajusteEstoqueComp}
                            onChange={(e) => setAjusteEstoqueComp(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      {ajusteEstoqueModo === 'editar' && (
                        <div className="text-xs text-zinc-500">
                          Saldo atual: {Number(ajusteEstoqueSaldoAtual || 0).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setMostrarAjusteEstoque(false)}
                        className="px-4 py-2 text-sm text-zinc-300 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={aplicarAjusteEstoque}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded"
                      >
                        {ajusteEstoqueModo === 'editar' ? 'Salvar ajuste' : 'Adicionar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {transferModalAberto && (
                <div className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                      <div>
                        <h3 className="text-lg font-bold text-white">Solicitar transferencia</h3>
                        <div className="text-xs text-zinc-500">
                          #{transferPedidoSelecionado?.requisicao || transferPedidoSelecionado?.id} · {transferPedidoSelecionado?.cliente}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTransferModalAberto(false)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-zinc-400">Destino / Cliente</label>
                          <input
                            value={transferDestino}
                            onChange={(e) => setTransferDestino(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                            placeholder="Ex: Expedição / Cliente"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-zinc-400">Observacao</label>
                          <input
                            value={transferObs}
                            onChange={(e) => setTransferObs(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm"
                            placeholder="Ex: urgente"
                          />
                        </div>
                      </div>

                      <div className="border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 text-xs text-zinc-500 bg-white/5 border-b border-white/10">
                          Itens para transferir
                        </div>
                        <div className="divide-y divide-white/5">
                          {transferItens.map((item, idx) => (
                            <div key={item.key} className="px-4 py-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm text-zinc-100 truncate">{item.desc || item.cod}</div>
                                <div className="text-[10px] text-zinc-500">Cod: {item.cod}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.qtd}
                                  onChange={(e) => {
                                    const valor = e.target.value;
                                    setTransferItens((prev) =>
                                      prev.map((p, i) =>
                                        i === idx ? { ...p, qtd: valor } : p
                                      )
                                    );
                                  }}
                                  className="w-24 bg-black/50 border border-white/10 rounded p-2 text-white text-sm text-right"
                                />
                                <span className="text-[11px] text-zinc-500">un</span>
                              </div>
                            </div>
                          ))}
                          {transferItens.length === 0 && (
                            <div className="px-4 py-6 text-center text-xs text-zinc-500">
                              Nenhum item no pedido.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setTransferModalAberto(false)}
                        className="px-4 py-2 text-sm text-zinc-300 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={confirmarTransferenciaPedido}
                        className="px-4 py-2 bg-amber-500/90 hover:bg-amber-500 text-black text-sm font-bold rounded"
                      >
                        Confirmar transferencia
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA PRODUTOS */}
          {abaAtiva === 'produtos' && (
            <div className="flex-1 bg-[#09090b] p-4 md:p-8 overflow-y-auto">
              <h1 className="text-2xl font-bold mb-8 text-white">Catálogo</h1>
              <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[300px]">
                  <thead><tr className="bg-black/40 text-zinc-400 text-xs border-b border-white/10"><th className="p-4">Código</th><th className="p-4">Descrição</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {CATALOGO_PRODUTOS && CATALOGO_PRODUTOS.map((p) => (<tr key={p.cod}><td className="p-4 text-emerald-400 font-mono">{p.cod}</td><td className="p-4 text-white">{p.desc}</td></tr>))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL ORDEM --- */}
      {showModalNovaOrdem && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl w-full md:max-w-4xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-lg md:text-xl font-bold text-white">{romaneioEmEdicaoId ? 'Editar Romaneio' : 'Novo Romaneio'}</h3>
              <button onClick={() => setShowModalNovaOrdem(false)} className="text-zinc-400 hover:text-white"><X /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Romaneio</div>
                      {romaneioEmEdicao?.romaneioAnexo?.url ||
                      romaneioEmEdicao?.romaneioAnexo?.localData ? (
                        <button
                          type="button"
                          onClick={() => abrirRomaneioAnexo(romaneioEmEdicao.romaneioAnexo)}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded text-sm w-fit"
                        >
                          Ver romaneio
                        </button>
                      ) : romaneioEmEdicao?.romaneioAnexo?.name ? (
                        <span className="text-xs text-zinc-400">
                          Romaneio: {romaneioEmEdicao.romaneioAnexo.name}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">Sem romaneio anexado.</span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Visualizacao do romaneio anexado a solicitacao.
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Itens do PDF</div>
                    <div className="text-[11px] text-zinc-500">
                      Importe o romaneio na tela anterior (Defina a maquina por item).
                    </div>
                  </div>
                  {pdfErro && (
                    <div className="text-xs text-red-400">{pdfErro}</div>
                  )}
                  {pdfInfoRomaneio && (
                    <div className="text-xs text-zinc-400">
                      Romaneio: <span className="text-white">{pdfInfoRomaneio.id || '-'}</span>
                      {' '}| Cliente: <span className="text-white">{pdfInfoRomaneio.cliente || '-'}</span>
                    </div>
                  )}
                  {pdfItensEncontrados.length === 0 ? (
                    <div className="text-xs text-zinc-500">Nenhum item importado.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-zinc-950 rounded-xl border border-white/10 overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-white/5 text-xs text-zinc-500">
                            <tr>
                              <th className="p-3 w-8 text-center">Sel</th>
                              <th className="p-3">Item</th>
                              <th className="text-center">Comp</th>
                              <th className="text-center">Qtd</th>
                              <th className="text-right">Peso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {pdfItensEncontrados.map((item) => (
                              <tr key={item.tempId}>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={pdfItensSelecionados.includes(item.tempId)}
                                    onChange={() => togglePdfItemSelecionado(item.tempId)}
                                    className="h-4 w-4 accent-emerald-500"
                                  />
                                </td>
                                <td className="p-3 text-zinc-300">
                                  <b>{item.desc}</b>
                                  <div className="text-[10px]">{item.cod}</div>
                                </td>
                                <td className="p-3 text-center">{item.comp}</td>
                                <td className="p-3 text-center font-bold text-white">{item.qtd}</td>
                                <td className="p-3 text-right">{item.pesoTotal}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="text-xs text-zinc-400">
                          {pdfItensSelecionados.length} item(ns) selecionado(s).
                        </div>
                        <button
                          type="button"
                          onClick={adicionarItensPdfSelecionados}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-40"
                          disabled={pdfItensSelecionados.length === 0}
                        >
                          Adicionar itens do PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                        <label className="text-xs font-bold text-blue-400 block mb-1">Romaneio</label>
                        <div className="flex gap-2">
                            <input value={formRomaneioId} onChange={(e) => setFormRomaneioId(e.target.value)} className="w-full bg-black/50 border border-blue-500/30 rounded p-2 text-white font-bold" readOnly={isEstoque} />
                            <button type="button" onClick={toggleEstoque} className="px-2 border rounded text-xs">{isEstoque ? 'EST' : 'PED'}</button>
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <label className="text-xs font-bold text-zinc-500 block mb-1">Data</label>
                        <input type="date" value={formDataProducao} onChange={(e) => setFormDataProducao(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white" />
                    </div>
                    <div className="md:col-span-4">
                        <label className="text-xs font-bold text-zinc-500 block mb-1">Cliente</label>
                        <input value={formCliente} onChange={(e) => setFormCliente(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white" readOnly={isEstoque} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-zinc-500 block mb-1">TOTVS</label>
                        <input
  value={formTotvs}
  onChange={(e) => setFormTotvs(e.target.value)}
  className="w-full bg-black/50 border border-white/10 rounded p-2 text-white"
/>

                    </div>
                </div>
                
                <div className="w-full h-px bg-white/10 my-2"></div>
                
                <div className="bg-zinc-800/30 p-4 rounded-xl border border-white/5 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1"><label className="text-[10px] font-bold text-zinc-500 block mb-1">Produto</label><select value={formCod} onChange={handleSelectProduto} className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-white text-sm"><option value="">Manual...</option>{CATALOGO_PRODUTOS.map((p) => <option key={p.cod} value={p.cod}>{p.cod} - {p.desc}</option>)}</select></div>
                        <div className="flex gap-4">
                            <div className="w-[100px]"><label className="text-[10px] font-bold text-zinc-500 block mb-1">Comp (m)</label><input type="number" step="0.01" value={formComp} onChange={(e) => setFormComp(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-white text-sm" /></div>
                            <div className="w-[80px]"><label className="text-[10px] font-bold text-zinc-500 block mb-1">Qtd</label><input type="number" value={formQtd} onChange={(e) => setFormQtd(e.target.value)} className="w-full bg-black border border-blue-500/50 rounded p-2 text-white text-sm text-right" /></div>
                        </div>
                    </div>
                    <div><label className="text-[10px] font-bold text-zinc-500 block mb-1">Descrição</label><input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-white text-sm" /></div>
                    <div className="flex justify-end"><button onClick={adicionarItemNaLista} className="px-6 py-2 bg-emerald-600 text-white rounded font-bold flex items-center gap-2"><PlusCircle size={18} /> Add</button></div>
                </div>

                {/* TABELA DE ITENS */}
<div className="bg-zinc-950 rounded-xl border border-white/10 overflow-hidden min-h-[100px]">
  <table className="w-full text-left text-sm">
    <thead className="bg-white/5 text-xs text-zinc-500">
      <tr>
        <th className="p-3 w-8 text-center">Sel</th> {/* NOVO */}
        <th className="p-3">Item</th>
        <th className="text-center">Qtd</th>
        <th className="text-right">Peso</th>
        <th className="text-right">#</th>
      </tr>
    </thead>

    <tbody className="divide-y divide-white/5">
      {itensNoPedido.map((i) => (
        <tr key={i.tempId}>
          {/* checkbox */}
          <td className="p-3 text-center">
            <input
              type="checkbox"
              checked={selectedItemIds.includes(i.tempId)}
              onChange={() => toggleItemSelecionado(i.tempId)}
              className="h-4 w-4 accent-emerald-500"
            />
          </td>

          <td className="p-3 text-zinc-300">
            <b>{i.desc}</b>
            <div className="text-[10px]">{i.cod}</div>
          </td>

          <td className="p-3 text-center font-bold text-white">
            {i.qtd}
          </td>

          <td className="p-3 text-right">{i.pesoTotal}</td>

          <td className="p-3 text-right">
            <button
              onClick={() => removerItemDaLista(i.tempId)}
              className="text-zinc-500 hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>


{/* Barra de reprogramação de itens selecionados */}
<div className="mt-3 flex flex-col md:flex-row items-center justify-between gap-3 bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3">
  <div className="text-xs text-zinc-400">
    {selectedItemIds.length === 0 ? (
      <span>Nenhum item selecionado.</span>
    ) : (
      <span>
        <b>{selectedItemIds.length}</b> item(ns) selecionado(s) para reprogramar.
      </span>
    )}
  </div>

  <div className="flex items-center gap-3">
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-zinc-400 font-semibold">Nova data:</span>
      <input
        type="date"
        value={novaDataReprogramacao}
        onChange={(e) => setNovaDataReprogramacao(e.target.value)}
        className="bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white"
      />
    </div>

    <button
      type="button"
      onClick={handleReprogramarItensSelecionados}
      className="px-4 py-2 bg-amber-500/90 hover:bg-amber-500 text-black text-xs font-bold rounded-lg flex items-center gap-2 disabled:opacity-40"
      disabled={selectedItemIds.length === 0 || !novaDataReprogramacao}
    >
      Reprogramar selecionados
    </button>
  </div>
</div>

            </div>

            <div className="p-4 md:p-6 border-t border-white/10 bg-white/5 flex gap-3 justify-end">
                <button onClick={() => setShowModalNovaOrdem(false)} className="px-6 py-3 bg-zinc-800 text-white rounded-lg font-bold border border-white/10">Cancelar</button>
                <button
                  type="button"
                  onClick={finalizarOrdemProgramada}
                  disabled={itensNoPedido.length === 0}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold disabled:opacity-40"
                >
                  Finalizar ordem
                </button>
                <button onClick={salvarRomaneio} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"><ArrowRight size={20} /> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL SELEÇÃO DE MÁQUINA --- */}
      {showModalSelecaoMaquina && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <h3 className="text-lg font-bold text-white">Defina a maquina por item</h3>
              <button
                onClick={() => setShowModalSelecaoMaquina(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="bg-zinc-800/70 border border-white/10 rounded-xl px-4 py-3 space-y-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Importar PDF</div>
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm w-fit cursor-pointer disabled:opacity-50">
                      <Upload size={16} />
                      {pdfLoading ? 'Lendo PDF...' : 'Subir romaneio'}
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleUploadPdfRomaneio}
                        disabled={pdfLoading}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Leia o PDF antes de definir as maquinas.
                  </div>
                </div>
                {pdfErro && (
                  <div className="text-xs text-red-400">{pdfErro}</div>
                )}
                {pdfInfoRomaneio && (
                  <div className="text-xs text-zinc-400">
                    Romaneio: <span className="text-white">{pdfInfoRomaneio.id || '-'}</span>
                    {' '}| Itens: <span className="text-white">{pdfItensEncontrados.length}</span>
                  </div>
                )}
              </div>
              {pdfItensEncontrados.length === 0 ? (
                <div className="text-xs text-zinc-500">Nenhum item importado.</div>
              ) : (
                <div className="bg-zinc-950 rounded-xl border border-white/10 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-xs text-zinc-500">
                      <tr>
                        <th className="p-3">Item</th>
                        <th className="text-center">Comp</th>
                        <th className="text-center">Qtd</th>
                        <th className="text-center">Maquina</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pdfItensEncontrados.map((item) => (
                        <tr key={item.tempId}>
                          <td className="p-3 text-zinc-300">
                            <b>{item.desc}</b>
                            <div className="text-[10px]">{item.cod}</div>
                          </td>
                          <td className="p-3 text-center">{item.comp}</td>
                          <td className="p-3 text-center font-bold text-white">{item.qtd}</td>
                          <td className="p-3 text-center">
                            <select
                              value={pdfItensMaquina[item.tempId] || ''}
                              onChange={(e) => handlePdfItemMaquinaChange(item.tempId, e.target.value)}
                              className="bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="">Selecione...</option>
                              {CATALOGO_MAQUINAS.map((m) => (
                                <option key={m.maquinaId || m.id} value={m.maquinaId || m.id}>
                                  {m.nomeExibicao}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  {pdfItensEncontrados.length > 0 &&
                  pdfItensEncontrados.some((i) => !pdfItensMaquina[i.tempId])
                    ? 'Faltam maquinas em alguns itens.'
                    : 'Maquinas definidas.'}
                </div>
                <button
                  type="button"
                  onClick={criarOrdensPorMaquina}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-40"
                  disabled={
                    !pdfItensEncontrados.length ||
                    pdfItensEncontrados.some((i) => !pdfItensMaquina[i.tempId])
                  }
                >
                  Criar ordens
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 text-[12px] text-zinc-400">
              Defina a maquina de cada item e crie as ordens.
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL PARADA --- */}
      {showModalParada && (
  <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
    <div className="bg-zinc-900 rounded-2xl w-full max-w-lg border border-red-500/30 shadow-2xl flex flex-col p-6">
      <h3 className="text-xl font-bold text-red-400 mb-4">Apontar Parada</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="time"
            value={formParadaInicio}
            onChange={(e) => setFormParadaInicio(e.target.value)}
            className="bg-black border border-white/10 rounded p-2 text-white"
          />
          <input
            type="time"
            value={formParadaFim}
            onChange={(e) => setFormParadaFim(e.target.value)}
            className="bg-black border border-white/10 rounded p-2 text-white"
          />
        </div>

        {/* SELECT AJUSTADO COM CÓDIGO + MOTIVO */}
        <select
  value={formParadaMotivoCod}
  onChange={(e) => setFormParadaMotivoCod(e.target.value)}
  className="w-full bg-black border border-white/10 rounded p-2 text-white"
>
  <option value="">Motivo...</option>

  {dicionarioLocal
    .slice() // copia pra não mexer no array original
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))) // ordena pelo código
    .map((p) => (
      <option key={p.codigo} value={p.codigo}>
        {p.codigo} - {p.evento}
      </option>
    ))}
</select>

      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => setShowModalParada(false)}
          className="px-4 py-2 bg-zinc-800 text-white rounded"
        >
          Cancelar
        </button>
        <button
        onClick={salvarApontamentoProducao}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2"
      >
        <CheckCircle2 size={20} />
        {producaoEmEdicaoId ? 'Atualizar apontamento' : 'Confirmar'}
      </button>

      {producaoEmEdicaoId && (
        <button
          type="button"
          onClick={limparFormApontamentoProducao}
          className="mt-2 w-full bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-lg text-sm"
        >
          Cancelar edição
        </button>
      )}

      </div>
    </div>
  </div>
)}

    </>
  );
}
// -----------------------------------------------------------------------------
// COMPONENTES AUXILIARES
// -----------------------------------------------------------------------------

const CardIndicador = ({ label, valor, icon }) => (
  <div className="bg-zinc-900 p-4 rounded-xl border border-white/10 flex items-center gap-4">
    <div className="p-2 bg-zinc-950 rounded border border-white/5">
      {icon}
    </div>
    <div>
      <div className="text-zinc-500 text-[10px] uppercase font-bold">
        {label}
      </div>
      <div className="text-xl font-bold text-white">{valor}</div>
    </div>
  </div>
);


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

const BotaoMenu = ({ ativo, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-w-[64px] shrink-0 p-2 md:p-3 rounded-xl flex flex-col items-center gap-1 md:w-full ${
      ativo ? "bg-white/10 text-pink-500" : "text-zinc-500 hover:bg-white/5"
    }`}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase">{label}</span>
  </button>
);

// --- COMPONENTE DE TOOLTIP CUSTOMIZADO ---

