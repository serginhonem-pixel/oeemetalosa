import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { Fragment, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import { db } from "./services/firebase";
import dadosLocais from './backup-painelpcp.json'; // Nome do seu arquivo
import { IS_LOCALHOST, getDevCacheKey } from './utils/env';

import {
  Activity, AlertCircle, AlertOctagon, AlertTriangle, ArrowRight, ArrowRightLeft, BarChart3, Box,
  CalendarDays, CheckCircle2,
  ClipboardList,
  Download, Factory, FileText, History, Layers, Layout,
  Package, Pencil, Plus, PlusCircle, Scale, Search, Trash2,
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


GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const DEV_CACHE_KEY = getDevCacheKey();


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
  const m = String(texto).match(/(\d+[.,]\d+)\s*m/i);
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

  // Tenta interpretar cada linha individualmente, juntando com a próxima se for só a unidade
  for (let idx = 0; idx < linhas.length; idx++) {
    const raw = linhas[idx];
    let linha = raw.replace(/\s+/g, ' ').trim();
    if (!linha) continue;

    // ignora cabeçalhos e linhas de endereço/rodapé
    if (/^(IT\s+CÓD|PESO TOTAL|ENDEREÇO|OBSERVAÇÃO|ROMANEIO:)/i.test(linha)) continue;
    if (/^(Rod\.|Telefone:|e-mail:|Site:)/i.test(linha)) continue;
    if (/^(Cliente:|Vendedor:|Transportadora:|Redespacho:|CGC:|INS\. EST\.:|EMISSÃO:|DIGITADOR:)/i.test(linha)) continue;
    const upper = linha.toUpperCase();
    if (upper.includes('CLIENTE')) continue;
    if (upper.includes('TELEFONE')) continue;
    if (upper.includes('CGC')) continue;
    if (upper.includes('EMISSÃO')) continue;
    if (upper.includes('DIGITADOR')) continue;
    if (upper.includes('ROMANEIO')) continue;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(linha)) continue; // linha que é só data

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

    const comp = compDesc || produtoCatalogo?.comp || 0;
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

      const comp = compDesc || produtoCatalogo?.comp || 0;
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

  const idMatch = textoCompleto.match(/ROMANEIO:\s*([A-Z0-9]+)/i);
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
      .print-header { border: 1px solid #000; margin-bottom: 12px; }
      .print-brand { display: flex; justify-content: center; align-items: center; padding: 6px; border-bottom: 1px solid #000; }
      .print-logo { height: 36px; object-fit: contain; }
      .print-title { text-align: center; font-size: 14px; font-weight: bold; background: #c7def3 !important; border-bottom: 1px solid #000; padding: 6px; }
      .print-subtitle { text-align: center; font-size: 11px; font-weight: bold; border-bottom: 1px solid #000; padding: 6px; }
      .print-meta { display: grid; grid-template-columns: 90px 1fr 90px 1fr 120px; }
      .print-meta div { padding: 6px; border-right: 1px solid #000; border-top: 1px solid #000; text-align: center; font-size: 10px; }
      .print-meta div:nth-child(-n + 5) { border-top: none; }
      .print-meta div:last-child { border-right: none; font-weight: bold; }
      .print-table { width: 100%; border-collapse: collapse; }
      .print-table th { text-align: center; padding: 4px; font-size: 9px; text-transform: uppercase; border: 1px solid #000; background: #c7def3 !important; }
      .print-table td { padding: 4px; border: 1px solid #000; font-size: 9px; }
      .print-table td.left { text-align: left; }
      .print-table td.center { text-align: center; }
    }
  `}</style>
);



export default function App() {

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
  const [capacidadeDiaria, setCapacidadeDiaria] = useState(15000); 
  const [turnoHoras, setTurnoHoras] = useState(9);

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
  const [comercialVisao, setComercialVisao] = useState('visao');
  const [filtroEstoque, setFiltroEstoque] = useState('todos');
  const [mostrarSolicitarProducao, setMostrarSolicitarProducao] = useState(false);
  const [mostrarTransferenciaEstoque, setMostrarTransferenciaEstoque] = useState(false);
  const [comercialItensAbertos, setComercialItensAbertos] = useState({});
  const [transferModalAberto, setTransferModalAberto] = useState(false);
  const [transferPedidoSelecionado, setTransferPedidoSelecionado] = useState(null);
  const [transferDestino, setTransferDestino] = useState('');
  const [transferObs, setTransferObs] = useState('');
  const [transferItens, setTransferItens] = useState([]);

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
      if (IS_LOCALHOST) {
        setHistoricoProducaoReal((prev) => [{ id: `local-${Date.now()}`, ...obj }, ...prev]);
        resetFormEstoqueTelha();
        alert("Estoque apontado (modo local).");
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
    if (IS_LOCALHOST) {
      const editKey = romaneioEmEdicaoKey || romaneioEmEdicaoId;
      const sysIdAtual =
        romaneioEmEdicaoId ||
        (editKey && String(editKey).startsWith('LOCAL-') ? editKey : `LOCAL-${Date.now()}`);
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
          sysId: `LOCAL-${Date.now()}-R`,
        };
        comReprogramado = [...atualizada, objReprogramado];
      }

      setFilaProducao(comReprogramado);
      setItensReprogramados([]);
      setSelectedItemIds([]);
      setNovaDataReprogramacao("");
      alert("Romaneio salvo (modo local).");
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

  const limparPedidoComercial = () => {
    setFormPedidoCliente('');
    setFormPedidoRequisicao('');
    setFormPedidoObs('');
    setItensPedidoComercial([]);
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
      estoqueTelhas.map((item) => [String(item.cod), Number(item.saldoQtd || 0)])
    );
    const estoquePorDesc = new Map(
      estoqueTelhas.map((item) => [normalizeTexto(item.desc), Number(item.saldoQtd || 0)])
    );
    const qtdPorItem = new Map();
    itensPedidoComercial.forEach((item) => {
      const cod = String(item.cod || '').trim();
      const descKey = normalizeTexto(item.desc);
      const key = cod || (descKey ? `desc:${descKey}` : '');
      if (!key) return;
      const prev = qtdPorItem.get(key) || 0;
      qtdPorItem.set(key, prev + Number(item.qtd || 0));
    });
    const temEstoqueSuficiente = Array.from(qtdPorItem.entries()).every(
      ([key, qtd]) => {
        if (key.startsWith('desc:')) {
          const desc = key.slice(5);
          const saldo = estoquePorDesc.get(desc) ?? 0;
          return qtd <= saldo;
        }
        const saldo = estoquePorCod.get(key) ?? 0;
        return qtd <= saldo;
      }
    );

    const obj = temEstoqueSuficiente
      ? {
          id: idPedido,
          romaneioId: idPedido,
          data: "",
          dataProducao: "",
          cliente: formPedidoCliente.trim(),
          solicitante: formPedidoSolicitante.trim(),
          totvs: "",
          tipo: "TRANSF",
          status: "TRANSFERENCIA SOLICITADA",
          origem: "COMERCIAL",
          requisicao: requisicao || idPedido,
          observacao: formPedidoObs || "Estoque disponivel. Transferencia solicitada.",
          itens: itensPedidoComercial,
          transferenciaDestino: formPedidoCliente.trim(),
          transferenciaObs: formPedidoObs || "",
          transferenciaItens: itensPedidoComercial,
          transferenciaSolicitadaAt: agoraISO,
          createdAt: agoraISO,
          updatedAt: agoraISO,
        }
      : {
          id: idPedido,
          romaneioId: idPedido,
          data: "",
          dataProducao: "",
          cliente: formPedidoCliente.trim(),
          solicitante: formPedidoSolicitante.trim(),
          totvs: "",
          tipo: "REQ",
          status: "FALTA PROGRAMAR",
          origem: "COMERCIAL",
          requisicao: requisicao || idPedido,
          observacao: formPedidoObs || "",
          itens: itensPedidoComercial,
          createdAt: agoraISO,
          updatedAt: agoraISO,
        };

    try {
      if (IS_LOCALHOST) {
        setFilaProducao((prev) => [
          { ...obj, sysId: `LOCAL-${Date.now()}` },
          ...prev,
        ]);
        limparPedidoComercial();
        if (temEstoqueSuficiente) {
          alert("Estoque disponivel. Transferencia solicitada (modo local).");
        } else {
          alert("Sem estoque. Solicitacao enviada para programar (modo local).");
        }
        return;
      }

      const docRef = await addDoc(collection(db, "romaneios"), obj);
      setFilaProducao((prev) => [{ ...obj, sysId: docRef.id }, ...prev]);
      limparPedidoComercial();
      if (temEstoqueSuficiente) {
        alert("Estoque disponivel. Transferencia solicitada.");
      } else {
        alert("Sem estoque. Solicitacao enviada para programar.");
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

    const saldoItem = estoqueTelhas.find((p) => p.cod === formTransfCod);
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





const abrirModalNovo = () => { limparFormularioGeral(); setShowModalSelecaoMaquina(true); };
const abrirModalEdicao = (r) => {
    setPdfItensEncontrados([]);
    setPdfItensSelecionados([]);
    setPdfInfoRomaneio(null);
    setPdfErro('');

    setRomaneioEmEdicaoId(r.sysId || null); // id do doc no Firebase
    setRomaneioEmEdicaoKey(r.sysId || r.id || null);
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
    setPdfItensEncontrados([]);
    setPdfItensSelecionados([]);
    setPdfInfoRomaneio(null);
    setPdfErro('');
  };
  const abrirSelecaoMaquina = () => { limparFormularioGeral(); setShowModalSelecaoMaquina(true); };
  const handleEscolherMaquina = (id) => {
    setMaquinaSelecionada(id);
    setShowModalSelecaoMaquina(false);
    setShowModalNovaOrdem(true);
  };
const deletarRomaneio = async (romaneioId) => {
  const ok = window.confirm("Excluir esse romaneio?");
  if (!ok) return;

  const alvoId = String(romaneioId || "");
  setFilaProducao((prev) =>
    prev.filter((r) => String(r.sysId || r.id) !== alvoId)
  );

  if (IS_LOCALHOST || !alvoId) return;

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

  // exige máquina
  if (!maquinaId) {
    alert("Selecione uma máquina antes de importar a produção.");
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

            // ✅ máquina vem do filtro selecionado na tela
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

  const estoqueTelhas = useMemo(() => {
    const telhas = (CATALOGO_PRODUTOS || []).filter(
      (p) => p.grupo === "GRUPO_TELHAS"
    );

    const producaoEstoque = historicoProducaoReal.filter((item) =>
      String(item?.destino || "").toLowerCase().includes("estoque")
    );
    const base = producaoEstoque.length > 0 ? producaoEstoque : historicoProducaoReal;

    const saldoPorCod = {};
    const saldoKgPorCod = {};

    base.forEach((item) => {
      if (!item?.cod) return;
      const qtd = Number(item.qtd || 0);
      const peso = Number(item.pesoTotal || 0);
      saldoPorCod[item.cod] = (saldoPorCod[item.cod] || 0) + qtd;
      saldoKgPorCod[item.cod] = (saldoKgPorCod[item.cod] || 0) + peso;
    });

    return telhas
      .map((p) => ({
        ...p,
        saldoQtd: saldoPorCod[p.cod] || 0,
        saldoKg: saldoKgPorCod[p.cod] || 0,
      }))
      .filter((p) => (p.saldoQtd || 0) !== 0 || (p.saldoKg || 0) !== 0)
      .sort((a, b) => String(a.cod).localeCompare(String(b.cod)));
  }, [historicoProducaoReal]);

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
    if (!termo) return estoqueTelhas;
    return estoqueTelhas.filter((item) => {
      const cod = String(item.cod || '').toLowerCase();
      const desc = String(item.desc || '').toLowerCase();
      return cod.includes(termo) || desc.includes(termo);
    });
  }, [estoqueTelhas, comercialEstoqueBusca]);

  const estoqueFiltradoComercial = useMemo(() => {
    let lista = [...estoqueTelhas];
    if (filtroEstoque === 'critico') {
      lista = lista.filter((item) => Number(item.saldoQtd || 0) <= 500);
    }
    if (filtroEstoque === 'telhas') {
      lista = lista.filter((item) => item.grupo === 'GRUPO_TELHAS');
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
  }, [estoqueTelhas, filtroEstoque, comercialVisao, comercialBusca]);

  const estoqueCriticoComercial = useMemo(
    () => estoqueTelhas.filter((item) => Number(item.saldoQtd || 0) <= 500).slice(0, 4),
    [estoqueTelhas]
  );

  const getStockStatusComercial = (item) => {
    const saldo = Number(item.saldoQtd || 0);
    if (saldo <= 500) {
      return {
        label: 'Critico',
        text: 'text-red-400',
        bg: 'bg-red-500',
        border: 'border-red-500/20',
        bgSoft: 'bg-red-500/10',
      };
    }
    if (saldo <= 1500) {
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


  const calcResumo = (lista) => ({ itens: lista.reduce((a,r)=>a+r.itens.length,0), peso: lista.reduce((a,r)=>a+r.itens.reduce((s,i)=>s+parseFloat(i.pesoTotal||0),0),0) });

  // --- DASHBOARD E OEE ---
  // --- DASHBOARD E OEE (Lógica Atualizada) ---
  // --- DASHBOARD E OEE (Lógica Atualizada com Filtros) ---
  // --- SUBSTITUA O SEU 'const dadosIndicadores' ATUAL POR ESTE INTEIRO ---
  const dadosIndicadores = useMemo(() => {
  const agrupadoPorDia = {};

  // ========= helpers =========
  const toISO = (d) => new Date(d).toISOString().split("T")[0];

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

  // ========= 3) executado no período + filtro por máquina =========
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






// --- Helper: evento de tempo útil (máquina rodando) -----------------
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

    // Convenção: códigos que começam com "TU" = máquina rodando
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
        // TU = máquina rodando
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

  const itensParaImpressao = romaneiosParaImpressao.flatMap((r) =>
    (r.itens || []).map((item, idx) => ({
      key: `${r.sysId || r.id || 'rom'}-${item.tempId || idx}`,
      cod: item.cod || '',
      desc: formatarDescricaoImpressao(item),
      romaneioId: getRomaneioLabel(r),
      destino: r.destino || r.transferenciaDestino || r.cliente || 'ESTOQUE',
      qtd: item.qtd || '',
      obs: r.totvs || '',
    }))
  );




    return (
    <>
      <PrintStyles />

      {/* --- ÁREA DE IMPRESSÃO --- */}
      <div id="printable-area" className="print-page-container">
        <div className="print-header">
          <div className="print-brand">
            <img src={logoMetalosa} alt="Metalosa" className="print-logo" />
          </div>
          <div className="print-title">ORDEM DE PRODUCAO</div>
          <div className="print-subtitle">TELHA GALVALUME</div>
          <div className="print-meta">
            <div>PREV. INI:</div>
            <div>{formatarDataBR(dataFiltroImpressao)}</div>
            <div>PREV. FIM:</div>
            <div>{formatarDataBR(dataFiltroImpressao)}</div>
            <div>Nº {numeroControleImpressao || '---'}</div>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>COD</th>
              <th>DESCRICAO DO PRODUTO</th>
              <th>ROMANEIO</th>
              <th>DESTINO</th>
              <th>QUANT. PCS</th>
              <th>OBS</th>
            </tr>
          </thead>
          <tbody>
            {itensParaImpressao.map((item) => (
              <tr key={item.key}>
                <td className="center">{item.cod}</td>
                <td className="left">{item.desc}</td>
                <td className="center">{item.romaneioId}</td>
                <td className="center">{item.destino}</td>
                <td className="center">{item.qtd}</td>
                <td className="center">{item.obs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- APP CONTAINER --- */}
      <div className="app-container flex flex-col md:flex-row h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
        
        {/* --- MENU DE NAVEGAÇÃO (CORRIGIDO COM OEE) --- */}
        <nav className="
            bg-[#09090b] border-t md:border-t-0 md:border-r border-white/10 z-50 shrink-0
            fixed bottom-0 w-full h-16 flex flex-row items-center px-2
            md:relative md:w-20 md:h-full md:flex-col md:justify-start md:py-6 md:px-0
        ">
          <div className="hidden md:flex mb-8 p-2 bg-blue-600 rounded-lg shadow-lg"><Layout className="text-white" size={24} /></div>
          
          <div className="flex flex-row w-full gap-2 overflow-x-auto md:flex-col md:gap-6 md:px-2 md:overflow-visible">
            <BotaoMenu ativo={abaAtiva === 'agenda'} onClick={() => setAbaAtiva('agenda')} icon={<CalendarDays size={20} />} label="Agenda" />
            <BotaoMenu ativo={abaAtiva === 'planejamento'} onClick={() => setAbaAtiva('planejamento')} icon={<ClipboardList size={20} />} label="PCP" />
            <BotaoMenu ativo={abaAtiva === 'comercial'} onClick={() => setAbaAtiva('comercial')} icon={<Box size={20} />} label="Comercial" />
            <BotaoMenu ativo={abaAtiva === 'producao'} onClick={() => setAbaAtiva('producao')} icon={<Factory size={20} />} label="Prod" />
            <BotaoMenu ativo={abaAtiva === 'apontamento'} onClick={() => setAbaAtiva('apontamento')} icon={<AlertOctagon size={20} />} label="Paradas" />
            
            {/* --- OEE ESTÁ DE VOLTA AQUI --- */}
            <BotaoMenu ativo={abaAtiva === 'oee'} onClick={() => setAbaAtiva('oee')} icon={<Activity size={20} />} label="OEE" />
            
            <BotaoMenu ativo={abaAtiva === 'indicadores'} onClick={() => setAbaAtiva('indicadores')} icon={<BarChart3 size={20} />} label="Carga" />
            <BotaoMenu
              ativo={abaAtiva === 'global'}
              onClick={() => setAbaAtiva('global')}
              icon={<TrendingUp size={20} />}   // ou outro ícone
              label="Global"
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
                />
                
                <ColunaKanban 
                    titulo="HOJE" 
                    data={hoje} 
                    cor="emerald" 
                    lista={colunasAgenda.hoje} 
                    resumo={calcResumo(colunasAgenda.hoje)} 
                    onEdit={abrirModalEdicao} 
                />
                
                <ColunaKanban 
                    titulo="AMANHÃ" 
                    data={amanha} 
                    cor="blue" 
                    lista={colunasAgenda.amanha} 
                    resumo={calcResumo(colunasAgenda.amanha)} 
                    onEdit={abrirModalEdicao} 
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
            <h1 className="text-2xl md:text-3xl font-bold flex gap-3"><ClipboardList className="text-blue-500" size={32} /> PCP Geral</h1>
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
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
                      {CATALOGO_PRODUTOS.filter((p) => p.grupo === 'GRUPO_TELHAS').map((p) => (
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
        <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
                <thead><tr className="bg-black/40 text-zinc-400 text-xs border-b border-white/10">
                    <th className="p-4 w-10 text-center">Sel</th>
                    <th className="p-4">ID FIREBASE</th> {/* T?tulo da coluna atualizado */}
                    <th className="p-4">Data</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4 text-center">Peso</th>
                    <th className="p-4 text-right">#</th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                    {filaProducao
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
</td>                                <td className="p-4">{r.cliente}</td>
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
                      <input type="date" value={dataInicioInd} onChange={(e) => setDataInicioInd(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-1.5 text-white text-xs" />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Fim</label>
                      <input type="date" value={dataFimInd} onChange={(e) => setDataFimInd(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-1.5 text-white text-xs" />
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
                        <div className="text-2xl font-bold text-white tracking-tight">{estoqueTelhas.length}</div>
                      </div>
                      <div className="text-xs text-zinc-500 mt-2 font-medium">Itens cadastrados</div>
                    </div>
                    {comercialVisao === 'estoque' && <div className="absolute bottom-0 left-0 h-1 w-full bg-sky-500" />}
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
                            <option value="">Selecionar telha...</option>
                            {estoqueTelhas.map((p) => (
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
                        <button
                          type="button"
                          onClick={() => setFiltroEstoque('telhas')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroEstoque === 'telhas' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                        >
                          Telhas
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-zinc-950/30 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-white/5">
                          <tr>
                            <th className="px-5 py-3">Produto</th>
                            <th className="px-5 py-3">Disponibilidade visual</th>
                            <th className="px-5 py-3">Qtd atual</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">Acoes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {estoqueFiltradoComercial.map((item) => {
                            const status = getStockStatusComercial(item);
                            const percent = Math.min(100, Math.max(0, (Number(item.saldoQtd || 0) / 5000) * 100));
                            return (
                              <tr key={item.cod} className="group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center text-zinc-400 group-hover:border-white/20 transition-colors">
                                      <Box size={16} />
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-white">{item.desc}</div>
                                      <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2">
                                        <span>COD: {item.cod}</span>
                                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                        <span>Telhas</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4 w-48">
                                  <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-zinc-400">Nivel</span>
                                    <span className="text-white font-mono">{percent.toFixed(0)}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${status.bg} rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} />
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="text-sm font-bold text-white tabular-nums">{Number(item.saldoQtd || 0).toLocaleString()}</div>
                                  <div className="text-[10px] text-zinc-500">Kg: {Number(item.saldoKg || 0).toFixed(1)}</div>
                                </td>
                                <td className="px-5 py-4">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${status.text} ${status.border} ${status.bgSoft}`}>
                                    {status.label}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => abrirMovimentacaoEstoque(item)}
                                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg border border-white/5 transition-colors flex items-center gap-2 ml-auto"
                                  >
                                    <ArrowRightLeft size={12} /> Movimentar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {estoqueFiltradoComercial.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-20 text-center text-zinc-500">
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
                  <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-5xl overflow-hidden">
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
                    <div className="p-6 space-y-6">
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
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold"
                      >
                        Enviar pedido
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
                          <option value="">Selecionar telha...</option>
                          {estoqueTelhas.map((p) => (
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
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">PDF do romaneio</div>
                      <label className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer text-sm w-fit">
                        <Upload size={16} />
                        {pdfLoading ? 'Lendo...' : 'Escolher PDF'}
                        <input type="file" accept="application/pdf" onChange={handleUploadPdfRomaneio} className="hidden" />
                      </label>
                      {pdfInfoRomaneio && (
                        <span className="text-xs text-emerald-400">
                          #{pdfInfoRomaneio.id || 'ROMANEIO'} - {pdfItensEncontrados.length} itens
                        </span>
                      )}
                      {pdfErro && <span className="text-xs text-red-400">{pdfErro}</span>}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Escolha a data e máquina na hora; o PDF só preenche os dados.
                    </div>
                  </div>

                  {pdfItensEncontrados.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-zinc-400">Selecione quais itens incluir na ordem:</div>
                      <div className="max-h-52 overflow-y-auto bg-black/30 border border-white/10 rounded-lg divide-y divide-white/5">
                        {pdfItensEncontrados.map((item) => (
                          <label
                            key={item.tempId}
                            className="flex items-start gap-3 p-3 hover:bg-white/5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 accent-emerald-500"
                              checked={pdfItensSelecionados.includes(item.tempId)}
                              onChange={() => togglePdfItemSelecionado(item.tempId)}
                            />
                            <div className="flex-1">
                              <div className="text-sm text-white font-semibold">{item.desc}</div>
                              <div className="text-[11px] text-zinc-400">
                                Cod {item.cod} / Qtd {item.qtd} / Peso {item.pesoTotal}kg{' '}
                                {item.comp ? `/ ${item.comp.toFixed(2)}m` : ''}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={adicionarItensPdfSelecionados}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold"
                        >
                          Adicionar itens selecionados
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
              <h3 className="text-lg font-bold text-white">Escolha a máquina</h3>
              <button
                onClick={() => setShowModalSelecaoMaquina(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {CATALOGO_MAQUINAS.map((m) => (
                <button
                  key={m.maquinaId || m.id}
                  onClick={() => handleEscolherMaquina(m.maquinaId || m.id)}
                  className="w-full text-left bg-zinc-800/70 hover:bg-zinc-800 border border-white/10 hover:border-emerald-400/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {m.nomeExibicao}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {m.grupo === 'GRUPO_TELHAS' ? 'Linha de Telhas' : 'Perfil / Dobra'}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Selecionar
                  </span>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 text-[12px] text-zinc-400">
              Selecione primeiro a máquina para abrir o formulário de romaneio.
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
