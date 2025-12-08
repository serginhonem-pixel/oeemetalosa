import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx'; 
import { 
  Layout, ClipboardList, Plus, CalendarDays, Package, X, 
  Database, Trash2, Printer, Pencil, PlusCircle, Layers, Scale, 
  ArrowRight, Calendar, Box, FileText, Upload, Download,
  BarChart3, TrendingUp, AlertOctagon, Clock, CheckCircle2, 
  Factory, History, Activity, PieChart
} from 'lucide-react';

// --- SEUS IMPORTS (VERIFIQUE SE OS ARQUIVOS EXISTEM NESSAS PASTAS) ---
import { CATALOGO_PRODUTOS } from './data/catalogoProdutos'; 
import { DICIONARIO_PARADAS } from './data/dicionarioParadas'; // <--- CAMINHO CORRIGIDO

// --- FUNÇÕES AUXILIARES ---

const formatarDataBR = (dataISO) => {
  if (!dataISO) return '-';
  if (typeof dataISO !== 'string') return String(dataISO);
  const partes = dataISO.split('-');
  if (partes.length !== 3) return dataISO; 
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const processarDataExcel = (valorBruto) => {
  const hojeISO = new Date().toISOString().split('T')[0];
  if (!valorBruto) return hojeISO;

  try {
    if (typeof valorBruto === 'string') {
      const limpa = valorBruto.trim();
      if (limpa.match(/^\d{4}-\d{2}-\d{2}$/)) return limpa; 
      if (limpa.includes('/')) {
         const partes = limpa.split('/');
         if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`; 
      }
    }
    if (valorBruto instanceof Date) {
      const offset = valorBruto.getTimezoneOffset() * 60000; 
      const dataLocal = new Date(valorBruto.getTime() - offset);
      return dataLocal.toISOString().split('T')[0];
    }
    if (typeof valorBruto === 'number') {
      const dataBase = new Date(1899, 11, 30); 
      const dataFinal = new Date(dataBase.getTime() + valorBruto * 86400000);
      dataFinal.setHours(dataFinal.getHours() + 12);
      return dataFinal.toISOString().split('T')[0];
    }
  } catch (e) { console.error("Erro data:", valorBruto); }
  return hojeISO;
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

const GaugeChart = ({ value, label, color }) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    return (
        <div className="flex flex-col items-center justify-center relative">
            <svg width="100" height="100" className="rotate-[-90deg]">
                <circle cx="50" cy="50" r={radius} stroke="#27272a" strokeWidth="8" fill="transparent" />
                <circle cx="50" cy="50" r={radius} stroke={color} strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute flex flex-col items-center"><span className="text-xl font-bold text-white">{value.toFixed(0)}%</span></div>
            <span className="text-xs text-zinc-400 mt-2 uppercase font-bold">{label}</span>
        </div>
    );
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
      .simple-table th { text-align: left; padding: 4px; font-size: 9px; uppercase; border-bottom: 1px solid #000; background: #f0f0f0 !important; }
      .simple-table td { padding: 4px; border-bottom: 1px solid #eee; }
      .block-footer { display: flex; justify-content: flex-end; gap: 20px; padding: 5px 10px; border-top: 1px solid #000; font-weight: bold; background: #f9f9f9 !important; }
    }
  `}</style>
);

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState('agenda'); 
  const hoje = new Date().toISOString().split('T')[0];
  const d_amanha = new Date(); d_amanha.setDate(d_amanha.getDate() + 1);
  const amanha = d_amanha.toISOString().split('T')[0];

  const [dataFiltroImpressao, setDataFiltroImpressao] = useState(hoje);
  const [filaProducao, setFilaProducao] = useState([]);
  
  // Paradas
  const [historicoParadas, setHistoricoParadas] = useState([]);
  const [dicionarioLocal, setDicionarioLocal] = useState(DICIONARIO_PARADAS || []);
  
  // Apontamento Prod
  const [historicoProducaoReal, setHistoricoProducaoReal] = useState([]);
  const [formApontProdData, setFormApontProdData] = useState(hoje);
  const [formApontProdCod, setFormApontProdCod] = useState('');
  const [formApontProdDesc, setFormApontProdDesc] = useState('');
  const [formApontProdQtd, setFormApontProdQtd] = useState('');
  const [formApontProdDestino, setFormApontProdDestino] = useState('Estoque');

  // Indicadores
  const [dataInicioInd, setDataInicioInd] = useState(hoje);
  const [dataFimInd, setDataFimInd] = useState(new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]);
  const [capacidadeDiaria, setCapacidadeDiaria] = useState(20000); 
  const [turnoHoras, setTurnoHoras] = useState(9);

  // Modal Manual (COMPLETO)
  const [showModalNovaOrdem, setShowModalNovaOrdem] = useState(false);
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

  if (!novosRomaneiosMap[idStr]) {
    const rawDate = encontrarValorNaLinha(row, ['DATA', 'DT', 'ENTREGA', 'EMISSAO']);
    const cleanDate = processarDataExcel(rawDate);
    const cliente = encontrarValorNaLinha(row, ['CLIENTE', 'NOME', 'RAZAO']) || 'Importado';
    const totvs = encontrarValorNaLinha(row, ['TOTVS', 'PC']) || '';

    novosRomaneiosMap[idStr] = {
      id: idStr,
      sysId: Math.random(),
      cliente,
      totvs,
      data: cleanDate,
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

  // 🔧 AQUI É O AJUSTE IMPORTANTE
  const pesoBruto = encontrarValorNaLinha(row, ['PESO_TOTAL', 'PESO TOTAL', 'PESO']);
  const pesoTotal = parseFloat(String(pesoBruto || 0).replace(',', '.'));

  novosRomaneiosMap[idStr].itens.push({
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
          setFilaProducao(prev => {
              const idsNovos = new Set(listaNovos.map(r => r.id));
              const limpo = prev.filter(r => !idsNovos.has(r.id));
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
  
  const salvarRomaneio = (e) => {
    e.preventDefault();
    const obj = { id: formRomaneioId||'MANUAL', sysId: Math.random(), cliente: formCliente, totvs: formTotvs, data: formDataProducao, status: 'PENDENTE', itens: itensNoPedido };
    if (romaneioEmEdicaoId) setFilaProducao(filaProducao.map(r => r.id === romaneioEmEdicaoId ? { ...r, ...obj } : r));
    else setFilaProducao([...filaProducao, obj]);
    setShowModalNovaOrdem(false); limparFormularioGeral();
  };
  const abrirModalNovo = () => { limparFormularioGeral(); setShowModalNovaOrdem(true); };
  const abrirModalEdicao = (r) => {
    setRomaneioEmEdicaoId(r.id); setFormRomaneioId(r.id); setFormCliente(r.cliente); setFormTotvs(r.totvs||''); setFormDataProducao(r.data);
    setItensNoPedido(r.itens.map(i => ({...i, tempId: Math.random()}))); setIsEstoque(r.id === 'ESTOQUE'); setShowModalNovaOrdem(true);
  };
  const limparFormularioGeral = () => { setFormRomaneioId(''); setFormCliente(''); setFormTotvs(''); setFormDataProducao(hoje); setItensNoPedido([]); setIsEstoque(false); resetItemFields(); setRomaneioEmEdicaoId(null); };
  const deletarRomaneio = (sysId) => { if(window.confirm('Excluir?')) setFilaProducao(filaProducao.filter(r => r.sysId !== sysId)); };

  // --- APONTAMENTOS ---
  const handleSelectProdApontamento = (e) => {
      const codigo = e.target.value; setFormApontProdCod(codigo);
      if(CATALOGO_PRODUTOS) {
        const produto = CATALOGO_PRODUTOS.find(p => p.cod === codigo);
        if(produto) setFormApontProdDesc(produto.desc); else setFormApontProdDesc('');
      }
  };
  const salvarApontamentoProducao = (e) => {
      e.preventDefault();
      if(!formApontProdCod || !formApontProdQtd) return alert("Preencha código e quantidade.");
      setHistoricoProducaoReal([{ id: Math.random(), data: formApontProdData, cod: formApontProdCod, desc: formApontProdDesc || 'Item s/ descrição', qtd: parseInt(formApontProdQtd), destino: formApontProdDestino }, ...historicoProducaoReal]);
      setFormApontProdQtd(''); setFormApontProdCod(''); setFormApontProdDesc('');
  };
  const deletarProducaoReal = (id) => { if(window.confirm("Remover?")) setHistoricoProducaoReal(historicoProducaoReal.filter(i => i.id !== id)); };
  
  // --- SALVAR PARADA ---
  const salvarApontamentoParada = (e) => {
    e.preventDefault();
    if(!formParadaInicio || !formParadaFim || !formParadaMotivoCod) return alert("Preencha tudo.");
    
    const d1 = new Date(`${formParadaData}T${formParadaInicio}`);
    const d2 = new Date(`${formParadaData}T${formParadaFim}`);
    const diffMs = d2 - d1;
    const duracaoMin = Math.floor(diffMs / 60000); 
    
    if (duracaoMin <= 0) return alert("Hora final deve ser maior.");
    
    // Tenta encontrar motivo por 'codigo' ou 'cod'
    const motivo = dicionarioLocal.find(p => p.codigo === formParadaMotivoCod || p.cod === formParadaMotivoCod);
    
    setHistoricoParadas([...historicoParadas, {
        id: Math.random(), 
        data: formParadaData, 
        inicio: formParadaInicio, 
        fim: formParadaFim, 
        duracao: duracaoMin,
        codMotivo: formParadaMotivoCod, 
        descMotivo: motivo ? (motivo.evento || motivo.desc) : 'Desconhecido', 
        grupo: motivo ? (motivo.grupo) : 'Geral', 
        obs: formParadaObs
    }]);
    
    setShowModalParada(false); setFormParadaInicio(formParadaFim); setFormParadaFim(''); setFormParadaObs(''); setFormParadaMotivoCod('');
  };
  const deletarParada = (id) => setHistoricoParadas(historicoParadas.filter(p => p.id !== id));

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

  const colunasAgenda = {
    hoje: filaProducao.filter(r => r.data === hoje),
    amanha: filaProducao.filter(r => r.data === amanha),
    futuro: filaProducao.filter(r => r.data > amanha)
  };
  const calcResumo = (lista) => ({ itens: lista.reduce((a,r)=>a+r.itens.length,0), peso: lista.reduce((a,r)=>a+r.itens.reduce((s,i)=>s+parseFloat(i.pesoTotal||0),0),0) });

  // --- DASHBOARD E OEE ---
  const dadosIndicadores = useMemo(() => {
    const filtrados = filaProducao.filter(r => r.data >= dataInicioInd && r.data <= dataFimInd);
    const agrupadoPorDia = {};
    let currDate = new Date(dataInicioInd);
    const lastDate = new Date(dataFimInd);
    while (currDate <= lastDate) {
        const dStr = currDate.toISOString().split('T')[0];
        agrupadoPorDia[dStr] = { peso: 0, itens: 0, romaneios: 0 };
        currDate.setDate(currDate.getDate() + 1);
    }
    filtrados.forEach(r => {
        const d = String(r.data);
        if (!agrupadoPorDia[d]) agrupadoPorDia[d] = { peso: 0, itens: 0, romaneios: 0 };
        const pesoR = r.itens.reduce((acc, i) => acc + parseFloat(i.pesoTotal || 0), 0);
        const itensR = r.itens.reduce((acc, i) => acc + parseInt(i.qtd || 0), 0);
        agrupadoPorDia[d].peso += pesoR;
        agrupadoPorDia[d].itens += itensR;
        agrupadoPorDia[d].romaneios += 1;
    });
    const arrayGrafico = Object.keys(agrupadoPorDia).sort().map(data => ({ data, ...agrupadoPorDia[data] }));
    const totalPeso = filtrados.reduce((acc, r) => acc + r.itens.reduce((sum, i) => sum + parseFloat(i.pesoTotal || 0), 0), 0);
    const totalItens = filtrados.reduce((acc, r) => acc + r.itens.length, 0);
    return { filtrados, arrayGrafico, totalPeso, totalItens };
  }, [filaProducao, dataInicioInd, dataFimInd]);

  const dadosOEE = useMemo(() => {
      const paradasDoDia = historicoParadas.filter(p => p.data === hoje);
      const tempoTotalMinutos = turnoHoras * 60; 
      const tempoParadoTotal = paradasDoDia.reduce((acc, p) => acc + p.duracao, 0);
      const tempoProduzindo = Math.max(0, tempoTotalMinutos - tempoParadoTotal);
      const disponibilidade = tempoTotalMinutos > 0 ? (tempoProduzindo / tempoTotalMinutos) * 100 : 0;
      const motivosAgrupados = {};
      paradasDoDia.forEach(p => {
          if(!motivosAgrupados[p.descMotivo]) motivosAgrupados[p.descMotivo] = 0;
          motivosAgrupados[p.descMotivo] += p.duracao;
      });
      const listaPareto = Object.keys(motivosAgrupados).map(k => ({ motivo: k, tempo: motivosAgrupados[k] })).sort((a,b) => b.tempo - a.tempo);
      const performance = 95; const qualidade = 98; 
      const oee = (disponibilidade * performance * qualidade) / 10000;
      return { disponibilidade, performance, qualidade, oee, tempoProduzindo, tempoParadoTotal, listaPareto };
  }, [historicoParadas, turnoHoras, hoje]);

  return (
    <>
      <PrintStyles />
      <div id="printable-area">
        <div className="page-title">PROGRAMAÇÃO - {formatarDataBR(dataFiltroImpressao)}</div>
        {filaProducao.filter(r => String(r.data) === dataFiltroImpressao)
          .sort((a,b)=>a.cliente.localeCompare(b.cliente))
          .map(r => (
            <div key={r.sysId} className="romaneio-container">
              <div className="client-header"><span>{r.cliente}</span><span>ROM: {r.id}</span></div>
              <table className="simple-table">
                <thead><tr><th>COD</th><th>DESCRIÇÃO / MEDIDA</th><th>QTD</th><th>PESO</th><th>CHK</th></tr></thead>
                <tbody>{r.itens.map((i,k) => (
                    <tr key={k}>
                        <td>{i.cod}</td><td><strong>{i.comp.toFixed(2)}m</strong> - {i.desc} {i.perfil && `(${i.perfil})`}</td>
                        <td align="center">{i.qtd}</td><td align="center">{i.pesoTotal}</td><td align="center">[ ]</td>
                    </tr>
                ))}</tbody>
              </table>
              <div className="block-footer"><span>PESO TOTAL: {r.itens.reduce((a,b)=>a+parseFloat(b.pesoTotal||0),0).toFixed(1)} kg</span></div>
            </div>
        ))}
      </div>
      
      <div className="app-container flex h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
        <nav className="w-20 bg-[#09090b] flex flex-col items-center py-6 border-r border-white/10 z-20 shrink-0">
          <div className="mb-8 p-2 bg-blue-600 rounded-lg shadow-lg"><Layout className="text-white" size={24} /></div>
          <div className="flex flex-col gap-6 w-full px-2">
            <BotaoMenu ativo={abaAtiva === 'agenda'} onClick={() => setAbaAtiva('agenda')} icon={<CalendarDays size={24} />} label="Agenda" />
            <BotaoMenu ativo={abaAtiva === 'planejamento'} onClick={() => setAbaAtiva('planejamento')} icon={<ClipboardList size={24} />} label="PCP" />
            <BotaoMenu ativo={abaAtiva === 'producao'} onClick={() => setAbaAtiva('producao')} icon={<Factory size={24} />} label="Apont. Prod" />
            <BotaoMenu ativo={abaAtiva === 'apontamento'} onClick={() => setAbaAtiva('apontamento')} icon={<AlertOctagon size={24} />} label="Paradas" />
            <BotaoMenu ativo={abaAtiva === 'oee'} onClick={() => setAbaAtiva('oee')} icon={<Activity size={24} />} label="OEE" />
            <BotaoMenu ativo={abaAtiva === 'indicadores'} onClick={() => setAbaAtiva('indicadores')} icon={<BarChart3 size={24} />} label="Carga" />
          </div>
        </nav>

        <div className="flex-1 flex overflow-hidden bg-[#09090b]">
          {/* AGENDA */}
          {abaAtiva === 'agenda' && (
            <div className="flex-1 bg-[#09090b] p-6 overflow-hidden flex flex-col">
              <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold flex gap-3"><Layers className="text-purple-500" size={32} /> Gestão da Semana</h1>
                <div className="flex gap-3">
                    <button onClick={() => setShowModalParada(true)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg animate-pulse"><AlertOctagon size={20} /> Parada</button>
                    <div className="w-px bg-white/10 mx-2"></div>
                    <input type="date" value={dataFiltroImpressao} onChange={(e) => setDataFiltroImpressao(e.target.value)} className="bg-zinc-800 border border-white/10 rounded p-1.5 text-white text-xs" />
                    <button onClick={handlePrint} className="p-1.5 bg-zinc-700 rounded text-white"><FileText size={16}/></button>
                    <button onClick={abrirModalNovo} className="bg-purple-600 px-4 py-2 rounded font-bold text-white flex gap-2"><Plus size={20}/> Novo</button>
                </div>
              </header>
              <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden min-h-0">
                <ColunaKanban titulo="HOJE" data={hoje} cor="emerald" lista={colunasAgenda.hoje} resumo={calcResumo(colunasAgenda.hoje)} onEdit={abrirModalEdicao}/>
                <ColunaKanban titulo="AMANHÃ" data={amanha} cor="blue" lista={colunasAgenda.amanha} resumo={calcResumo(colunasAgenda.amanha)} onEdit={abrirModalEdicao}/>
                <div className="flex flex-col h-full bg-zinc-900/30 rounded-2xl border border-white/5 overflow-hidden">
                   <div className="p-4 border-b border-white/5 bg-zinc-900/80"><h2 className="text-lg font-black text-zinc-400">PRÓXIMOS</h2></div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-4">{colunasAgenda.futuro.map(r => <CardRomaneio key={r.sysId} romaneio={r} onEdit={() => abrirModalEdicao(r)} />)}</div>
                </div>
              </div>
            </div>
          )}

          {/* PCP */}
          {abaAtiva === 'planejamento' && (
            <div className="flex-1 bg-[#09090b] p-8 overflow-y-auto">
              <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold flex gap-3"><ClipboardList className="text-blue-500" size={32} /> PCP - Lista Geral</h1>
                <div className="flex gap-2">
                    <button onClick={handleDownloadModelo} className="bg-zinc-800 text-white px-3 py-2 rounded text-sm flex gap-2"><Download size={16}/> Modelo</button>
                    <label className="bg-emerald-600 text-white px-3 py-2 rounded text-sm flex gap-2 cursor-pointer"><Upload size={16}/> Importar <input type="file" onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" /></label>
                    <button onClick={abrirModalNovo} className="bg-blue-600 text-white px-3 py-2 rounded text-sm flex gap-2"><Plus size={16}/> Novo</button>
                </div>
              </header>
              <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead><tr className="bg-black/40 text-zinc-400 text-xs border-b border-white/10"><th className="p-4">ID</th><th className="p-4">Data</th><th className="p-4">Cliente</th><th className="p-4 text-center">Peso</th><th className="p-4 text-right">#</th></tr></thead>
                  <tbody className="divide-y divide-white/5">{filaProducao.map(r => <tr key={r.sysId} className="hover:bg-white/5"><td className="p-4 text-blue-400 font-mono">#{r.id}</td>
                  <td className="p-4 text-zinc-300">{formatarDataBR(r.data)}</td>
                  <td className="p-4">{r.cliente}</td><td className="p-4 text-center">{r.itens.reduce((a,b)=>a+parseFloat(b.pesoTotal||0),0).toFixed(1)}</td><td className="p-4 text-right"><button onClick={()=>deletarRomaneio(r.sysId)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button></td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* OEE */}
          {abaAtiva === 'oee' && (
            <div className="flex-1 bg-[#09090b] p-8 overflow-y-auto">
               <header className="flex justify-between items-center mb-8">
                 <h1 className="text-3xl font-bold flex gap-3 text-white"><Activity className="text-emerald-500" size={32} /> Indicadores OEE</h1>
                 <div className="flex items-center gap-4 bg-zinc-900 px-4 py-2 rounded-lg border border-white/10"><span className="text-xs text-zinc-500 uppercase font-bold">Turno:</span><input type="number" value={turnoHoras} onChange={e=>setTurnoHoras(e.target.value)} className="bg-black border border-white/10 rounded w-16 p-1 text-center text-white" /><span className="text-xs text-zinc-500">Horas</span></div>
               </header>
               <div className="grid grid-cols-4 gap-6 mb-8">
                  <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center"><GaugeChart value={dadosOEE.oee} color="#10b981" label="OEE Global" /></div>
                  <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center"><GaugeChart value={dadosOEE.disponibilidade} color="#3b82f6" label="Disponibilidade" /><div className="text-[10px] text-zinc-500 mt-2">{dadosOEE.tempoProduzindo} min rodando</div></div>
                  <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center"><GaugeChart value={dadosOEE.performance} color="#f59e0b" label="Performance" /></div>
                  <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center"><GaugeChart value={dadosOEE.qualidade} color="#ec4899" label="Qualidade" /></div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                   <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><PieChart size={20}/> Motivos de Parada</h3><div className="space-y-3">{dadosOEE.listaPareto.map((item, idx) => (<div key={idx} className="flex items-center gap-3"><span className="text-xs font-mono text-zinc-500 w-6">#{idx+1}</span><div className="flex-1"><div className="flex justify-between text-xs mb-1"><span className="text-zinc-300">{item.motivo}</span><span className="text-red-400 font-bold">{item.tempo} min</span></div><div className="w-full bg-black h-1.5 rounded-full overflow-hidden"><div className="bg-red-500 h-full" style={{width: `${(item.tempo / dadosOEE.tempoParadoTotal)*100}%`}}></div></div></div></div>))}</div></div>
                   <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col justify-center items-center text-center"><div className="text-4xl font-black text-white mb-2">{dadosOEE.tempoParadoTotal} <span className="text-lg text-zinc-500 font-normal">minutos</span></div><p className="text-zinc-400 text-sm uppercase font-bold tracking-widest">Tempo Total Parado</p><div className="mt-6 w-full h-4 bg-black rounded-full overflow-hidden flex"><div className="bg-emerald-500 h-full" style={{width: `${dadosOEE.disponibilidade}%`}}></div><div className="bg-red-500 h-full" style={{width: `${100 - dadosOEE.disponibilidade}%`}}></div></div></div>
               </div>
            </div>
          )}

          {/* PRODUÇÃO */}
          {abaAtiva === 'producao' && (
            <div className="flex-1 bg-[#09090b] p-8 overflow-hidden flex flex-col">
               <header className="flex justify-between items-center mb-8 shrink-0"><h1 className="text-3xl font-bold flex gap-3 text-white"><Factory className="text-emerald-500" size={32} /> Apontamento de Produção</h1></header>
               <div className="flex gap-6 h-full min-h-0">
                  <div className="w-1/3 bg-zinc-900 rounded-2xl border border-emerald-500/20 p-6 flex flex-col overflow-y-auto">
                      <h3 className="text-lg font-bold text-emerald-400 mb-6 flex items-center gap-2"><Box size={20}/> Registrar Peça</h3>
                      <div className="space-y-5">
                          <div><label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Data</label><input type="date" value={formApontProdData} onChange={e=>setFormApontProdData(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white"/></div>
                          <div><label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Código</label><select value={formApontProdCod} onChange={handleSelectProdApontamento} className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm"><option value="">Selecione...</option>{CATALOGO_PRODUTOS.map(p => <option key={p.cod} value={p.cod}>{p.cod} - {p.desc}</option>)}</select></div>
                          <div><label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Descrição</label><input value={formApontProdDesc} readOnly className="w-full bg-zinc-950 border border-white/5 rounded p-3 text-zinc-400 cursor-not-allowed"/></div>
                          <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Qtd</label><input type="number" value={formApontProdQtd} onChange={e=>setFormApontProdQtd(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white text-right font-bold text-lg"/></div><div><label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Destino</label><select value={formApontProdDestino} onChange={e=>setFormApontProdDestino(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm"><option value="Estoque">Estoque</option><option value="Cometa 04">Cometa 04</option><option value="Serra 06">Serra 06</option></select></div></div>
                          <button onClick={salvarApontamentoProducao} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold shadow-lg transition-colors flex items-center justify-center gap-2 mt-4"><CheckCircle2 size={20}/> Confirmar Produção</button>
                      </div>
                  </div>
                  <div className="flex-1 bg-zinc-900 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                      <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2"><History size={18}/> Produzido Hoje</h3><span className="text-xs text-zinc-400">Itens: <strong className="text-white">{historicoProducaoReal.filter(i=>i.data === formApontProdData).length}</strong></span></div>
                      <div className="flex-1 overflow-y-auto">
                          <table className="w-full text-left text-sm"><thead className="bg-black/20 text-zinc-500 text-xs uppercase sticky top-0 backdrop-blur"><tr><th className="p-4">Código</th><th className="p-4">Descrição</th><th className="p-4 text-center">Qtd</th><th className="p-4">Destino</th><th className="p-4 text-right">#</th></tr></thead>
                            <tbody className="divide-y divide-white/5">{historicoProducaoReal.filter(p => p.data === formApontProdData).length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-zinc-600 italic">Nenhum apontamento nesta data.</td></tr> : historicoProducaoReal.filter(p => p.data === formApontProdData).map(p => (<tr key={p.id} className="hover:bg-white/5"><td className="p-4 font-mono text-emerald-400">{p.cod}</td><td className="p-4 text-zinc-300">{p.desc}</td><td className="p-4 text-center font-bold text-white">{p.qtd}</td><td className="p-4"><span className="text-[10px] uppercase font-bold text-zinc-500 border border-white/10 px-2 py-1 rounded">{p.destino}</span></td><td className="p-4 text-right"><button onClick={()=>deletarProducaoReal(p.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody>
                          </table>
                      </div>
                  </div>
               </div>
            </div>
          )}

          {/* APONTAMENTO PARADAS */}
          {abaAtiva === 'apontamento' && (
            <div className="flex-1 bg-[#09090b] p-8 overflow-hidden flex flex-col">
               <header className="flex justify-between items-center mb-8 shrink-0"><h1 className="text-3xl font-bold flex gap-3 text-white"><AlertOctagon className="text-red-500" size={32} /> Apontamento de Paradas</h1></header>
               <div className="flex gap-6 h-full min-h-0">
                  <div className="w-1/3 bg-zinc-900 rounded-2xl border border-red-500/20 p-6 flex flex-col overflow-y-auto">
                      <h3 className="text-lg font-bold text-red-400 mb-6 flex items-center gap-2"><Clock size={20}/> Registrar Evento</h3>
                      <div className="space-y-5">
                          <div><label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Data do Evento</label><input type="date" value={formParadaData} onChange={e=>setFormParadaData(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white"/></div>
                          <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Início</label><input type="time" value={formParadaInicio} onChange={e=>setFormParadaInicio(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white"/></div><div><label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Fim</label><input type="time" value={formParadaFim} onChange={e=>setFormParadaFim(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white"/></div></div>
                          <div><div className="flex justify-between mb-1"><label className="text-xs font-bold text-zinc-500 uppercase">Motivo</label><label className="text-[10px] text-blue-400 cursor-pointer flex items-center gap-1 hover:underline"><Upload size={10}/><input type="file" className="hidden" onChange={handleUploadDicionario} accept=".xlsx,.csv"/> Atualizar Lista</label></div><select value={formParadaMotivoCod} onChange={e=>setFormParadaMotivoCod(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm"><option value="">Selecione...</option>{dicionarioLocal.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.evento}</option>)}</select></div>
                          <div><label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Obs</label><textarea value={formParadaObs} onChange={e=>setFormParadaObs(e.target.value)} className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm h-24"></textarea></div>
                          <button onClick={salvarApontamentoParada} className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2">Confirmar</button>
                      </div>
                  </div>
                  <div className="flex-1 bg-zinc-900 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="bg-black/20 text-zinc-500 text-xs uppercase sticky top-0 backdrop-blur"><tr><th className="p-4">Horário</th><th className="p-4">Motivo</th><th className="p-4 text-right">#</th></tr></thead><tbody className="divide-y divide-white/5">{historicoParadas.filter(p => p.data === formParadaData).map(p => (<tr key={p.id} className="hover:bg-white/5"><td className="p-4 font-mono text-zinc-300">{p.inicio} - {p.fim} ({p.duracao}min)</td><td className="p-4">{p.descMotivo}</td><td className="p-4 text-right"><button onClick={()=>deletarParada(p.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
                  </div>
               </div>
            </div>
          )}

          {/* INDICADORES (CARGA) */}
          {abaAtiva === 'indicadores' && (
             <div className="flex-1 bg-[#09090b] p-8 overflow-y-auto">
               <header className="flex justify-between items-end mb-8"><h1 className="text-3xl font-bold flex gap-3"><TrendingUp className="text-pink-500" size={32} /> Carga de Máquina</h1><div className="flex gap-4 bg-zinc-900 p-4 rounded-xl border border-white/10"><div><label className="text-[10px] text-zinc-500 block">Início</label><input type="date" value={dataInicioInd} onChange={e => setDataInicioInd(e.target.value)} className="bg-black border border-white/10 rounded p-1 text-white text-sm" /></div><div><label className="text-[10px] text-zinc-500 block">Fim</label><input type="date" value={dataFimInd} onChange={e => setDataFimInd(e.target.value)} className="bg-black border border-white/10 rounded p-1 text-white text-sm" /></div><div><label className="text-[10px] text-pink-500 block">Meta/Dia</label><input type="number" value={capacidadeDiaria} onChange={e => setCapacidadeDiaria(e.target.value)} className="bg-black border border-pink-500/30 rounded p-1 text-white text-sm w-24 text-right" /></div></div></header>
               <div className="grid grid-cols-4 gap-6 mb-8"><CardIndicador label="Total Ton" valor={(dadosIndicadores.totalPeso/1000).toFixed(1)} icon={<Scale size={24} className="text-emerald-500"/>} /><CardIndicador label="Itens" valor={dadosIndicadores.totalItens} icon={<Box size={24} className="text-purple-500"/>} /></div>
               <div className="bg-zinc-900 rounded-xl border border-white/10 p-6 h-[400px] flex items-end justify-between gap-2 mb-8">{dadosIndicadores.arrayGrafico.map((dia, idx) => { const isOverload = dia.peso > capacidadeDiaria; return (<div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative"><span className={`text-[10px] font-bold mb-2 ${isOverload ? 'text-red-400' : 'text-zinc-400'}`}>{dia.peso > 0 ? `${(dia.peso/1000).toFixed(1)}t` : ''}</span><div className={`w-full rounded-t transition-all hover:brightness-110 ${isOverload ? 'bg-red-500' : 'bg-emerald-600'}`} style={{height: `${Math.max((dia.peso/(capacidadeDiaria*1.5))*100, 2)}%`}}></div><span className="text-[10px] text-zinc-500 mt-2">{formatarDataBR(dia.data).slice(0,5)}</span></div>) })}</div>
             </div>
          )}

          {/* PRODUTOS */}
          {abaAtiva === 'produtos' && (
             <div className="flex-1 bg-[#09090b] p-8 overflow-y-auto">
               <h1 className="text-3xl font-bold mb-8 text-white">Catálogo</h1>
               <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
                 <table className="w-full text-left text-sm">
                   <thead><tr className="bg-black/40 text-zinc-400 text-xs border-b border-white/10"><th className="p-4">Código</th><th className="p-4">Descrição</th></tr></thead>
                   <tbody className="divide-y divide-white/5">
                    {CATALOGO_PRODUTOS && CATALOGO_PRODUTOS.length > 0 ? 
                        CATALOGO_PRODUTOS.map(p => <tr key={p.cod}><td className="p-4 text-emerald-400 font-mono">{p.cod}</td><td className="p-4 text-white">{p.desc}</td></tr>) : 
                        <tr><td colSpan="2" className="p-8 text-center text-zinc-500">Nenhum produto.</td></tr>}
                   </tbody>
                 </table>
               </div>
             </div>
          )}
        </div>
      </div>

      {/* MODAL NOVA ORDEM (COMPLETO) */}
      {showModalNovaOrdem && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-4xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-xl font-bold text-white">{romaneioEmEdicaoId ? 'Editar Romaneio' : 'Novo Romaneio'}</h3>
              <button onClick={()=>setShowModalNovaOrdem(false)} className="text-zinc-400 hover:text-white"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-3"><label className="text-xs font-bold text-blue-400 block mb-1">Nº Romaneio</label><div className="flex gap-2"><input value={formRomaneioId} onChange={e=>setFormRomaneioId(e.target.value)} className="w-full bg-black/50 border border-blue-500/30 rounded p-2 text-white outline-none focus:border-blue-500 font-mono font-bold" readOnly={isEstoque}/><button type="button" onClick={toggleEstoque} className="px-2 border rounded text-xs">{isEstoque?'EST':'PED'}</button></div></div>
                  <div className="col-span-3"><label className="text-xs font-bold text-zinc-500 block mb-1">Data Produção</label><input type="date" value={formDataProducao} onChange={e=>setFormDataProducao(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-blue-500"/></div>
                  <div className="col-span-4"><label className="text-xs font-bold text-zinc-500 block mb-1">Cliente</label><input value={formCliente} onChange={e=>setFormCliente(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-blue-500" readOnly={isEstoque}/></div>
                  <div className="col-span-2"><label className="text-xs font-bold text-zinc-500 block mb-1">TOTVS</label><input value={formTotvs} onChange={e=>setFormTotvs(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-blue-500" readOnly={isEstoque}/></div>
               </div>
               <div className="w-full h-px bg-white/10 my-2"></div>
               <div className="bg-zinc-800/30 p-4 rounded-xl border border-white/5 space-y-4">
                   <div className="flex gap-4">
                        <div className="flex-1"><label className="text-[10px] font-bold text-zinc-500 block mb-1">Produto</label><select value={formCod} onChange={handleSelectProduto} className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-white text-sm"><option value="">Manual...</option>{CATALOGO_PRODUTOS.map(p=><option key={p.cod} value={p.cod}>{p.cod} - {p.desc}</option>)}</select></div>
                        <div className="w-[120px]"><label className="text-[10px] font-bold text-zinc-500 block mb-1">Comp (m)</label><input type="number" step="0.01" value={formComp} onChange={e=>setFormComp(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-white text-sm"/></div>
                        <div className="w-[100px]"><label className="text-[10px] font-bold text-zinc-500 block mb-1">Qtd</label><input type="number" value={formQtd} onChange={e=>setFormQtd(e.target.value)} className="w-full bg-black border border-blue-500/50 rounded p-2 text-white text-sm text-right"/></div>
                   </div>
                   <div><label className="text-[10px] font-bold text-zinc-500 block mb-1">Descrição</label><input value={formDesc} onChange={e=>setFormDesc(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-white text-sm"/></div>
                   <div className="flex justify-end"><button onClick={adicionarItemNaLista} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold flex items-center gap-2"><PlusCircle size={18}/> Adicionar Item</button></div>
               </div>
               <div className="bg-zinc-950 rounded-xl border border-white/10 overflow-hidden min-h-[100px]">
                   <table className="w-full text-left text-sm"><thead><tr className="bg-white/5 text-xs text-zinc-500"><th>Item</th><th className="text-center">Med</th><th className="text-center">Qtd</th><th className="text-right">Peso Total</th><th className="text-right">#</th></tr></thead>
                   <tbody className="divide-y divide-white/5">{itensNoPedido.map(i=><tr key={i.tempId}><td className="p-3 text-zinc-300"><b>{i.desc}</b><div className="text-[10px]">{i.cod}</div></td><td className="p-3 text-center">{i.comp}</td><td className="p-3 text-center font-bold text-white">{i.qtd}</td><td className="p-3 text-right">{i.pesoTotal}</td><td className="p-3 text-right"><button onClick={()=>removerItemDaLista(i.tempId)} className="text-zinc-500 hover:text-red-400"><Trash2 size={16}/></button></td></tr>)}</tbody></table>
               </div>
               {itensNoPedido.length > 0 && <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex justify-end gap-8 items-center"><div className="text-zinc-400 text-sm">Peças: <strong className="text-white">{qtdTotalAcumuladaModal}</strong></div><div className="text-zinc-400 flex items-center gap-2 text-lg"><Scale size={20} className="text-emerald-500"/> Peso Total: <strong className="text-emerald-400 text-xl">{pesoTotalAcumuladoModal.toFixed(2)} kg</strong></div></div>}
            </div>
            <div className="p-6 border-t border-white/10 bg-white/5 flex gap-3 justify-end">
              <button onClick={()=>setShowModalNovaOrdem(false)} className="px-6 py-3 bg-zinc-800 text-white rounded-lg font-bold border border-white/10">Cancelar</button>
              <button onClick={salvarRomaneio} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"><ArrowRight size={20}/> Salvar Romaneio</button>
            </div>
          </div>
        </div>
      )}

      {showModalParada && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-lg border border-red-500/30 shadow-2xl flex flex-col p-6">
             <h3 className="text-xl font-bold text-red-400 mb-4">Apontar Parada</h3>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4"><input type="time" value={formParadaInicio} onChange={e=>setFormParadaInicio(e.target.value)} className="bg-black border border-white/10 rounded p-2 text-white"/><input type="time" value={formParadaFim} onChange={e=>setFormParadaFim(e.target.value)} className="bg-black border border-white/10 rounded p-2 text-white"/></div>
                <select value={formParadaMotivoCod} onChange={e=>setFormParadaMotivoCod(e.target.value)} className="w-full bg-black border border-white/10 rounded p-2 text-white"><option value="">Motivo...</option>{dicionarioLocal.map(p=><option key={p.codigo} value={p.codigo}>{p.evento}</option>)}</select>
             </div>
             <div className="mt-6 flex justify-end gap-3">
                <button onClick={()=>setShowModalParada(false)} className="px-4 py-2 bg-zinc-800 text-white rounded">Cancelar</button>
                <button onClick={salvarApontamentoParada} className="px-6 py-2 bg-red-600 text-white rounded">Salvar</button>
             </div>
          </div>
        </div>
      )}
    </>
  );
}

const CardIndicador = ({ label, valor, icon }) => (
    <div className="bg-zinc-900 p-4 rounded-xl border border-white/10 flex items-center gap-4">
        <div className="p-2 bg-zinc-950 rounded border border-white/5">{icon}</div>
        <div><div className="text-zinc-500 text-[10px] uppercase font-bold">{label}</div><div className="text-xl font-bold text-white">{valor}</div></div>
    </div>
);

const ColunaKanban = ({ titulo, data, cor, lista, resumo, onEdit }) => (
    <div className="flex flex-col h-full bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-lg">
       <div className="p-4 border-b border-white/5 bg-zinc-900/80"><div className="flex justify-between mb-1"><h2 className={`text-lg font-black ${cor==='emerald'?'text-emerald-400':'text-blue-400'}`}>{titulo}</h2><span className="text-xs text-zinc-500">{formatarDataBR(data)}</span></div><div className="text-xs text-zinc-400">Peso: <strong className="text-white">{(resumo.peso/1000).toFixed(1)}t</strong></div></div>
       <div className="flex-1 overflow-y-auto p-4 space-y-3">{lista.map(r=><CardRomaneio key={r.sysId} romaneio={r} onEdit={()=>onEdit(r)}/>)}</div>
    </div>
);

const CardRomaneio = ({ romaneio, onEdit }) => (
  <div className="bg-black/40 border border-white/5 rounded-xl p-3 hover:border-white/20 group relative">
    <div className="flex justify-between mb-1"><span className="text-[10px] font-bold bg-zinc-800 px-1 rounded text-zinc-400">#{romaneio.id}</span><button onClick={onEdit} className="opacity-0 group-hover:opacity-100"><Pencil size={12} className="text-zinc-500"/></button></div>
    <div className="font-bold text-white text-sm truncate">{romaneio.cliente}</div>
    <div className="flex justify-between mt-2 text-[10px] text-zinc-500"><span>{romaneio.itens.length} itens</span><span className="text-zinc-300">{romaneio.itens.reduce((a,b)=>a+parseFloat(b.pesoTotal||0),0).toFixed(0)}kg</span></div>
  </div>
);

const BotaoMenu = ({ ativo, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full p-3 rounded-xl flex flex-col items-center gap-1 ${ativo ? 'bg-white/10 text-pink-500' : 'text-zinc-500 hover:bg-white/5'}`}>{icon}<span className="text-[10px] font-bold uppercase">{label}</span></button>
);