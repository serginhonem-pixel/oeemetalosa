import React, { useState, useEffect, useRef } from 'react';
import { Layers, Plus, BarChart3, X, Settings, Calendar, Hash, Tag, Upload, Download, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { safeAddDoc } from '../services/firebaseSafeWrites';
import { IS_PRODUCTION } from '../services/firebase';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList, LineChart, Line } from 'recharts';

const ProcessosScreen = () => {
    const [processo, setProcesso] = useState('');
    const [quantidade, setQuantidade] = useState('');
    const [mes, setMes] = useState('');
    const [ano, setAno] = useState('2025');
    const [showModalCadastro, setShowModalCadastro] = useState(false);
    const [novoProcessoCustomizado, setNovoProcessoCustomizado] = useState('');
    const [showModalImportacao, setShowModalImportacao] = useState(false);
    const [dadosImportacao, setDadosImportacao] = useState([]);
    const [importando, setImportando] = useState(false);
    const fileInputRef = useRef(null);

    const [novoProcesso, setNovoProcesso] = useState({
        nome: '',
        codigo: '',
        descricao: ''
    });

    // Dados da tabela
    const [dadosProcessos, setDadosProcessos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showLancamentoForm, setShowLancamentoForm] = useState(true);
    const [filtroTipo, setFiltroTipo] = useState('Todos');
    const [editingId, setEditingId] = useState(null);

    // Extrair tipos únicos de processos da tabela
    const tiposProcessosUnicos = [...new Set(dadosProcessos.map(item => item.tipo))].sort();
    const tiposParaLegenda = tiposProcessosUnicos.filter(tipo => !['Todos carrinhos', 'Todo consumo', 'Todo o consumo'].includes(tipo));

    // Adicionar opção "Outro" se não estiver na lista
    const opcoesProcessos = tiposProcessosUnicos.length > 0 
        ? (tiposProcessosUnicos.includes('Outro') ? tiposProcessosUnicos : [...tiposProcessosUnicos, 'Outro'])
        : ['Corte', 'Dobramento', 'Pintura', 'Outro']; // Opções padrão se não houver dados

    // Funções auxiliares para persistência local
    const salvarProcessoLocal = (processo) => {
        const processosAtuais = JSON.parse(localStorage.getItem('processos') || '[]');
        processosAtuais.push(processo);
        localStorage.setItem('processos', JSON.stringify(processosAtuais));
    };

    const carregarProcessosLocal = () => {
        const processos = JSON.parse(localStorage.getItem('processos') || '[]');
        setDadosProcessos(processos);
        setLoading(false);
    };

    // Carregar dados
    useEffect(() => {
        if (IS_PRODUCTION) {
            // Em produção: carregar do Firebase
            const q = query(collection(db, 'processos'), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const processos = [];
                querySnapshot.forEach((doc) => {
                    processos.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                setDadosProcessos(processos);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            // Em desenvolvimento: carregar do localStorage
            carregarProcessosLocal();
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!processo || !quantidade || !mes || !ano) return;

        // Usar o processo customizado se "Outro" foi selecionado
        const tipoProcessoFinal = processo === 'Outro' ? novoProcessoCustomizado : processo;
        if (!tipoProcessoFinal) return;

        try {
            // Se estivermos editando um registro existente
            if (editingId) {
                const atualizado = {
                    quantidade: parseInt(quantidade),
                    mes: `${mes} ${ano}`,
                    tipo: tipoProcessoFinal,
                    updatedAt: new Date()
                };

                if (IS_PRODUCTION) {
                    // Atualizar no Firestore
                    const ref = doc(db, 'processos', editingId);
                    await updateDoc(ref, atualizado);
                } else {
                    // Atualizar no localStorage
                    const processosAtuais = JSON.parse(localStorage.getItem('processos') || '[]');
                    const novos = processosAtuais.map(p => p.id === editingId ? { ...p, ...atualizado } : p);
                    localStorage.setItem('processos', JSON.stringify(novos));
                    setDadosProcessos(novos);
                }

                // Limpar estado de edição
                setEditingId(null);
            } else {
                const novoDado = {
                    id: `local-${Date.now()}`,
                    quantidade: parseInt(quantidade),
                    mes: `${mes} ${ano}`,
                    tipo: tipoProcessoFinal,
                    createdAt: new Date()
                };

                if (IS_PRODUCTION) {
                    // Em produção: salvar no Firebase
                    await safeAddDoc('processos', novoDado);
                } else {
                    // Em desenvolvimento: salvar no localStorage
                    salvarProcessoLocal(novoDado);
                    // Atualizar estado imediatamente
                    setDadosProcessos(prev => [novoDado, ...prev]);
                }
            }

            // Reset form
            setProcesso('');
            setQuantidade('');
            setMes('');
            setNovoProcessoCustomizado('');
            setEditingId(null);
            // Mantém o ano atual como padrão

        } catch (error) {
            console.error('Erro ao salvar processo:', error);
            // Aqui você pode adicionar uma notificação de erro para o usuário
        }
    };

    const handleCadastroProcesso = (e) => {
        e.preventDefault();
        // Lógica para cadastrar novo processo
        console.log('Novo processo:', novoProcesso);
        // Reset form
        setNovoProcesso({ nome: '', codigo: '', descricao: '' });
        setShowModalCadastro(false);
    };

    // Funções de importação
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const fileExtension = file.name.split('.').pop().toLowerCase();

        if (fileExtension === 'csv') {
            // Processar CSV
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                parseCSV(text);
            };
            reader.readAsText(file);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            // Processar Excel
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                parseExcel(jsonData);
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert('Formato de arquivo não suportado. Use apenas arquivos .csv, .xlsx ou .xls');
        }
    };

    const parseCSV = (csvText) => {
        const lines = csvText.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Verificar se os headers estão corretos
        const expectedHeaders = ['processo', 'quantidade', 'mes', 'ano'];
        const hasValidHeaders = expectedHeaders.every(header =>
            headers.includes(header)
        );

        if (!hasValidHeaders) {
            alert('Formato inválido! O CSV deve ter as colunas: processo, quantidade, mes, ano');
            return;
        }

        const parsedData = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length >= 4) {
                const [processo, quantidade, mes, ano] = values;
                if (processo && quantidade && mes && ano) {
                    parsedData.push({
                        tipo: processo,
                        quantidade: parseInt(quantidade),
                        mes: `${mes} ${ano}`,
                        createdAt: new Date()
                    });
                }
            }
        }

        setDadosImportacao(parsedData);
    };

    const parseExcel = (excelData) => {
        if (!excelData || excelData.length === 0) {
            alert('Arquivo Excel vazio ou inválido!');
            return;
        }

        // Verificar se os headers estão corretos (case insensitive)
        const firstRow = excelData[0];
        const headers = Object.keys(firstRow).map(h => h.toLowerCase().trim());

        // Verificar se tem as colunas necessárias
        const expectedHeaders = ['tipo', 'quantidade', 'mes', 'ano'];
        const hasValidHeaders = expectedHeaders.every(header =>
            headers.includes(header)
        );

        if (!hasValidHeaders) {
            alert('Formato inválido! O Excel deve ter as colunas: Tipo, Quantidade, Mes, Ano');
            return;
        }

        const parsedData = [];
        for (const row of excelData) {
            const tipo = row.Tipo || row.tipo;
            const quantidade = row.Quantidade || row.quantidade;
            const mes = row.Mes || row.mes;
            const ano = row.Ano || row.ano;

            if (tipo && quantidade && mes && ano) {
                parsedData.push({
                    tipo: String(tipo),
                    quantidade: parseInt(quantidade),
                    mes: `${String(mes)} ${String(ano)}`,
                    createdAt: new Date()
                });
            }
        }

        setDadosImportacao(parsedData);
    };

    const handleImportacao = async () => {
        if (dadosImportacao.length === 0) return;

        setImportando(true);
        try {
            if (IS_PRODUCTION) {
                // Importar para Firebase
                for (const dado of dadosImportacao) {
                    await safeAddDoc('processos', {
                        ...dado,
                        id: `import-${Date.now()}-${Math.random()}`
                    });
                }
            } else {
                // Importar para localStorage
                const processosAtuais = JSON.parse(localStorage.getItem('processos') || '[]');
                const novosProcessos = dadosImportacao.map(dado => ({
                    ...dado,
                    id: `import-${Date.now()}-${Math.random()}`
                }));

                const todosProcessos = [...novosProcessos, ...processosAtuais];
                localStorage.setItem('processos', JSON.stringify(todosProcessos));

                // Atualizar estado
                setDadosProcessos(todosProcessos);
            }

            alert(`✅ ${dadosImportacao.length} registros importados com sucesso!`);
            setShowModalImportacao(false);
            setDadosImportacao([]);

            // Limpar input file
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

        } catch (error) {
            console.error('Erro na importação:', error);
            alert('❌ Erro durante a importação. Verifique o console para mais detalhes.');
        } finally {
            setImportando(false);
        }
    };

    const downloadModeloCSV = () => {
        // Criar dados de exemplo para o modelo Excel
        const dadosModelo = [
            { Tipo: 'Corte', Quantidade: 1500, Mes: 'Janeiro', Ano: 2025 },
            { Tipo: 'Dobramento', Quantidade: 1800, Mes: 'Janeiro', Ano: 2025 },
            { Tipo: 'Pintura', Quantidade: 2000, Mes: 'Fevereiro', Ano: 2025 },
            { Tipo: 'Solda', Quantidade: 1200, Mes: 'Fevereiro', Ano: 2025 }
        ];

        // Criar uma nova planilha
        const ws = XLSX.utils.json_to_sheet(dadosModelo);

        // Criar um novo workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Processos');

        // Gerar o arquivo Excel
        XLSX.writeFile(wb, 'modelo_processos.xlsx');
    };

    // Processar dados para gráficos
    const processChartData = () => {
        const mesMap = {};
        
        dadosProcessos.forEach(item => {
            // Filtrar por tipo se não for "Todos"
            if (filtroTipo !== 'Todos' && item.tipo !== filtroTipo) return;
            
            const chaveMes = item.mes; // Já vem formatado como "Mês Ano"
            if (mesMap[chaveMes]) {
                mesMap[chaveMes] += item.quantidade;
            } else {
                mesMap[chaveMes] = item.quantidade;
            }
        });
        
        return Object.entries(mesMap)
            .map(([mes, quantidade]) => ({
                mes,
                quantidade
            }))
            .sort((a, b) => {
                // Ordenar por data (assumindo formato "Mês Ano")
                const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                const [mesA, anoA] = a.mes.split(' ');
                const [mesB, anoB] = b.mes.split(' ');
                
                if (anoA !== anoB) return parseInt(anoA) - parseInt(anoB);
                return meses.indexOf(mesA) - meses.indexOf(mesB);
            });
    };

    const processPieData = () => {
        const tipoMap = {};
        const tiposExcluir = ['Todos carrinhos', 'Todo consumo']; // Tipos a serem excluídos
        
        dadosProcessos.forEach(item => {
            if (tiposExcluir.includes(item.tipo)) return; // Ignorar tipos excluídos
            
            if (tipoMap[item.tipo]) {
                tipoMap[item.tipo] += item.quantidade;
            } else {
                tipoMap[item.tipo] = item.quantidade;
            }
        });
        return Object.entries(tipoMap).map(([tipo, quantidade]) => ({
            name: tipo,
            value: quantidade
        }));
    };

    const processTipoPorMesData = () => {
        const mesTipoMap = {};
        const tiposExcluir = ['Todos carrinhos', 'Todo consumo', 'Todo o consumo']; // Tipos a serem excluídos
        
        dadosProcessos.forEach(item => {
            if (tiposExcluir.includes(item.tipo)) return; // Ignorar tipos excluídos
            
            const chaveMes = item.mes;
            if (!mesTipoMap[chaveMes]) {
                mesTipoMap[chaveMes] = {};
            }
            if (mesTipoMap[chaveMes][item.tipo]) {
                mesTipoMap[chaveMes][item.tipo] += item.quantidade;
            } else {
                mesTipoMap[chaveMes][item.tipo] = item.quantidade;
            }
        });
        
        // Converter para formato adequado para gráfico de barras empilhadas
        const resultado = [];
        const tiposUnicos = [...new Set(dadosProcessos.filter(item => !tiposExcluir.includes(item.tipo)).map(item => item.tipo))];
        
        Object.keys(mesTipoMap).forEach((mes, index) => {
            const item = { mes, labelId: index }; // Adicionando labelId para renderizar labels
            tiposUnicos.forEach(tipo => {
                item[tipo] = mesTipoMap[mes][tipo] || 0;
            });
            resultado.push(item);
        });
        
        return resultado.sort((a, b) => {
            // Ordenar por data
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const [mesA, anoA] = a.mes.split(' ');
            const [mesB, anoB] = b.mes.split(' ');
            
            if (anoA !== anoB) return parseInt(anoA) - parseInt(anoB);
            return meses.indexOf(mesA) - meses.indexOf(mesB);
        });
    };

    // Calcular variações mensais
    const calcularVariacaoMensal = () => {
        const dadosOrdenados = chartData.sort((a, b) => {
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const [mesA, anoA] = a.mes.split(' ');
            const [mesB, anoB] = b.mes.split(' ');
            
            if (anoA !== anoB) return parseInt(anoA) - parseInt(anoB);
            return meses.indexOf(mesA) - meses.indexOf(mesB);
        });

        return dadosOrdenados.map((item, index) => {
            if (index === 0) {
                return { ...item, variacao: null, simbolo: '' };
            }
            
            const anterior = dadosOrdenados[index - 1].quantidade;
            const atual = item.quantidade;
            const diferenca = atual - anterior;
            const percentual = anterior > 0 ? ((diferenca / anterior) * 100) : 0;
            
            let simbolo = '';
            if (diferenca > 0) simbolo = '↗️';
            else if (diferenca < 0) simbolo = '↘️';
            else simbolo = '➡️';
            
            return {
                ...item,
                variacao: diferenca,
                percentual: percentual,
                simbolo: simbolo
            };
        });
    };

    // Label customizado: seta (▲/▼) + porcentagem em cima, valor formatado abaixo
    const CustomBarLabel = ({ x, y, width, value, payload, index }) => {
        const formatted = Number(value).toLocaleString('pt-BR');

        // tentar obter percentual do payload; se não existir, calcular via dadosComVariacao pelo índice
        let pctRaw = null;
        if (payload && (payload.percentual !== undefined)) {
            pctRaw = Number(payload.percentual);
        } else if (typeof index === 'number' && dadosComVariacao && dadosComVariacao.length > 0) {
            const prev = dadosComVariacao[index - 1];
            if (prev && prev.quantidade && prev.quantidade !== 0) {
                pctRaw = ((value - prev.quantidade) / prev.quantidade) * 100;
            }
        }

        // posição no canto superior esquerdo da barra (início da coluna)
        const cornerX = x + 6; // 6px de padding da borda esquerda da barra
        const cornerPctY = y - 10; // levemente acima do topo da barra
        // quando existe porcentagem colocamos o valor um pouco abaixo do topo (para não sobrepor)
        const valY = (pctRaw === null || Number.isNaN(pctRaw)) ? (y - 8) : (y + 14);

        if (pctRaw === null || Number.isNaN(pctRaw)) {
            return (
                <g>
                    <text x={x + width / 2} y={valY} fill="#F9FAFB" fontSize={14} fontWeight={800} textAnchor="middle">{formatted}</text>
                </g>
            );
        }

        const pct = pctRaw; // já em %
        const pctText = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
        const color = pct > 0 ? '#22c55e' : pct < 0 ? '#ef4444' : '#9CA3AF';
        const arrowChar = pct > 0 ? '▲' : pct < 0 ? '▼' : '▶';

        return (
            <g>
                <text x={cornerX} y={cornerPctY} fill={color} fontSize={14} fontWeight={900} textAnchor="start">{arrowChar} {pctText}</text>
                <text x={x + width / 2} y={valY} fill="#F9FAFB" fontSize={14} fontWeight={800} textAnchor="middle">{formatted}</text>
            </g>
        );
    };

    // Label customizado para gráfico empilhado - mostra total da coluna e variação
    const CustomStackedLabel = ({ x, y, width, payload }) => {
        if (!payload) return null;
        
        const tiposExcluir = ['Todos carrinhos', 'Todo consumo', 'Todo o consumo'];
        let total = 0;
        
        // Calcular o total somando todos os tipos (exceto os excluídos)
        Object.entries(payload).forEach(([key, value]) => {
            if (!tiposExcluir.includes(key) && key !== 'mes' && typeof value === 'number') {
                total += value;
            }
        });
        
        if (total === 0) return null;
        
        const formatted = total.toLocaleString('pt-BR');
        const centerX = x + width / 2;
        const totalY = y - 25; // total no topo da barra (acima)
        
        // Calcular variação em relação ao mês anterior
        const mesCurrent = payload.mes;
        const mesIndex = tipoPorMesData.findIndex(d => d.mes === mesCurrent);
        let pctText = '';
        let color = '#9CA3AF';
        let arrowChar = '';
        
        if (mesIndex > 0) {
            const mesPrev = tipoPorMesData[mesIndex - 1];
            let totalPrev = 0;
            Object.entries(mesPrev).forEach(([key, value]) => {
                if (!tiposExcluir.includes(key) && key !== 'mes' && typeof value === 'number') {
                    totalPrev += value;
                }
            });
            
            if (totalPrev > 0) {
                const pct = ((total - totalPrev) / totalPrev) * 100;
                pctText = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
                color = pct > 0 ? '#22c55e' : pct < 0 ? '#ef4444' : '#9CA3AF';
                arrowChar = pct > 0 ? '▲' : pct < 0 ? '▼' : '▶';
            }
        }
        
        return (
            <g>
                <text 
                    x={centerX} 
                    y={totalY} 
                    fill="#F9FAFB" 
                    fontSize={15} 
                    fontWeight={900} 
                    textAnchor="middle"
                >
                    {formatted}
                </text>
                {pctText && (
                    <text 
                        x={centerX} 
                        y={totalY + 18} 
                        fill={color} 
                        fontSize={13} 
                        fontWeight={800} 
                        textAnchor="middle"
                    >
                        {arrowChar} {pctText}
                    </text>
                )}
            </g>
        );
    };

    const chartData = processChartData();
    const pieChartData = processPieData();
    const tipoPorMesData = processTipoPorMesData();
    const dadosComVariacao = calcularVariacaoMensal();

    // Funções para novos gráficos e insights
    const calcularKPIs = () => {
        if (dadosComVariacao.length === 0) {
            return { total: 0, media: 0, maiorMes: 0, maiorMesNome: '', menorMes: 0, menorMesNome: '' };
        }
        
        const total = dadosComVariacao.reduce((acc, d) => acc + d.quantidade, 0);
        const media = Math.round(total / dadosComVariacao.length);
        const maiorMes = Math.max(...dadosComVariacao.map(d => d.quantidade));
        const maiorMesNome = dadosComVariacao.find(d => d.quantidade === maiorMes)?.mes || '';
        const menorMes = Math.min(...dadosComVariacao.map(d => d.quantidade));
        const menorMesNome = dadosComVariacao.find(d => d.quantidade === menorMes)?.mes || '';
        
        return { total, media, maiorMes, maiorMesNome, menorMes, menorMesNome };
    };

    const getTop5Processos = () => {
        const tipoMap = {};
        const tiposExcluir = ['Todos carrinhos', 'Todo consumo', 'Todo o consumo']; // Tipos a excluir
        
        dadosProcessos.forEach(item => {
            if (tiposExcluir.includes(item.tipo)) return; // Ignorar tipos excluídos
            if (filtroTipo !== 'Todos' && item.tipo !== filtroTipo) return;
            tipoMap[item.tipo] = (tipoMap[item.tipo] || 0) + item.quantidade;
        });
        
        return Object.entries(tipoMap)
            .map(([tipo, quantidade]) => ({ tipo, quantidade }))
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, 5);
    };

    const calcularAcumulado = () => {
        let acumulado = 0;
        return dadosComVariacao.map(item => {
            acumulado += item.quantidade;
            return { mes: item.mes, acumulado, quantidade: item.quantidade };
        });
    };

    const kpis = calcularKPIs();
    const top5 = getTop5Processos();
    const acumuladoData = calcularAcumulado();

    // Cores para o gráfico de pizza
    const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

    return (
        <>
            <div className="flex-1 bg-[#09090b] px-4 pb-8 pt-5 md:px-6 md:pt-6 overflow-y-auto">
                <div className="w-full space-y-5">
                    <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                                <Layers className="text-purple-300" size={22} />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-white">Lançamento Anual por Processos</h1>
                                <p className="text-sm text-zinc-400">Registre os processos e suas quantidades anuais</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLancamentoForm(!showLancamentoForm)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors duration-200"
                            >
                                {showLancamentoForm ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                {showLancamentoForm ? 'Ocultar Lançamento' : 'Mostrar Lançamento'}
                            </button>
                            <button
                                onClick={() => setShowModalImportacao(true)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors duration-200"
                            >
                                <Upload size={18} />
                                Importar
                            </button>
                            <button
                                onClick={() => setShowModalCadastro(true)}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors duration-200"
                            >
                                <Settings size={18} />
                                Cadastrar Processo
                            </button>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Formulário de Lançamento (condicional) */}
                        {showLancamentoForm && (
                        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <Plus size={20} className="text-purple-400" />
                                Novo Lançamento
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="processo" className="text-sm font-medium text-zinc-300">
                                        Tipo/Grupo/Processo
                                    </label>
                                    <select
                                        id="processo"
                                        value={processo}
                                        onChange={(e) => {
                                            setProcesso(e.target.value);
                                            // Limpar campo customizado se não for "Outro"
                                            if (e.target.value !== 'Outro') {
                                                setNovoProcessoCustomizado('');
                                            }
                                        }}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                        required
                                    >
                                        <option value="">Selecione um processo</option>
                                        {opcoesProcessos.map((tipo, index) => (
                                            <option key={index} value={tipo}>
                                                {tipo}
                                            </option>
                                        ))}
                                    </select>
                                    {processo === 'Outro' && (
                                        <div className="mt-2">
                                            <input
                                                type="text"
                                                value={novoProcessoCustomizado}
                                                onChange={(e) => setNovoProcessoCustomizado(e.target.value)}
                                                className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                                placeholder="Digite o nome do novo processo"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="mes" className="text-sm font-medium text-zinc-300">
                                            Mês
                                        </label>
                                        <select
                                            id="mes"
                                            value={mes}
                                            onChange={(e) => setMes(e.target.value)}
                                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                            required
                                        >
                                            <option value="">Mês</option>
                                            <option value="Janeiro">Janeiro</option>
                                            <option value="Fevereiro">Fevereiro</option>
                                            <option value="Março">Março</option>
                                            <option value="Abril">Abril</option>
                                            <option value="Maio">Maio</option>
                                            <option value="Junho">Junho</option>
                                            <option value="Julho">Julho</option>
                                            <option value="Agosto">Agosto</option>
                                            <option value="Setembro">Setembro</option>
                                            <option value="Outubro">Outubro</option>
                                            <option value="Novembro">Novembro</option>
                                            <option value="Dezembro">Dezembro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="ano" className="text-sm font-medium text-zinc-300">
                                            Ano
                                        </label>
                                        <select
                                            id="ano"
                                            value={ano}
                                            onChange={(e) => setAno(e.target.value)}
                                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                            required
                                        >
                                            <option value="">Ano</option>
                                            <option value="2025">2025</option>
                                            <option value="2026">2026</option>
                                            <option value="2027">2027</option>
                                            <option value="2028">2028</option>
                                            <option value="2029">2029</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="quantidade" className="text-sm font-medium text-zinc-300">
                                            Quantidade
                                        </label>
                                        <input
                                            type="number"
                                            id="quantidade"
                                            value={quantidade}
                                            onChange={(e) => setQuantidade(e.target.value)}
                                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                            placeholder="0"
                                            min="0"
                                            required
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} />
                                    Lançar Processo
                                </button>
                            </form>
                        </div>
                        )}

                        {/* Gráfico de Processos */}
                        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <BarChart3 size={20} className="text-purple-400" />
                                    Análise de Processos por Mês
                                </h2>
                                
                                {/* Filtro por Tipo */}
                                <div className="flex items-center gap-3">
                                    <label htmlFor="filtroTipo" className="text-sm font-medium text-zinc-300">
                                        Filtrar por Tipo:
                                    </label>
                                    <select
                                        id="filtroTipo"
                                        value={filtroTipo}
                                        onChange={(e) => setFiltroTipo(e.target.value)}
                                        className="bg-black/60 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-sm"
                                    >
                                        <option value="Todos">Todos os Tipos</option>
                                        {tiposProcessosUnicos.map((tipo) => (
                                            <option key={tipo} value={tipo}>
                                                {tipo}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>                            {loading ? (
                                <div className="flex items-center justify-center h-64 text-zinc-500">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-2"></div>
                                        <p>Carregando dados...</p>
                                    </div>
                                </div>
                            ) : dadosProcessos.length === 0 ? (
                                <div className="flex items-center justify-center h-64 text-zinc-500">
                                    <div className="text-center">
                                        <BarChart3 size={32} className="mx-auto mb-2 opacity-50" />
                                        <p>Nenhum dado para exibir</p>
                                        <p className="text-xs">Importe dados ou lance processos para ver o gráfico</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Gráfico de Barras - Evolução por Mês */}
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-5">
                                            {filtroTipo === 'Todos' ? 'Produção Total por Mês' : `Produção de ${filtroTipo} por Mês`}
                                        </h3>
                                        <ResponsiveContainer width="100%" height={420}>
                                            <BarChart data={dadosComVariacao} margin={{ top: 70, right: 30, left: 20, bottom: 70 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeWidth={2} />
                                                <XAxis 
                                                    dataKey="mes" 
                                                    stroke="#9CA3AF"
                                                    fontSize={14}
                                                    fontWeight={600}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={80}
                                                />
                                                <YAxis 
                                                    stroke="#9CA3AF"
                                                    fontSize={14}
                                                    fontWeight={600}
                                                    tickFormatter={(value) => value.toLocaleString('pt-BR')}
                                                />
                                                <Tooltip 
                                                    contentStyle={{
                                                        backgroundColor: '#1F2937',
                                                        border: '2px solid #374151',
                                                        borderRadius: '12px',
                                                        color: '#F9FAFB',
                                                        fontSize: '15px',
                                                        padding: '16px',
                                                        fontWeight: 600
                                                    }}
                                                    formatter={(value, name, props) => {
                                                        if (name === 'quantidade') {
                                                            const item = props.payload;
                                                            let variacaoText = '';
                                                            if (item.variacao !== null) {
                                                                const sinal = item.variacao > 0 ? '+' : '';
                                                                variacaoText = `\nVariação: ${sinal}${item.variacao.toLocaleString('pt-BR')} (${item.percentual > 0 ? '+' : ''}${item.percentual.toFixed(1)}%) ${item.simbolo}`;
                                                            }
                                                            return [value.toLocaleString('pt-BR') + variacaoText, 'Quantidade'];
                                                        }
                                                        return [value.toLocaleString('pt-BR'), name];
                                                    }}
                                                    labelFormatter={(label) => `Mês: ${label}`}
                                                />
                                                <Bar dataKey="quantidade" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                                                    <LabelList dataKey="quantidade" content={CustomBarLabel} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Gráfico de Barras Empilhadas - Tipos por Mês */}
                                    {filtroTipo === 'Todos' && (
                                        <div>
                                            <h3 className="text-2xl font-bold text-white mb-5">Distribuição de Tipos por Mês</h3>
                                            <ResponsiveContainer width="100%" height={420}>
                                                <BarChart data={tipoPorMesData} margin={{ top: 70, right: 30, left: 20, bottom: 70 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeWidth={2} />
                                                    <XAxis 
                                                        dataKey="mes" 
                                                        stroke="#9CA3AF"
                                                        fontSize={14}
                                                        fontWeight={600}
                                                        angle={-45}
                                                        textAnchor="end"
                                                        height={80}
                                                    />
                                                    <YAxis 
                                                        stroke="#9CA3AF"
                                                        fontSize={14}
                                                        fontWeight={600}
                                                        tickFormatter={(value) => value.toLocaleString('pt-BR')}
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{
                                                            backgroundColor: '#1F2937',
                                                            border: '2px solid #374151',
                                                            borderRadius: '12px',
                                                            color: '#F9FAFB',
                                                            fontSize: '15px',
                                                            padding: '16px',
                                                            fontWeight: 600
                                                        }}
                                                        formatter={(value, name) => [value.toLocaleString('pt-BR'), name]}
                                                        labelFormatter={(label) => `Mês: ${label}`}
                                                    />
                                                    <Legend fontSize={13} wrapperStyle={{ fontSize: '13px', fontWeight: 600 }} />
                                                    {tiposParaLegenda.map((tipo, index) => (
                                                        <Bar 
                                                            key={tipo}
                                                            dataKey={tipo} 
                                                            stackId="a"
                                                            fill={COLORS[index % COLORS.length]} 
                                                            radius={index === tiposParaLegenda.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                                        />
                                                    ))}
                                                    <LabelList dataKey="labelId" content={CustomStackedLabel} position="top" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}

                                    {/* Gráfico de Pizza - Distribuição Geral por Tipo */}
                                    {filtroTipo === 'Todos' && (
                                        <div>
                                            <h3 className="text-3xl font-black text-white mb-6">Distribuição Geral por Tipo</h3>
                                            <ResponsiveContainer width="100%" height={450}>
                                                <PieChart>
                                                    <Pie
                                                        data={pieChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={true}
                                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                        outerRadius={130}
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                    >
                                                        {pieChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        contentStyle={{
                                                            backgroundColor: '#1F2937',
                                                            border: '2px solid #374151',
                                                            borderRadius: '12px',
                                                            color: '#F9FAFB',
                                                            fontSize: '15px',
                                                            padding: '16px',
                                                            fontWeight: 600
                                                        }}
                                                        formatter={(value) => [value.toLocaleString('pt-BR'), 'Quantidade']}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div className="bg-gradient-to-br from-blue-900/60 to-blue-800/30 border-2 border-blue-500/50 rounded-xl p-5 shadow-lg">
                                <div className="text-blue-300 text-base font-bold mb-2 tracking-wide">TOTAL ANUAL</div>
                                <div className="text-white text-5xl font-black mb-1">{kpis.total.toLocaleString('pt-BR')}</div>
                                <div className="text-blue-400 text-sm font-semibold">Unidades produzidas</div>
                            </div>
                            <div className="bg-gradient-to-br from-green-900/60 to-green-800/30 border-2 border-green-500/50 rounded-xl p-5 shadow-lg">
                                <div className="text-green-300 text-base font-bold mb-2 tracking-wide">MÉDIA MENSAL</div>
                                <div className="text-white text-5xl font-black mb-1">{kpis.media.toLocaleString('pt-BR')}</div>
                                <div className="text-green-400 text-sm font-semibold">Produção por mês</div>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-900/60 to-emerald-800/30 border-2 border-emerald-500/50 rounded-xl p-5 shadow-lg">
                                <div className="text-emerald-300 text-base font-bold mb-2 tracking-wide">MAIOR MÊS</div>
                                <div className="text-white text-5xl font-black mb-1">{kpis.maiorMes.toLocaleString('pt-BR')}</div>
                                <div className="text-emerald-400 text-sm font-semibold">{kpis.maiorMesNome}</div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-900/60 to-amber-800/30 border-2 border-amber-500/50 rounded-xl p-5 shadow-lg">
                                <div className="text-amber-300 text-base font-bold mb-2 tracking-wide">MENOR MÊS</div>
                                <div className="text-white text-5xl font-black mb-1">{kpis.menorMes.toLocaleString('pt-BR')}</div>
                                <div className="text-amber-400 text-sm font-semibold">{kpis.menorMesNome}</div>
                            </div>
                        </div>

                        {/* Gráfico de Linha - Tendência */}
                        {dadosComVariacao.length > 0 && (
                            <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-2xl font-bold text-white mb-5">Tendência Mensal de Produção</h3>
                                <ResponsiveContainer width="100%" height={420}>
                                    <LineChart data={dadosComVariacao} margin={{ top: 40, right: 30, left: 20, bottom: 80 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeWidth={2} />
                                        <XAxis 
                                            dataKey="mes" 
                                            stroke="#9CA3AF"
                                            fontSize={14}
                                            fontWeight={600}
                                            angle={-45}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis 
                                            stroke="#9CA3AF"
                                            fontSize={14}
                                            fontWeight={600}
                                            tickFormatter={(value) => value.toLocaleString('pt-BR')}
                                        />
                                        <Tooltip 
                                            contentStyle={{
                                                backgroundColor: '#1F2937',
                                                border: '2px solid #374151',
                                                borderRadius: '12px',
                                                color: '#F9FAFB',
                                                fontSize: '14px',
                                                padding: '16px',
                                                fontWeight: 600
                                            }}
                                            formatter={(value) => [value.toLocaleString('pt-BR'), 'Quantidade']}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="quantidade" 
                                            stroke="#10B981" 
                                            strokeWidth={4}
                                            dot={{ fill: '#10B981', r: 6 }}
                                            activeDot={{ r: 7 }}
                                            isAnimationActive={true}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Gráfico de Top 5 Processos */}
                        {top5.length > 0 && (
                            <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-2xl font-bold text-white mb-5">Top 5 Processos</h3>
                                <ResponsiveContainer width="100%" height={340}>
                                    <BarChart
                                        layout="vertical"
                                        data={top5}
                                        margin={{ top: 10, right: 30, left: 200, bottom: 10 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeWidth={2} />
                                        <XAxis type="number" stroke="#9CA3AF" fontSize={13} fontWeight={600} />
                                        <YAxis 
                                            dataKey="tipo" 
                                            type="category" 
                                            stroke="#9CA3AF"
                                            fontSize={13}
                                            fontWeight={600}
                                            width={190}
                                        />
                                        <Tooltip 
                                            contentStyle={{
                                                backgroundColor: '#1F2937',
                                                border: '2px solid #374151',
                                                borderRadius: '12px',
                                                color: '#F9FAFB',
                                                fontSize: '14px',
                                                padding: '16px',
                                                fontWeight: 600
                                            }}
                                            formatter={(value) => [value.toLocaleString('pt-BR'), 'Quantidade']}
                                        />
                                        <Bar dataKey="quantidade" fill="#F59E0B" radius={[0, 8, 8, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Gráfico de Acumulado */}
                        {acumuladoData.length > 0 && (
                            <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-2xl font-bold text-white mb-5">Crescimento Acumulado</h3>
                                <ResponsiveContainer width="100%" height={420}>
                                    <BarChart data={acumuladoData} margin={{ top: 40, right: 30, left: 20, bottom: 80 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeWidth={2} />
                                        <XAxis 
                                            dataKey="mes" 
                                            stroke="#9CA3AF"
                                            fontSize={14}
                                            fontWeight={600}
                                            angle={-45}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis 
                                            stroke="#9CA3AF"
                                            fontSize={14}
                                            fontWeight={600}
                                            tickFormatter={(value) => value.toLocaleString('pt-BR')}
                                        />
                                        <Tooltip 
                                            contentStyle={{
                                                backgroundColor: '#1F2937',
                                                border: '2px solid #374151',
                                                borderRadius: '12px',
                                                color: '#F9FAFB',
                                                fontSize: '14px',
                                                padding: '16px',
                                                fontWeight: 600
                                            }}
                                            formatter={(value) => [value.toLocaleString('pt-BR'), 'Acumulado']}
                                        />
                                        <Bar dataKey="acumulado" fill="#8B5CF6" radius={[8, 8, 0, 0]}>
                                            <LabelList dataKey="acumulado" position="top" formatter={(value) => value.toLocaleString('pt-BR')} fontSize={13} fontWeight={900} fill="#F9FAFB" />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Tabela de Processos */}
                        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6">                            <div className="overflow-x-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center h-32 text-zinc-500">
                                        <div className="text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-2"></div>
                                            <p>Carregando dados...</p>
                                        </div>
                                    </div>
                                ) : dadosProcessos.length === 0 ? (
                                    <div className="flex items-center justify-center h-32 text-zinc-500">
                                        <div className="text-center">
                                            <BarChart3 size={32} className="mx-auto mb-2 opacity-50" />
                                            <p>Nenhum dado registrado ainda</p>
                                            <p className="text-xs">Use o formulário para lançar processos</p>
                                        </div>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-zinc-300 uppercase bg-zinc-800/50">
                                            <tr>
                                                <th scope="col" className="px-4 py-3 flex items-center gap-2">
                                                    <Hash size={14} className="text-purple-400" />
                                                    Quantidade
                                                </th>
                                                <th scope="col" className="px-4 py-3 flex items-center gap-2">
                                                    <Calendar size={14} className="text-purple-400" />
                                                    Mês/Ano
                                                </th>
                                                <th scope="col" className="px-4 py-3 flex items-center gap-2">
                                                    <Tag size={14} className="text-purple-400" />
                                                    Tipo/Grupo/Processo
                                                </th>
                                                        <th scope="col" className="px-4 py-3 text-right">
                                                            Ações
                                                        </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dadosProcessos.map((item, index) => (
                                                <tr key={item.id} className={`border-b border-zinc-700/50 ${index % 2 === 0 ? 'bg-zinc-800/20' : 'bg-zinc-900/20'}`}>
                                                    <td className="px-4 py-3 text-white font-medium">
                                                        {item.quantidade.toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-3 text-zinc-300">
                                                        {item.mes}
                                                    </td>
                                                    <td className="px-4 py-3 text-zinc-300">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                            {item.tipo}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="inline-flex items-center gap-2 justify-end">
                                                            <button
                                                                onClick={() => {
                                                                    // Preencher formulário para edição
                                                                    if (opcoesProcessos.includes(item.tipo)) {
                                                                        setProcesso(item.tipo);
                                                                        setNovoProcessoCustomizado('');
                                                                    } else {
                                                                        setProcesso('Outro');
                                                                        setNovoProcessoCustomizado(item.tipo);
                                                                    }
                                                                    setQuantidade(String(item.quantidade));
                                                                    const [m, a] = item.mes.split(' ');
                                                                    setMes(m);
                                                                    setAno(a || String(new Date().getFullYear()));
                                                                    setShowLancamentoForm(true);
                                                                    setEditingId(item.id);
                                                                }}
                                                                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded-md text-xs font-semibold"
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (!confirm('Remover este lançamento?')) return;
                                                                    try {
                                                                        if (IS_PRODUCTION) {
                                                                            await deleteDoc(doc(db, 'processos', item.id));
                                                                        } else {
                                                                            const atuais = JSON.parse(localStorage.getItem('processos') || '[]');
                                                                            const filtrados = atuais.filter(p => p.id !== item.id);
                                                                            localStorage.setItem('processos', JSON.stringify(filtrados));
                                                                            setDadosProcessos(filtrados);
                                                                        }
                                                                    } catch (err) {
                                                                        console.error('Erro removendo:', err);
                                                                        alert('Erro ao remover. Veja o console.');
                                                                    }
                                                                }}
                                                                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-semibold"
                                                            >
                                                                Remover
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Importação */}
            {showModalImportacao && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-zinc-900 rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl">
                        <div className="flex justify-between items-center p-4 md:p-6 border-b border-white/10 bg-white/5">
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                <Upload size={20} className="text-green-400" />
                                Importação Rápida de Processos
                            </h3>
                            <button
                                onClick={() => setShowModalImportacao(false)}
                                className="text-zinc-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 md:p-6 space-y-6">
                            {/* Instruções */}
                            <div className="bg-zinc-800/50 rounded-lg p-4">
                                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                                    <FileText size={16} className="text-green-400" />
                                    Como importar:
                                </h4>
                                <ol className="text-sm text-zinc-300 space-y-1 list-decimal list-inside">
                                    <li>Baixe o modelo Excel clicando no botão abaixo</li>
                                    <li>Preencha o arquivo com seus dados</li>
                                    <li>Faça upload do arquivo preenchido (Excel ou CSV)</li>
                                    <li>Revise os dados e confirme a importação</li>
                                </ol>
                            </div>

                            {/* Download do modelo */}
                            <div className="flex justify-center">
                                <button
                                    onClick={downloadModeloCSV}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors duration-200"
                                >
                                    <Download size={18} />
                                    Baixar Modelo Excel
                                </button>
                            </div>

                            {/* Upload do arquivo */}
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-zinc-300">
                                    Selecione o arquivo Excel/CSV:
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileUpload}
                                    className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-500"
                                />
                            </div>

                            {/* Preview dos dados */}
                            {dadosImportacao.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-white font-semibold flex items-center gap-2">
                                        <BarChart3 size={16} className="text-green-400" />
                                        Dados para importar ({dadosImportacao.length} registros):
                                    </h4>

                                    <div className="max-h-48 overflow-y-auto bg-zinc-800/30 rounded-lg border border-white/10">
                                        <table className="w-full text-sm">
                                            <thead className="bg-zinc-800/50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-zinc-300">Processo</th>
                                                    <th className="px-3 py-2 text-left text-zinc-300">Quantidade</th>
                                                    <th className="px-3 py-2 text-left text-zinc-300">Mês/Ano</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dadosImportacao.slice(0, 5).map((item, index) => (
                                                    <tr key={index} className="border-t border-zinc-700/30">
                                                        <td className="px-3 py-2 text-white">{item.tipo}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{item.quantidade.toLocaleString('pt-BR')}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{item.mes}</td>
                                                    </tr>
                                                ))}
                                                {dadosImportacao.length > 5 && (
                                                    <tr>
                                                        <td colSpan="3" className="px-3 py-2 text-center text-zinc-400 text-xs">
                                                            ... e mais {dadosImportacao.length - 5} registros
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Botões de ação */}
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModalImportacao(false);
                                        setDadosImportacao([]);
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = '';
                                        }
                                    }}
                                    className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors duration-200"
                                    disabled={importando}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleImportacao}
                                    disabled={dadosImportacao.length === 0 || importando}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors duration-200 flex items-center gap-2"
                                >
                                    {importando ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Importando...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={18} />
                                            Importar {dadosImportacao.length > 0 && `(${dadosImportacao.length})`}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Cadastro de Processo */}
            {showModalCadastro && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-zinc-900 rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
                        <div className="flex justify-between items-center p-4 md:p-6 border-b border-white/10 bg-white/5">
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                <Settings size={20} className="text-purple-400" />
                                Cadastrar Processo
                            </h3>
                            <button
                                onClick={() => setShowModalCadastro(false)}
                                className="text-zinc-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCadastroProcesso} className="p-4 md:p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">
                                    Nome do Processo
                                </label>
                                <input
                                    type="text"
                                    value={novoProcesso.nome}
                                    onChange={(e) => setNovoProcesso({...novoProcesso, nome: e.target.value})}
                                    className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                    placeholder="Ex: Corte, Dobramento, Pintura"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">
                                    Código
                                </label>
                                <input
                                    type="text"
                                    value={novoProcesso.codigo}
                                    onChange={(e) => setNovoProcesso({...novoProcesso, codigo: e.target.value})}
                                    className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                    placeholder="Ex: PROC001"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">
                                    Descrição
                                </label>
                                <textarea
                                    rows={3}
                                    value={novoProcesso.descricao}
                                    onChange={(e) => setNovoProcesso({...novoProcesso, descricao: e.target.value})}
                                    className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                    placeholder="Descrição detalhada do processo"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModalCadastro(false)}
                                    className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors duration-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors duration-200 flex items-center gap-2"
                                >
                                    <Plus size={18} />
                                    Cadastrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProcessosScreen;