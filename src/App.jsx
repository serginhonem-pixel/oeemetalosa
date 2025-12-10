import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import { db } from "./services/firebase";


import {
  Activity, AlertOctagon, ArrowRight, BarChart3, Box,
  CalendarDays, CheckCircle2,
  ClipboardList,
  Download, Factory, FileText, History, Layers, Layout,
  Pencil, Plus, PlusCircle, Scale, Trash2,
  TrendingDown, TrendingUp,
  Upload, X
} from 'lucide-react';

import BackupControls from './components/BackupControls';
import { IS_PRODUCTION } from './services/firebase';
import { safeAddDoc } from './services/firebaseSafeWrites';


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


// --- DADOS ---
import { CATALOGO_PRODUTOS } from './data/catalogoProdutos';
import { DICIONARIO_PARADAS } from './data/dicionarioParadas';
import { CATALOGO_MAQUINAS } from './data/catalogoMaquinas';


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


// --- ESTILOS COMPLETO (RESTAURADO) ---


const PrintStyles = () => (
  <style>{`
    #printable-area { display: none; }
    @media print {
      @page { size: portrait; margin: 10mm; }
      html, body { background: white !important; font-family: sans-serif; font-size: 11px; color: #000; }
      .app-container, nav, .modal-overlay, .no-print { display: none !important; }
      #printable-area { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999; }
      .page-title { text-align: center; font-size: 16px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
      .romaneio-container { margin-bottom: 25px; page-break-inside: avoid; border: 1px solid #000; }
      .client-header { background-color: #e5e5e5 !important; border-bottom: 1px solid #000; padding: 5px 10px; font-weight: bold; display: flex; justify-content: space-between; }
      .simple-table { width: 100%; border-collapse: collapse; }
      .simple-table th { t  xt-align: left; padding: 4px; font-size: 9px; uppercase; border-bottom: 1px solid #000; background: #f0f0f0 !important; }
      .simple-table td { padding: 4px; border-bottom: 1px solid #eee; }
      .block-footer { display: flex; justify-content: flex-end; gap: 20px; padding: 5px 10px; border-top: 1px solid #000; font-weight: bold; background: #f9f9f9 !important; }
    }
  `}</style>
);


export default function App() {

  const [maquinaSelecionada, setMaquinaSelecionada] = useState("");
  // datas base do app, agora 100% fuso local
  const hoje = getLocalISODate();
  const amanha = getLocalISODate(
    new Date(Date.now() + 24 * 60 * 60 * 1000)
  );
  const hojeISO = hoje;

  const [abaAtiva, setAbaAtiva] = useState('agenda');

  const toggleItemSelecionado = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };


  const [dataFiltroImpressao, setDataFiltroImpressao] = useState(hoje);
  const [filaProducao, setFilaProducao] = useState([]);
  
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
  const [formApontProdDestino, setFormApontProdDestino] = useState('Estoque');
  const [producaoEmEdicaoId, setProducaoEmEdicaoId] = useState(null);

  // Indicadores
  const [dataInicioInd, setDataInicioInd] = useState(hoje);
const [dataFimInd, setDataFimInd] = useState(
  getLocalISODate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
);  const [capacidadeDiaria, setCapacidadeDiaria] = useState(15000); 
  const [turnoHoras, setTurnoHoras] = useState(9);

  // Modal Manual (COMPLETO)
  
  const [showModalNovaOrdem, setShowModalNovaOrdem] = useState(false);
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
  const [formRomaneioId, setFormRomaneioId] = useState(''); 
  const [formCliente, setFormCliente] = useState('');
  const [formTotvs, setFormTotvs] = useState(''); 
  const [formDataProducao, setFormDataProducao] = useState(hoje);
  const [itensNoPedido, setItensNoPedido] = useState([]);
  const [isEstoque, setIsEstoque] = useState(false); 

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


  
useEffect(() => {
  const carregarDados = async () => {
    try {
      console.log("🔄 Buscando dados do Firebase...");

      // 1. Romaneios
      const romaneiosSnapshot = await getDocs(collection(db, "romaneios"));
      const listaRomaneios = romaneiosSnapshot.docs.map((docSnap) => ({
        sysId: docSnap.id,
        ...docSnap.data(),
      }));
      setFilaProducao(listaRomaneios);

      // 2. Produção Real
      const producaoSnapshot = await getDocs(collection(db, "producao"));
      const listaProducao = producaoSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const { id, ...rest } = data; // ignora qualquer campo "id" dentro do doc
        return {
          id: docSnap.id, // id REAL do Firestore
          ...rest,
        };
      });
      setHistoricoProducaoReal(listaProducao);

      // 3. Paradas
      const paradasSnapshot = await getDocs(collection(db, "paradas"));
      const listaParadas = paradasSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setHistoricoParadas(listaParadas);

      console.log("✅ Dados carregados com sucesso!");
    } catch (erro) {
      console.error("❌ Erro ao buscar dados:", erro);
    }
  };

  carregarDados();
}, []); // roda só uma vez na montagem


const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
   window.location.hostname === "127.0.0.1" ||
   window.location.hostname === "");




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


  const handleDownloadModelo = () => {
    const ws = XLSX.utils.json_to_sheet([{ ID: '5001', CLIENTE: 'EXEMPLO', DATA: '2025-12-08', TOTVS: 'PC-1', COD: '02006', DESC: 'TELHA', PERFIL: 'TP40', MATERIAL: 'GALV', COMP: 6.00, QTD: 10, PESO_TOTAL: 225.6 }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Modelo"); XLSX.writeFile(wb, "Modelo_Importacao.xlsx");
  };


// Modelo de APONTAMENTO DE PRODUÇÃO
const handleDownloadModeloApontProd = () => {
  const ws = XLSX.utils.json_to_sheet([
    {
      DATA: '2025-12-08',         // aceita 2025-12-08 ou 08/12/2025
      CODIGO: '02006',
      DESCRICAO: 'TELHA TP40 GALV',
      QTD: 120,
      DESTINO: 'Estoque',        // ou Cometa 04 / Serra 06 etc.
    },
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Apont_Producao');
  XLSX.writeFile(wb, 'Modelo_Apontamento_Producao.xlsx');
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
  const adicionarItemNaLista = () => {
    if (!formDesc || !formQtd) return alert("Preencha dados.");
    const qtd = parseInt(formQtd); const comp = parseFloat(formComp) || 0;
    let peso = dadosProdutoAtual ? (dadosProdutoAtual.custom ? (comp * dadosProdutoAtual.kgMetro * qtd) : (dadosProdutoAtual.pesoUnit * qtd)) : 0;
    setItensNoPedido([...itensNoPedido, { tempId: Math.random(), cod: formCod, desc: formDesc, perfil: formPerfil, material: formMaterial, comp, qtd, pesoTotal: peso.toFixed(2) }]);
    resetItemFields();
  };
  const removerItemDaLista = (id) => setItensNoPedido(itensNoPedido.filter(i => i.tempId !== id));
  
  const salvarRomaneio = async () => {
  try {
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
      itens: itensNoPedido,
      updatedAt: agoraISO,
    };

    console.log(">>> Salvando romaneio atual...", {
      romaneioEmEdicaoId,
      objAtual,
      itensReprogramados,
      novaDataReprogramacao,
    });

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





  const abrirModalNovo = () => { limparFormularioGeral(); setShowModalNovaOrdem(true); };
  const abrirModalEdicao = (r) => {
  setRomaneioEmEdicaoId(r.sysId);          // id do doc no Firebase
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

  const limparFormularioGeral = () => { setFormRomaneioId(''); setFormCliente(''); setFormTotvs(''); setFormDataProducao(hoje); setItensNoPedido([]); setIsEstoque(false); resetItemFields(); setRomaneioEmEdicaoId(null); };
const deletarRomaneio = async (sysId) => {
  const ok = window.confirm("Excluir esse romaneio?");
  if (!ok) return;

  // some da tela
  setFilaProducao((prev) => prev.filter((r) => r.sysId !== sysId));

  // tenta apagar no Firestore
  try {
    await deleteDoc(doc(db, "romaneios", String(sysId)));
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
        if(produto) setFormApontProdDesc(produto.desc); else setFormApontProdDesc('');
      }
  };
const limparFormApontamentoProducao = () => {
  setProducaoEmEdicaoId(null);
  setFormApontProdData(hoje);
  setFormApontProdCod('');
  setFormApontProdDesc('');
  setFormApontProdQtd('');
  setFormApontProdDestino('Estoque');
};

const iniciarEdicaoProducao = (registro) => {
  setProducaoEmEdicaoId(registro.id);
  setFormApontProdData(registro.data || hoje);
  setFormApontProdCod(registro.cod || '');
  setFormApontProdDesc(registro.desc || '');
  setFormApontProdQtd(String(registro.qtd || ''));
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

  const obj = {
    data: dataISO,
    cod: formApontProdCod,
    desc: formApontProdDesc || "Item s/ descrição",
    qtd,
    destino: formApontProdDestino || "Estoque",
  };

  try {
    if (apontamentoEmEdicaoId) {
      const docRef = doc(db, "producao", String(apontamentoEmEdicaoId));
      await updateDoc(docRef, obj);

      setHistoricoProducaoReal((prev) =>
        prev.map((p) =>
          p.id === apontamentoEmEdicaoId ? { ...p, ...obj } : p
        )
      );
    } else {
      const docRef = await addDoc(collection(db, "producao"), obj);
      setHistoricoProducaoReal((prev) => [{ id: docRef.id, ...obj }, ...prev]);
    }

    // limpa o form
    setApontamentoEmEdicaoId(null);
    setFormApontProdQtd("");
    setFormApontProdCod("");
    setFormApontProdDesc("");
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
    await deleteDoc(doc(db, "producao", id));
  } catch (err) {
    console.error("Erro ao apagar produção:", err);
    alert("Erro ao apagar no servidor. Veja o console (F12).");
  }
};

  
  const handleUploadApontamentoProducao = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (evt) => {
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

        const qtdRaw = encontrarValorNaLinha(row, [
          "QTD",
          "QUANTIDADE",
          "QDE",
        ]);
        const qtd =
          parseInt(String(qtdRaw ?? 0).replace(",", "."), 10) || 0;

        const desc = String(
          encontrarValorNaLinha(row, ["DESCRICAO", "DESC"]) || ""
        ).trim();

        const destino = String(
          encontrarValorNaLinha(row, ["DESTINO", "LOCAL", "ARMAZEM"]) ||
            "Estoque"
        ).trim();

        if (!cod || !qtd) return null;

        return {
          data: dataISO,
          cod,
          desc: desc || "Item s/ descrição",
          qtd,
          destino,
        };
      })
      .filter(Boolean);

    if (!novos.length) {
      alert("Nenhuma linha válida encontrada no arquivo de produção.");
      return;
    }

    try {
      const salvos = await Promise.all(
        novos.map(async (item) => {
          const docRef = await addDoc(collection(db, "producao"), item);
          return { id: docRef.id, ...item };
        })
      );

      setHistoricoProducaoReal((prev) => [...salvos, ...prev]);
      alert(
        `${salvos.length} apontamentos de produção importados e salvos na nuvem.`
      );
    } catch (err) {
      console.error("Erro ao importar apontamentos de produção:", err);
      alert("Erro ao salvar apontamentos de produção no servidor.");
    }
  };

  reader.readAsBinaryString(file);
  e.target.value = null;
};



  // --- SALVAR PARADA ---
  const salvarApontamentoParada = async (e) => {
  e.preventDefault();
  if (!formParadaInicio || !formParadaFim || !formParadaMotivoCod)
    return alert("Preencha tudo.");

  const d1 = new Date(`${formParadaData}T${formParadaInicio}`);
  const d2 = new Date(`${formParadaData}T${formParadaFim}`);
  const diffMs = d2 - d1;
  const duracaoMin = Math.floor(diffMs / 60000);

  if (duracaoMin <= 0) return alert("Hora final deve ser maior.");

  const motivo = dicionarioLocal.find(
    (d) => d.codigo === formParadaMotivoCod
  );

  const novo = {
    data: formParadaData,
    inicio: formParadaInicio,
    fim: formParadaFim,
    duracao: duracaoMin,
    codMotivo: formParadaMotivoCod,
    descMotivo: motivo?.evento || "",
    grupo: motivo?.grupo || "",
    obs: formParadaObs || "",
  };

  try {
    const docRef = await addDoc(collection(db, "paradas"), novo);

    setHistoricoParadas((prev) => [
      ...prev,
      { id: docRef.id, ...novo },
    ]);

    setShowModalParada(false);
    setFormParadaInicio(formParadaFim);
    setFormParadaFim("");
    setFormParadaObs("");
    setFormParadaMotivoCod("");
  } catch (err) {
    console.error("Erro ao salvar parada no Firebase:", err);
    alert("Erro ao salvar parada no servidor.");
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



  const colunasAgenda = {
  hoje: filaProducao.filter((r) => getDataRomaneio(r) === hoje),
  amanha: filaProducao.filter((r) => getDataRomaneio(r) === amanha),
  futuro: filaProducao.filter((r) => getDataRomaneio(r) > amanha),
};

  const calcResumo = (lista) => ({ itens: lista.reduce((a,r)=>a+r.itens.length,0), peso: lista.reduce((a,r)=>a+r.itens.reduce((s,i)=>s+parseFloat(i.pesoTotal||0),0),0) });

  // --- DASHBOARD E OEE ---
  // --- DASHBOARD E OEE (Lógica Atualizada) ---
  // --- DASHBOARD E OEE (Lógica Atualizada com Filtros) ---
  // --- SUBSTITUA O SEU 'const dadosIndicadores' ATUAL POR ESTE INTEIRO ---
  const dadosIndicadores = useMemo(() => { 
  const agrupadoPorDia = {};
  
  // Datas base
  let currDate = new Date(dataInicioInd + 'T12:00:00');
  const lastDate = new Date(dataFimInd + 'T12:00:00');

  // 1. Cria chaves dia a dia
  while (currDate <= lastDate) {
    const dStr = currDate.toISOString().split('T')[0];
    agrupadoPorDia[dStr] = { 
      pesoPlanejado: 0, 
      itensPlanejados: 0, 
      pesoExecutado: 0, 
      itensExecutados: 0 
    };
    currDate.setDate(currDate.getDate() + 1);
  }

  // 2. Soma Planejado (continua igual)
  const romaneiosNoPeriodo = filaProducao.filter(
    r => r.data >= dataInicioInd && r.data <= dataFimInd
  );
  romaneiosNoPeriodo.forEach(r => {
    const d = String(r.data);
    if (agrupadoPorDia[d]) {
      const pesoR = r.itens.reduce(
        (acc, i) => acc + parseFloat(i.pesoTotal || 0), 
        0
      );
      agrupadoPorDia[d].pesoPlanejado += pesoR;
    }
  });

  // 3. Soma Executado
  const producaoNoPeriodo = historicoProducaoReal.filter(
    p => p.data >= dataInicioInd && p.data <= dataFimInd
  );
  producaoNoPeriodo.forEach(p => {
    const d = String(p.data);
    if (agrupadoPorDia[d]) {
      let pesoItem = 0;
      if (CATALOGO_PRODUTOS) {
        const prodCatalogo = CATALOGO_PRODUTOS.find(cat => cat.cod === p.cod);
        if (prodCatalogo) {
          pesoItem = (prodCatalogo.pesoUnit || 0) * p.qtd;
        }
      }
      agrupadoPorDia[d].pesoExecutado += pesoItem;
    }
  });

  // 4. Array para o gráfico (sem FDS e sem dias totalmente vazios)
  const arrayGrafico = Object.keys(agrupadoPorDia)
    .sort()
    .map(data => ({ data, ...agrupadoPorDia[data] }))
    .filter(dia => {
      const dataObj = new Date(dia.data + 'T12:00:00');
      const diaSemana = dataObj.getDay(); 
      const isFimDeSemana = diaSemana === 0 || diaSemana === 6;
      const isVazio = dia.pesoPlanejado === 0 && dia.pesoExecutado === 0;
      return !(isFimDeSemana || isVazio);
    });

  // 5. Totais do período selecionado
  const totalPesoPlanejado = romaneiosNoPeriodo.reduce(
    (acc, r) => acc + r.itens.reduce(
      (sum, i) => sum + parseFloat(i.pesoTotal || 0), 
      0
    ),
    0
  );

  const totalPesoExecutado = producaoNoPeriodo.reduce((acc, p) => {
    const prod = CATALOGO_PRODUTOS?.find(c => c.cod === p.cod);
    return acc + ((prod?.pesoUnit || 0) * p.qtd);
  }, 0);

  // ================= META vs EXECUTADO CORRIDO ==================
  const capacidadeNum = Number(capacidadeDiaria) || 0;

  // datas pra cálculo de dias úteis até o fim do mês
  const inicioPeriodo = new Date(dataInicioInd + 'T12:00:00');
  const hojeDate = new Date(hojeISO + 'T12:00:00');
  const lastDayOfMonth = new Date(
    inicioPeriodo.getFullYear(), 
    inicioPeriodo.getMonth() + 1, 
    0
  );

  let diasUteisMes = 0;
  let diasUteisPassados = 0;

  for (let d = new Date(inicioPeriodo); d <= lastDayOfMonth; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // pula sábado/domingo

    diasUteisMes++;
    if (d <= hojeDate) diasUteisPassados++;
  }

  if (diasUteisPassados === 0) diasUteisPassados = 1;

  // Meta acumulada até hoje (pra saldo corrido)
  const metaAteHoje = capacidadeNum * diasUteisPassados;

  // Meta até o fim do mês (é isso que vai no CARD como "Meta")
  const metaAteFimMes = capacidadeNum * diasUteisMes;

  // Média diária REAL até hoje
  const mediaAtual = totalPesoExecutado / diasUteisPassados;

  // Projeção até o fim do mês = média diária * todos os dias úteis do mês
  const projecaoFinal = mediaAtual * diasUteisMes;

  // Saldo corrido vs meta (executado - meta até hoje)
  const saldoTotal = totalPesoExecutado - metaAteHoje;

  // Ritmo necessário pra bater a meta do mês (se quiser manter esse indicador)
  const diasRestantes = Math.max(diasUteisMes - diasUteisPassados, 0);
  let ritmoNecessario = 0;
  if (diasRestantes > 0 && capacidadeNum > 0) {
    const falta = metaAteFimMes - totalPesoExecutado;
    ritmoNecessario = falta > 0 ? falta / diasRestantes : 0;
  }

  return { 
    arrayGrafico,
    totalPesoPlanejado,    // continua disponível se quiser ver “planejado x executado”
    totalPesoExecutado,
    saldoTotal,            // agora vs meta corrida
    ritmoNecessario,
    projecaoFinal,         // projeção até o fim do mês
    metaAteFimMes          // meta até o fim do mês (capacidade * dias úteis)
  };
}, [
  filaProducao,
  historicoProducaoReal,
  dataInicioInd,
  dataFimInd,
  capacidadeDiaria
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

  // 1) SEMPRE joga no histórico local (pra aparecer na tela)
  setHistoricoParadas((prev) => [...prev, paradaLocal]);

  // 2) Se estiver rodando em localhost, não tenta salvar no Firebase
  if (IS_LOCALHOST) {
    console.info("[Paradas] Rodando em localhost, não salvando no Firebase.");
    return;
  }

  // 3) Em produção, tenta salvar de verdade
  try {
    const idGerado = await salvarApontamentoParada(novaParada);

    // se o backend devolver um id, atualiza o registro local com ele
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
const handleImportBackup = async (json) => {
  if (!json) return;

  if (!IS_PRODUCTION) {
    console.log('[DEV] Import de backup SIMULADO (não grava no Firebase):', json);
    alert('Import de backup só grava na nuvem no site oficial. No localhost é simulado.');
    return;
  }

  const romaneios = Array.isArray(json.romaneios) ? json.romaneios : [];
  const producao  = Array.isArray(json.producao)  ? json.producao  : [];
  const paradas   = Array.isArray(json.paradas)   ? json.paradas   : [];

  if (!romaneios.length && !producao.length && !paradas.length) {
    alert('Arquivo de backup sem dados válidos (romaneios / producao / paradas).');
    return;
  }

  try {
    // ROMANEIOS
    for (const r of romaneios) {
      const { id, sysId, ...rest } = r; // tira ids antigos
      await safeAddDoc('romaneios', rest);
    }

    // PRODUÇÃO
    for (const p of producao) {
      const { id, ...rest } = p;
      await safeAddDoc('producao', rest);
    }

    // PARADAS
    for (const pa of paradas) {
      const { id, ...rest } = pa;
      await safeAddDoc('paradas', rest);
    }

    alert('Backup importado e gravado no Firebase com sucesso!');
  } catch (err) {
    console.error('Erro ao importar backup:', err);
    alert('Erro ao importar backup. Veja o console (F12).');
  }
};





    return (
    <>
      <PrintStyles />

      {/* --- ÁREA DE IMPRESSÃO --- */}
      <div id="printable-area" className="print-page-container">
    <div className="page-title text-center text-xl font-serif mb-6 border-b border-gray-400 pb-2">
        PROGRAMAÇÃO DE PRODUÇÃO - DATA: {formatarDataBR(dataFiltroImpressao)}
    </div>
    
    {filaProducao
        // 1. Filtro por Data (Garantindo que a data exista)
      .filter((r) => getDataRomaneio(r) === dataFiltroImpressao)
        
        // 2. Filtro de Segurança: Remove Romaneios sem itens ou com peso zero (para eliminar 'ESTOQUE 04' vazios)
        .filter((r) => {
            const temItens = Array.isArray(r.itens) && r.itens.length > 0;
            if (!temItens) return false;
            
            const pesoTotal = r.itens.reduce((a, b) => a + parseFloat(b.pesoTotal || 0), 0);
            return pesoTotal > 0;
        })
        
        // 3. Ordenação por Cliente
        .sort((a, b) => (a.cliente || '').localeCompare(b.cliente || ''))
        
        .map((r) => (
            // Usa o sysId como chave e adiciona uma margem inferior clara para separação
            <div key={r.sysId} className="romaneio-container border border-gray-300 mb-6 p-4 rounded shadow-md break-after-page">
                
                {/* Cabeçalho do Cliente: Mais formal e claro */}
                <div className="client-header bg-gray-100 p-2 mb-3 flex justify-between items-center text-sm font-bold border-b border-gray-300">
                    <span className="text-gray-700 uppercase">CLIENTE: {r.cliente || 'ESTOQUE / MANUAL'}</span>
                    <span className="text-blue-700 font-mono">ROMANEIO ID: {r.id}</span>
                </div>
                
                <table className="simple-table w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-300">
                            <th className="py-2 px-3 text-left w-[10%]">CÓDIGO</th>
                            <th className="py-2 px-3 text-left w-[60%]">DESCRIÇÃO / MEDIDA</th>
                            <th className="py-2 px-3 text-center w-[10%]">QTD</th>
                            <th className="py-2 px-3 text-right w-[10%]">PESO (kg)</th>
                            <th className="py-2 px-3 text-center w-[10%]">CHK</th>
                        </tr>
                    </thead>
                    <tbody>
                        {r.itens.map((i, k) => (
                            <tr key={k} className="border-b border-gray-100 last:border-b-0">
                                <td className="py-2 px-3">{i.cod}</td>
                                <td className="py-2 px-3">
                                    <strong className="text-gray-800">{i.comp?.toFixed(2) || '0.00'}m</strong>
                                    {' - '}
                                    {i.desc} {i.perfil && `(${i.perfil})`}
                                </td>
                                <td className="py-2 px-3 text-center font-medium">{i.qtd}</td>
                                <td className="py-2 px-3 text-right text-gray-700">{i.pesoTotal}</td>
                                <td className="py-2 px-3 text-center">[ ]</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {/* Rodapé Total */}
                <div className="block-footer mt-3 pt-2 border-t-2 border-blue-200 flex justify-end">
                    <span className="text-lg font-bold text-gray-800">
                        TOTAL DO ROMANEIO: {r.itens.reduce((a, b) => a + parseFloat(b.pesoTotal || 0), 0).toFixed(1)} kg
                    </span>
                </div>
            </div>
        ))}
</div>

      {/* --- APP CONTAINER --- */}
      <div className="app-container flex flex-col md:flex-row h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
        
        {/* --- MENU DE NAVEGAÇÃO (CORRIGIDO COM OEE) --- */}
        <nav className="
            bg-[#09090b] border-t md:border-t-0 md:border-r border-white/10 z-50 shrink-0
            fixed bottom-0 w-full h-16 flex flex-row justify-around items-center px-2
            md:relative md:w-20 md:h-full md:flex-col md:justify-start md:py-6 md:px-0
        ">
          <div className="hidden md:flex mb-8 p-2 bg-blue-600 rounded-lg shadow-lg"><Layout className="text-white" size={24} /></div>
          
          <div className="flex flex-row w-full justify-around md:flex-col md:gap-6 md:px-2">
            <BotaoMenu ativo={abaAtiva === 'agenda'} onClick={() => setAbaAtiva('agenda')} icon={<CalendarDays size={20} />} label="Agenda" />
            <BotaoMenu ativo={abaAtiva === 'planejamento'} onClick={() => setAbaAtiva('planejamento')} icon={<ClipboardList size={20} />} label="PCP" />
            <BotaoMenu ativo={abaAtiva === 'producao'} onClick={() => setAbaAtiva('producao')} icon={<Factory size={20} />} label="Prod" />
            <BotaoMenu ativo={abaAtiva === 'apontamento'} onClick={() => setAbaAtiva('apontamento')} icon={<AlertOctagon size={20} />} label="Paradas" />
            
            {/* --- OEE ESTÁ DE VOLTA AQUI --- */}
            <BotaoMenu ativo={abaAtiva === 'oee'} onClick={() => setAbaAtiva('oee')} icon={<Activity size={20} />} label="OEE" />
            
            <BotaoMenu ativo={abaAtiva === 'indicadores'} onClick={() => setAbaAtiva('indicadores')} icon={<BarChart3 size={20} />} label="Carga" />
          </div>
        </nav>

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
        onClick={abrirModalNovo}
        className="bg-purple-600 px-4 py-2 rounded font-bold text-white flex gap-2 items-center flex-1 md:flex-none justify-center"
      >
        <Plus size={20} /> Novo
      </button>
    </div>
  </div>
</header>

              {/* Grid Agenda: 1 coluna no mobile (com scroll) */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto pb-20 md:pb-4">
                
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
                <button onClick={abrirModalNovo} className="bg-blue-600 text-white px-3 py-2 rounded text-sm flex gap-2 whitespace-nowrap"><Plus size={16} /> Novo</button>
            </div>
        </header>
        <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
                <thead><tr className="bg-black/40 text-zinc-400 text-xs border-b border-white/10">
                    <th className="p-4">ID FIREBASE</th> {/* Título da coluna atualizado */}
                    <th className="p-4">Data</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4 text-center">Peso</th>
                    <th className="p-4 text-right">#</th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                    {filaProducao
                        // 1. Cria uma cópia e ordena: mais recente (b) - mais antigo (a)
                        .slice() 
.sort((a, b) => new Date(getDataRomaneio(b)) - new Date(getDataRomaneio(a)))
                        // 2. Limita a 50 itens para exibição
                        .slice(0, 300) 
                        .map((r) => (
                           <tr key={r.sysId} className="hover:bg-white/5">
                                 {/* Exibindo o ID do Firebase (assumindo que está em r.sysId) */}
                                <td className="p-4 text-blue-400 font-mono text-xs">#{r.sysId}</td> 
<td className="p-4 text-zinc-300">
  {formatarDataBR(getDataRomaneio(r))}
</td>                                <td className="p-4">{r.cliente}</td>
                                <td className="p-4 text-center">{r.itens.reduce((a, b) => a + parseFloat(b.pesoTotal || 0), 0).toFixed(1)}</td>
                                <td className="p-4 text-right">
                                    {/* Verifica se o r.sysId é válido antes de renderizar o botão */}
                                    {r.sysId && (typeof r.sysId === 'string' && r.sysId.length > 5) ? (
                                        <button onClick={() => deletarRomaneio(r.sysId)} className="text-zinc-400 hover:text-red-500">
                                            <Trash2 size={16} />
                                        </button>
                                    ) : (
                                        // Se o ID for inválido (como no Estoque Interno), exibe um placeholder ou nada
                                        <span className="text-zinc-600 cursor-not-allowed">—</span>
                                    )}
                                </td>                           </tr>
                        ))}
                </tbody>
            </table>
        </div>
    </div>
)}

          {/* ABA PRODUÇÃO */}
          {abaAtiva === 'producao' && (
             <div className="flex-1 bg-[#09090b] p-4 md:p-8 overflow-hidden flex flex-col">
                <header className="mb-6"><h1 className="text-2xl md:text-3xl font-bold flex gap-3 text-white"><Factory className="text-emerald-500" size={32} /> Apontamento</h1></header>
                <div className="flex flex-col md:flex-row gap-6 h-full min-h-0 overflow-y-auto md:overflow-hidden">
                   <div className="w-full md:w-1/3 bg-zinc-900 rounded-2xl border border-emerald-500/20 p-4 md:p-6 shrink-0">
                      <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2"><Box size={20} /> Registrar Peça</h3>
                      <div className="space-y-4">
                         <input type="date" value={formApontProdData} onChange={(e) => setFormApontProdData(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white" />
                         <select value={formApontProdCod} onChange={handleSelectProdApontamento} className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm">
                            <option value="">Selecione...</option>{CATALOGO_PRODUTOS.map((p) => <option key={p.cod} value={p.cod}>{p.cod} - {p.desc}</option>)}
                         </select>
                         <div className="grid grid-cols-2 gap-4">
                            <input type="number" placeholder="Qtd" value={formApontProdQtd} onChange={(e) => setFormApontProdQtd(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white text-right font-bold text-lg" />
                            <select value={formApontProdDestino} onChange={(e) => setFormApontProdDestino(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm">
                               <option value="Estoque">Estoque</option><option value="Cometa 04">Cometa 04</option><option value="Serra 06">Serra 06</option>
                            </select>
                         </div>
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
                   <div className="flex-1 bg-zinc-900 rounded-2xl border border-white/10 flex flex-col overflow-hidden min-h-[300px]">
    <div className="p-4 border-b border-white/10 bg-white/5"><h3 className="font-bold text-white flex gap-2"><History size={18} /> Histórico Hoje</h3></div>
    <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
            <thead className="bg-black/20 text-zinc-500 text-xs uppercase sticky top-0 backdrop-blur">
                <tr>
                    <th className="p-4">Item</th>
                    <th className="p-4 text-center">Qtd</th>
                    {/* ➡️ NOVA COLUNA PARA O ID DO FIREBASE */}
                    <th className="p-4 text-xs font-mono">ID</th>
                    <th className="p-4 text-right">#</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {historicoProducaoReal.filter(p => p.data === formApontProdData).map((p) => (
                    <tr key={p.id}>
                        <td className="p-4">
                            <div className="font-mono text-emerald-400">{p.cod}</div>
                            <div className="text-zinc-400 text-xs">{p.desc}</div>
                        </td>
                        <td className="p-4 text-center font-bold">{p.qtd}</td>
                        
                        {/* ➡️ CÉLULA EXIBINDO O ID DO FIREBASE (p.id) */}
                        <td className="p-4 text-zinc-500 font-mono text-xs w-[120px] overflow-hidden truncate">{p.id}</td>
                        
                        <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() => iniciarEdicaoProducao(p)}
                                    className="text-zinc-500 hover:text-emerald-400"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => deletarProducaoReal(p.id)}
                                    className="text-zinc-600 hover:text-red-500"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
</div>
                </div>
             </div>
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
                <div className="w-full md:w-auto grid grid-cols-2 md:flex gap-3 bg-zinc-900/50 p-3 rounded-xl border border-white/10 shadow-xl">
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
                <button onClick={salvarRomaneio} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"><ArrowRight size={20} /> Salvar</button>
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
    className={`w-full p-3 rounded-xl flex flex-col items-center gap-1 ${
      ativo ? "bg-white/10 text-pink-500" : "text-zinc-500 hover:bg-white/5"
    }`}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase">{label}</span>
  </button>
);

// --- COMPONENTE DE TOOLTIP CUSTOMIZADO ---
