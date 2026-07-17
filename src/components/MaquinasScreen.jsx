import React, { useState, useEffect } from 'react';
import { Factory, BarChart3, FileText } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { IS_PRODUCTION } from '../services/firebase';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

const MESES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const pad2 = (n) => String(n).padStart(2, '0');
const ANOS_HISTORICO = Array.from({ length: new Date().getFullYear() - 2019 }, (_, idx) => 2020 + idx);

const mesRefToLabel = (mesRef) => {
    const [y, m] = String(mesRef || '').split('-');
    const idx = Number(m) - 1;
    if (!y || !MESES_PT[idx]) return mesRef || '';
    return `${MESES_PT[idx]} ${y}`;
};

const MANUAL_LANCAMENTOS_LOCAL_KEY = 'local_lancamentos_maquinas';
const MANUAL_LANCAMENTOS_COLLECTION = 'global_lancamentos_maquinas';

const MaquinasScreen = () => {
    const [maquinas, setMaquinas] = useState([]);
    const [lancamentos, setLancamentos] = useState([]);
    const [diasUteisPorMes, setDiasUteisPorMes] = useState({});
    const [loading, setLoading] = useState(true);
    const [filtroMaquina, setFiltroMaquina] = useState('Todas');
    const [visualizacao, setVisualizacao] = useState('todos'); // 'todos', 'anoAtual', 'comparacao'
    const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
    const [novoMes, setNovoMes] = useState('');
    const [novoAno, setNovoAno] = useState(String(new Date().getFullYear()));
    const [novoValor, setNovoValor] = useState('');
    const [novoDiasUteis, setNovoDiasUteis] = useState('');
    const [novaMaquinaForm, setNovaMaquinaForm] = useState('');
    const [editingManualId, setEditingManualId] = useState(null);
    const [savingLancamento, setSavingLancamento] = useState(false);

    const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

    const carregarMaquinasLocal = () => {
        const local = JSON.parse(localStorage.getItem('local_maquinas') || '[]');
        setMaquinas(local);
    };

    const carregarLancamentosLocal = () => {
        const localLanc = JSON.parse(localStorage.getItem('local_lancamentos') || '[]');
        const manualLanc = JSON.parse(localStorage.getItem(MANUAL_LANCAMENTOS_LOCAL_KEY) || '[]');
        const merged = [
            ...manualLanc.map((l) => ({ ...l, real: Number(l.real) || 0, source: 'manual' })),
            ...localLanc
        ].map((l) => ({ ...l, real: Number(l.real) || 0 }));
        setLancamentos(merged);
        const localConfig = JSON.parse(localStorage.getItem('local_config') || '{}');
        setDiasUteisPorMes({ __default: Number(localConfig.diasUteis) || 22 });
        setLoading(false);
    };

    // Carregar máquinas
    useEffect(() => {
        if (IS_PRODUCTION) {
            const qMaq = query(collection(db, 'global_maquinas'));
            const unsubscribe = onSnapshot(qMaq, (snap) => {
                const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                arr.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
                setMaquinas(arr);
            });
            return () => unsubscribe();
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect -- dev-only localStorage fallback, mirrors ProcessosScreen/GlobalScreen
        carregarMaquinasLocal();
    }, []);

    // Carregar todos os lançamentos (todos os meses) e configs mensais
    useEffect(() => {
        if (IS_PRODUCTION) {
            const qLanc = query(collection(db, 'global_lancamentos'));
            const qManualLanc = query(collection(db, MANUAL_LANCAMENTOS_COLLECTION));

            const unsubLanc = onSnapshot(qLanc, (snap) => {
                const arr = snap.docs.map((d) => ({ ...d.data(), id: d.id, real: Number(d.data().real) || 0 }));
                setLancamentos((prev) => {
                    const manual = prev.filter((item) => item.source === 'manual');
                    return [...manual, ...arr];
                });
                setLoading(false);
            });

            const unsubManual = onSnapshot(qManualLanc, (snap) => {
                const arr = snap.docs.map((d) => ({ ...d.data(), id: d.id, real: Number(d.data().real) || 0, source: 'manual' }));
                setLancamentos((prev) => {
                    const global = prev.filter((item) => item.source !== 'manual');
                    return [...arr, ...global];
                });
                setLoading(false);
            });

            const qCfg = query(collection(db, 'global_config_mensal'));
            const unsubCfg = onSnapshot(qCfg, (snap) => {
                const map = {};
                snap.docs.forEach((d) => {
                    map[d.id] = Number(d.data()?.diasUteis) || null;
                });
                setDiasUteisPorMes(map);
            });

            return () => {
                unsubLanc();
                unsubManual();
                unsubCfg();
            };
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect -- dev-only localStorage fallback, mirrors ProcessosScreen/GlobalScreen
        carregarLancamentosLocal();
    }, []);

    const getDiasUteisByMesRef = (mesRef) => {
        if (isLocalhost) return diasUteisPorMes.__default || 22;
        return diasUteisPorMes[mesRef] || null;
    };

    const getMesRefFromMonthYear = (mes, ano) => {
        if (!mes || !ano) return '';
        const index = MESES_PT.indexOf(mes);
        if (index < 0) return '';
        const monthNumber = String(index + 1).padStart(2, '0');
        return `${ano}-${monthNumber}`;
    };

    const getMonthLabel = (mes, ano) => {
        if (!mes || !ano) return '';
        return `${mes} ${ano}`;
    };

    useEffect(() => {
        if (maquinas.length > 0 && !novaMaquinaForm) {
            setNovaMaquinaForm(maquinas[0].nome || '');
        }
    }, [maquinas, novaMaquinaForm]);

    const isManualLancamento = (item) => item?.source === 'manual' || item?.manual === true || String(item?.id || '').startsWith('manual-');

    const handleResetForm = () => {
        setNovoMes('');
        setNovoAno(String(new Date().getFullYear()));
        setNovoValor('');
        setNovoDiasUteis('');
        setEditingManualId(null);
    };

    const handleEditManualLancamento = (item) => {
        if (!item) return;
        const [ano, mes] = String(item.mesRef || '').split('-');
        const mesNome = MESES_PT[Number(mes) - 1] || '';
        setEditingManualId(item.id);
        setNovaMaquinaForm(item.maquina || '');
        setNovoMes(mesNome);
        setNovoAno(ano || String(new Date().getFullYear()));
        setNovoValor(String(item.real || ''));
        setNovoDiasUteis(item.diasUteis != null ? String(item.diasUteis) : '');
    };

    const handleDeleteManualLancamento = async (item) => {
        if (!item) return;

        if (IS_PRODUCTION && item.id && !String(item.id).startsWith('manual-')) {
            try {
                await deleteDoc(doc(db, MANUAL_LANCAMENTOS_COLLECTION, item.id));
            } catch (error) {
                console.error('Erro ao deletar lançamento manual:', error);
            }
            return;
        }

        const existing = JSON.parse(localStorage.getItem(MANUAL_LANCAMENTOS_LOCAL_KEY) || '[]');
        const updated = existing.filter((l) => l.id !== item.id);
        localStorage.setItem(MANUAL_LANCAMENTOS_LOCAL_KEY, JSON.stringify(updated));
        setLancamentos((prev) => prev.filter((l) => l.id !== item.id));
    };

    const handleAddLancamento = async (e) => {
        e.preventDefault();
        if (!novaMaquinaForm || !novoMes || !novoAno || !novoValor || !novoDiasUteis) return;

        const mesRef = getMesRefFromMonthYear(novoMes, novoAno);
        if (!mesRef) return;

        const lancPayload = {
            mesRef,
            mes: getMonthLabel(novoMes, novoAno),
            real: Number(novoValor),
            diasUteis: Number(novoDiasUteis),
            maquina: novaMaquinaForm,
            manual: true,
            createdAt: serverTimestamp ? serverTimestamp() : { seconds: Date.now() / 1000 }
        };

        if (editingManualId) {
            if (IS_PRODUCTION) {
                setSavingLancamento(true);
                try {
                    await updateDoc(doc(db, MANUAL_LANCAMENTOS_COLLECTION, editingManualId), lancPayload);
                } catch (error) {
                    console.error('Erro ao atualizar lançamento manual:', error);
                } finally {
                    setSavingLancamento(false);
                }
            } else {
                const existing = JSON.parse(localStorage.getItem(MANUAL_LANCAMENTOS_LOCAL_KEY) || '[]');
                const updated = existing.map((l) =>
                    l.id === editingManualId ? { ...l, ...lancPayload, id: editingManualId } : l
                );
                localStorage.setItem(MANUAL_LANCAMENTOS_LOCAL_KEY, JSON.stringify(updated));
                setLancamentos((prev) => prev.map((l) =>
                    l.id === editingManualId ? { ...l, ...lancPayload, source: 'manual' } : l
                ));
            }
            handleResetForm();
            return;
        }

        const novoLanc = {
            id: `manual-${Date.now()}`,
            source: 'manual',
            ...lancPayload
        };

        if (IS_PRODUCTION) {
            setSavingLancamento(true);
            try {
                await addDoc(collection(db, MANUAL_LANCAMENTOS_COLLECTION), lancPayload);
            } catch (error) {
                console.error('Erro ao salvar lançamento de máquina:', error);
            } finally {
                setSavingLancamento(false);
            }
            handleResetForm();
            return;
        }

        const existing = JSON.parse(localStorage.getItem(MANUAL_LANCAMENTOS_LOCAL_KEY) || '[]');
        const updated = [novoLanc, ...existing];
        localStorage.setItem(MANUAL_LANCAMENTOS_LOCAL_KEY, JSON.stringify(updated));
        setLancamentos((prev) => [novoLanc, ...prev]);
        handleResetForm();
    };

    const getMediaDiaByMesRef = (mesRef, quantidade, diasUteisOverride = null) => {
        const diasUteis = diasUteisOverride != null ? diasUteisOverride : getDiasUteisByMesRef(mesRef);
        const quantidadeNum = Number(quantidade);
        if (!diasUteis || !Number.isFinite(quantidadeNum)) {
            return { diasUteis, mediaDia: null };
        }
        return { diasUteis, mediaDia: quantidadeNum / diasUteis };
    };

    const maquinaSelecionada = maquinas.find((m) => m.nome === filtroMaquina);
    const unidadeSelecionada = filtroMaquina !== 'Todas' ? (maquinaSelecionada?.unidade || '') : '';

    // Processar dados agregados por mês
    const processChartData = () => {
        const lancamentosFiltrados = lancamentos.filter((l) => filtroMaquina === 'Todas' || l.maquina === filtroMaquina);

        const mesMap = {};
        lancamentosFiltrados.forEach((item) => {
            const chave = item.mesRef;
            if (!chave) return;
            const quantidade = Number(item.real) || 0;
            const diasUteis = item.diasUteis != null ? Number(item.diasUteis) : null;
            if (!mesMap[chave]) {
                mesMap[chave] = { quantidade: 0, diasUteis: diasUteis };
            }
            mesMap[chave].quantidade += quantidade;
            if (diasUteis != null) {
                mesMap[chave].diasUteis = diasUteis;
            }
        });

        return Object.entries(mesMap)
            .map(([mesRef, data]) => {
                const { diasUteis, mediaDia } = getMediaDiaByMesRef(mesRef, data.quantidade, data.diasUteis);
                return { mesRef, mes: mesRefToLabel(mesRef), quantidade: data.quantidade, diasUteis, mediaDia };
            })
            .sort((a, b) => a.mesRef.localeCompare(b.mesRef));
    };

    // Calcular variações mensais
    const calcularVariacaoMensal = (dados) => {
        return dados.map((item, index) => {
            if (index === 0) {
                return { ...item, variacao: null, percentual: null };
            }
            const anterior = dados[index - 1].quantidade;
            const atual = item.quantidade;
            const diferenca = atual - anterior;
            const percentual = anterior > 0 ? ((diferenca / anterior) * 100) : 0;
            return { ...item, variacao: diferenca, percentual };
        });
    };

    const chartData = processChartData();
    const dadosComVariacao = calcularVariacaoMensal(chartData);

    // Label customizado: seta (▲/▼) + porcentagem em cima, valor formatado abaixo
    // Nota: LabelList não entrega `payload` de forma confiável nesta versão do recharts,
    // então buscamos o item pelo `index` (sempre presente) em vez de confiar em `payload`.
    const CustomBarLabel = ({ x, y, width, value, index, payload }) => {
        const itemFromPayload = Array.isArray(payload) ? payload[0]?.payload : payload?.payload || payload;
        const item = itemFromPayload || dadosGraficoFiltrados?.[index];
        const formatted = Number(value).toLocaleString('pt-BR');
        const mediaDiaCalc = item?.mediaDia != null ? Number(item.mediaDia) : null;
        const unidadeSufixo = unidadeSelecionada ? ` ${unidadeSelecionada}/dia` : '/dia';
        const mediaDiaText = mediaDiaCalc === null ? '' : `${mediaDiaCalc.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unidadeSufixo}`;

        let pctRaw = Number.isFinite(Number(item?.percentual)) ? Number(item.percentual) : null;

        const centerX = x + width / 2;
        const cornerX = x + 6;
        const cornerPctY = y - 10;
        const valY = (pctRaw === null) ? (y - 8) : (y + 14);
        const mediaY = valY + 26;

        return (
            <g>
                {pctRaw !== null && (
                    <text x={cornerX} y={cornerPctY} fill={pctRaw > 0 ? '#22c55e' : pctRaw < 0 ? '#ef4444' : '#9CA3AF'} fontSize={20} fontWeight={900} textAnchor="start">
                        {pctRaw > 0 ? '▲' : pctRaw < 0 ? '▼' : '▶'} {pctRaw > 0 ? '+' : ''}{pctRaw.toFixed(1)}%
                    </text>
                )}
                <text x={centerX} y={valY} fill="#F9FAFB" fontSize={18} fontWeight={900} textAnchor="middle">{formatted}</text>
                {mediaDiaText && (
                    <text
                        x={centerX}
                        y={mediaY}
                        fill="#CBD5E1"
                        stroke="#000000"
                        strokeWidth="0.5"
                        paintOrder="stroke"
                        fontSize={15}
                        fontWeight={800}
                        textAnchor="middle"
                    >
                        {mediaDiaText}
                    </text>
                )}
            </g>
        );
    };

    // Rótulo de valor para o gráfico de Comparação de Meses (uma barra por ano)
    const ComparacaoValueLabel = ({ x, y, width, value }) => {
        if (!Number(value)) return null;
        return (
            <text
                x={x + width / 2}
                y={y - 8}
                fill="#F9FAFB"
                fontSize={14}
                fontWeight={800}
                textAnchor="middle"
                stroke="#000000"
                strokeWidth="0.4"
                paintOrder="stroke"
            >
                {Number(value).toLocaleString('pt-BR')}
            </text>
        );
    };

    // Rótulo de variação % entre os dois anos, acima do par de barras
    // Idem: usa `index` para buscar o item, já que `payload` não é confiável aqui.
    const ComparacaoPercentLabel = ({ x, y, width, index }) => {
        const item = dadosGraficoFiltrados?.[index];
        if (!item) return null;
        const v25 = Number(item.quantidade_2025) || 0;
        const v26 = Number(item.quantidade_2026) || 0;
        if (!v25 || !v26) return null;
        const pct = ((v26 - v25) / v25) * 100;
        const color = pct > 0 ? '#22c55e' : pct < 0 ? '#ef4444' : '#9CA3AF';
        const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '▶';
        return (
            <text
                x={x + width / 2}
                y={y - 28}
                fill={color}
                fontSize={16}
                fontWeight={900}
                textAnchor="middle"
                stroke="#000000"
                strokeWidth="0.5"
                paintOrder="stroke"
            >
                {arrow} {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
            </text>
        );
    };

    // Função para filtrar dados de visualização
    const obterDadosFiltrados = () => {
        if (visualizacao === 'anoAtual') {
            return dadosComVariacao.filter((item) => item.mesRef.startsWith(String(anoSelecionado)));
        }

        if (visualizacao === 'comparacao') {
            const anosComparacao = ['2025', '2026'];
            return MESES_PT.map((mesNome, idx) => {
                const linha = { mes: mesNome };
                anosComparacao.forEach((ano) => {
                    const mesRef = `${ano}-${pad2(idx + 1)}`;
                    const item = chartData.find((d) => d.mesRef === mesRef);
                    const quantidade = item?.quantidade || 0;
                    const { mediaDia } = getMediaDiaByMesRef(mesRef, quantidade);
                    linha[`quantidade_${ano}`] = quantidade;
                    linha[`mediaDia_${ano}`] = mediaDia;
                });
                return linha;
            });
        }

        return dadosComVariacao;
    };

    const dadosGraficoFiltrados = obterDadosFiltrados();

    const exportarGraficoExcel = () => {
        const wb = XLSX.utils.book_new();
        const titulo = filtroMaquina === 'Todas' ? 'Produção Total por Mês' : `Produção de ${filtroMaquina} por Mês`;

        let linhas;
        if (visualizacao === 'comparacao') {
            linhas = dadosGraficoFiltrados.map((item) => ({
                'Mês': item.mes,
                'Quantidade 2025': item.quantidade_2025 || 0,
                'Média/dia 2025': Number.isFinite(item.mediaDia_2025) ? parseFloat(item.mediaDia_2025.toFixed(1)) : '',
                'Quantidade 2026': item.quantidade_2026 || 0,
                'Média/dia 2026': Number.isFinite(item.mediaDia_2026) ? parseFloat(item.mediaDia_2026.toFixed(1)) : '',
            }));
        } else {
            linhas = dadosGraficoFiltrados.map((item) => ({
                'Mês': item.mes,
                'Quantidade': item.quantidade,
                'Média/dia': Number.isFinite(item.mediaDia) ? parseFloat(item.mediaDia.toFixed(1)) : '',
                'Dias Úteis': item.diasUteis || '',
                'Variação (un)': item.variacao ?? '',
                'Variação (%)': item.percentual != null ? parseFloat(item.percentual.toFixed(1)) : '',
            }));
        }

        const ws = XLSX.utils.json_to_sheet(linhas);
        XLSX.utils.book_append_sheet(wb, ws, titulo.substring(0, 31));
        XLSX.writeFile(wb, `${titulo.replace(/ /g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
    };

    return (
        <div className="flex-1 bg-[#09090b] px-4 pb-8 pt-5 md:px-6 md:pt-6 overflow-y-auto">
            <div className="w-full space-y-5">
                <header className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                        <Factory className="text-purple-300" size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">Análise de Máquinas por Mês</h1>
                        <p className="text-sm text-zinc-400">Produção mensal por máquina, com comparações mês a mês</p>
                    </div>
                </header>

                <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-3">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <BarChart3 size={20} className="text-purple-400" />
                                Análise de Máquinas por Mês
                            </h2>
                            <p className="text-sm text-zinc-400 mt-1">
                                Os lançamentos do Global continuam alimentando esta aba.
                                Lançamentos manuais ficarão isolados aqui e não alteram a aba Geral.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <label htmlFor="filtroMaquina" className="text-sm font-medium text-zinc-300">
                                Filtrar por Máquina:
                            </label>
                            <select
                                id="filtroMaquina"
                                value={filtroMaquina}
                                onChange={(e) => setFiltroMaquina(e.target.value)}
                                className="bg-black/60 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 text-sm"
                            >
                                <option value="Todas">Todas as Máquinas</option>
                                {maquinas.map((m) => (
                                    <option key={m.id} value={m.nome}>
                                        {m.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 mb-6">
                        <form onSubmit={handleAddLancamento} className="grid grid-cols-1 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-end">
                            <div className="space-y-2">
                                <label htmlFor="novaMaquinaForm" className="text-sm font-medium text-zinc-300">Máquina</label>
                                <select
                                    id="novaMaquinaForm"
                                    value={novaMaquinaForm}
                                    onChange={(e) => setNovaMaquinaForm(e.target.value)}
                                    className="w-full bg-black/70 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                    required
                                >
                                    {maquinas.length === 0 ? (
                                        <option value="">Cadastre máquinas primeiro</option>
                                    ) : (
                                        maquinas.map((m) => (
                                            <option key={m.id || m.nome} value={m.nome}>
                                                {m.nome}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="novoMes" className="text-sm font-medium text-zinc-300">Mês</label>
                                <select
                                    id="novoMes"
                                    value={novoMes}
                                    onChange={(e) => setNovoMes(e.target.value)}
                                    className="w-full bg-black/70 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                    required
                                >
                                    <option value="">Selecione o mês</option>
                                    {MESES_PT.map((mes) => (
                                        <option key={mes} value={mes}>{mes}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="novoAno" className="text-sm font-medium text-zinc-300">Ano</label>
                                <select
                                    id="novoAno"
                                    value={novoAno}
                                    onChange={(e) => setNovoAno(e.target.value)}
                                    className="w-full bg-black/70 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                    required
                                >
                                    {ANOS_HISTORICO.map((ano) => (
                                        <option key={ano} value={ano}>{ano}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="novoDiasUteis" className="text-sm font-medium text-zinc-300">Dias úteis</label>
                                <input
                                    id="novoDiasUteis"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={novoDiasUteis}
                                    onChange={(e) => setNovoDiasUteis(e.target.value)}
                                    className="w-full bg-black/70 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                    placeholder="22"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="novoValor" className="text-sm font-medium text-zinc-300">Quantidade</label>
                                <input
                                    id="novoValor"
                                    type="number"
                                    min="0"
                                    value={novoValor}
                                    onChange={(e) => setNovoValor(e.target.value)}
                                    className="w-full bg-black/70 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                                    placeholder="0"
                                    required
                                />
                            </div>
                            <div className="flex items-center pt-2">
                                <button
                                    type="submit"
                                    disabled={maquinas.length === 0 || !novaMaquinaForm || !novoMes || !novoAno || !novoValor || !novoDiasUteis || savingLancamento}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {savingLancamento ? 'Salvando...' : editingManualId ? 'Atualizar lançamento' : 'Salvar lançamento'}
                                </button>
                            </div>
                            {editingManualId && (
                                <div className="flex items-center pt-2">
                                    <button
                                        type="button"
                                        onClick={handleResetForm}
                                        className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-3 rounded-lg transition-colors"
                                    >
                                        Cancelar edição
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>

                    <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 mb-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Lançamentos manuais</h3>
                        {lancamentos.filter(isManualLancamento).length === 0 ? (
                            <p className="text-sm text-zinc-400">Nenhum lançamento manual registrado ainda.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm text-zinc-300">
                                    <thead>
                                        <tr className="border-b border-white/10 text-zinc-400">
                                            <th className="px-3 py-2">Máquina</th>
                                            <th className="px-3 py-2">Mês</th>
                                            <th className="px-3 py-2">Quantidade</th>
                                            <th className="px-3 py-2">Dias úteis</th>
                                            <th className="px-3 py-2">Média / dia</th>
                                            <th className="px-3 py-2">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lancamentos.filter(isManualLancamento).map((item) => (
                                            <tr key={item.id} className="border-b border-white/10 hover:bg-white/5">
                                                <td className="px-3 py-3">{item.maquina}</td>
                                                <td className="px-3 py-3">{item.mes || item.mesRef}</td>
                                                <td className="px-3 py-3">{Number(item.real || 0).toLocaleString('pt-BR')}</td>
                                                <td className="px-3 py-3">{item.diasUteis != null ? Number(item.diasUteis).toLocaleString('pt-BR') : '-'}</td>
                                                <td className="px-3 py-3">
                                                    {item.diasUteis ? `${(Number(item.real || 0) / Number(item.diasUteis)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pc/dia` : '-'}
                                                </td>
                                                <td className="px-3 py-3 flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditManualLancamento(item)}
                                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-xs font-semibold"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteManualLancamento(item)}
                                                        className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded-lg text-white text-xs font-semibold"
                                                    >
                                                        Deletar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-64 text-zinc-500">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-2"></div>
                                <p>Carregando dados...</p>
                            </div>
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-zinc-500">
                            <div className="text-center">
                                <BarChart3 size={32} className="mx-auto mb-2 opacity-50" />
                                <p>Nenhum dado para exibir</p>
                                <p className="text-xs">Lance produção no painel Global para ver o gráfico aqui</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Controles de Visualização */}
                            <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-white font-semibold">Visualizar:</span>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => setVisualizacao('todos')}
                                            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                                                visualizacao === 'todos'
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                            }`}
                                        >
                                            Todos os Meses
                                        </button>
                                        <button
                                            onClick={() => setVisualizacao('anoAtual')}
                                            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                                                visualizacao === 'anoAtual'
                                                    ? 'bg-cyan-600 text-white'
                                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                            }`}
                                        >
                                            Ano Atual
                                        </button>
                                        <button
                                            onClick={() => setVisualizacao('comparacao')}
                                            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                                                visualizacao === 'comparacao'
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                            }`}
                                        >
                                            Comparação Meses
                                        </button>
                                    </div>
                                </div>
                                {visualizacao === 'anoAtual' && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-400 text-sm">Selecionar Ano:</span>
                                        <select
                                            value={anoSelecionado}
                                            onChange={(e) => setAnoSelecionado(parseInt(e.target.value))}
                                            className="px-3 py-2 bg-zinc-800 text-white rounded-lg border border-zinc-700 hover:border-purple-500 transition-colors"
                                        >
                                            {ANOS_HISTORICO.map((a) => (
                                                <option key={a} value={a}>{a}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-2xl font-bold text-white">
                                        {filtroMaquina === 'Todas' ? 'Produção Total por Mês' : `Produção de ${filtroMaquina} por Mês`}
                                    </h3>
                                    <button
                                        onClick={exportarGraficoExcel}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
                                        title="Baixar dados do gráfico em Excel"
                                    >
                                        <FileText size={16} />
                                        Excel
                                    </button>
                                </div>

                                <ResponsiveContainer width="100%" height={720}>
                                    {visualizacao === 'comparacao' ? (
                                        <BarChart data={dadosGraficoFiltrados} margin={{ top: 50, right: 20, left: 20, bottom: 80 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeWidth={2} />
                                            <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={16} fontWeight={700} angle={-45} textAnchor="end" height={100} />
                                            <YAxis stroke="#9CA3AF" fontSize={16} fontWeight={700} tickFormatter={(value) => value.toLocaleString('pt-BR')} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1F2937', border: '2px solid #374151', borderRadius: '12px', color: '#F9FAFB', fontSize: '15px', padding: '16px', fontWeight: 600 }}
                                                formatter={(value, name) => [value.toLocaleString('pt-BR'), name.replace('quantidade_', 'Ano ')]}
                                                labelFormatter={(label) => `Mês: ${label}`}
                                            />
                                            <Bar dataKey="quantidade_2025" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                                                <LabelList dataKey="quantidade_2025" content={ComparacaoValueLabel} />
                                            </Bar>
                                            <Bar dataKey="quantidade_2026" fill="#06B6D4" radius={[4, 4, 0, 0]}>
                                                <LabelList dataKey="quantidade_2026" content={ComparacaoValueLabel} />
                                                <LabelList dataKey="quantidade_2026" content={ComparacaoPercentLabel} />
                                            </Bar>
                                        </BarChart>
                                    ) : (
                                        <BarChart data={dadosGraficoFiltrados} margin={{ top: 50, right: 20, left: 20, bottom: 80 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeWidth={2} />
                                            <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={16} fontWeight={700} angle={-45} textAnchor="end" height={100} />
                                            <YAxis stroke="#9CA3AF" fontSize={16} fontWeight={700} tickFormatter={(value) => value.toLocaleString('pt-BR')} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1F2937', border: '2px solid #374151', borderRadius: '12px', color: '#F9FAFB', fontSize: '15px', padding: '16px', fontWeight: 600 }}
                                                formatter={(value, name, props) => {
                                                    const item = props?.payload || {};
                                                    const { mediaDia } = getMediaDiaByMesRef(item.mesRef, value);
                                                    const mediaDiaText = Number.isFinite(mediaDia)
                                                        ? `\nMédia/dia: ${mediaDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/dia`
                                                        : '';
                                                    let variacaoText = '';
                                                    if (item.variacao !== null && item.variacao !== undefined) {
                                                        const sinal = item.variacao > 0 ? '+' : '';
                                                        variacaoText = `\nVariação: ${sinal}${item.variacao.toLocaleString('pt-BR')} (${item.percentual > 0 ? '+' : ''}${item.percentual.toFixed(1)}%)`;
                                                    }
                                                    return [value.toLocaleString('pt-BR') + mediaDiaText + variacaoText, 'Quantidade'];
                                                }}
                                                labelFormatter={(label) => `Mês: ${label}`}
                                            />
                                            <Bar dataKey="quantidade" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                                                <LabelList dataKey="quantidade" content={CustomBarLabel} />
                                            </Bar>
                                        </BarChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MaquinasScreen;
