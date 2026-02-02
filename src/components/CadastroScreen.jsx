import React, { useState } from 'react';
import { UserPlus, Factory, Package, Settings, Plus } from 'lucide-react';

const CadastroScreen = () => {
    const [abaAtiva, setAbaAtiva] = useState('processos');

    const renderFormularioProcessos = () => (
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Settings size={20} className="text-blue-400" />
                Cadastro de Processos
            </h2>
            <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Nome do Processo</label>
                        <input
                            type="text"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            placeholder="Ex: Corte, Dobramento, Pintura"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Código</label>
                        <input
                            type="text"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            placeholder="Ex: PROC001"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Descrição</label>
                    <textarea
                        rows={3}
                        className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        placeholder="Descrição detalhada do processo"
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                    <Plus size={18} />
                    Cadastrar Processo
                </button>
            </form>
        </div>
    );

    const renderFormularioMaquinas = () => (
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Factory size={20} className="text-green-400" />
                Cadastro de Máquinas
            </h2>
            <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Nome da Máquina</label>
                        <input
                            type="text"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/40"
                            placeholder="Ex: Cortadeira Hidráulica"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Código</label>
                        <input
                            type="text"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/40"
                            placeholder="Ex: MAQ001"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Grupo</label>
                        <select className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/40">
                            <option value="">Selecione...</option>
                            <option value="GRUPO_TELHAS">Telhas</option>
                            <option value="GRUPO_PERFIS">Perfis</option>
                            <option value="GRUPO_OUTROS">Outros</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Capacidade (kg/dia)</label>
                        <input
                            type="number"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/40"
                            placeholder="15000"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Horas/dia</label>
                        <input
                            type="number"
                            step="0.1"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/40"
                            placeholder="8.8"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                    <Plus size={18} />
                    Cadastrar Máquina
                </button>
            </form>
        </div>
    );

    const renderFormularioProdutos = () => (
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Package size={20} className="text-orange-400" />
                Cadastro de Produtos
            </h2>
            <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Nome do Produto</label>
                        <input
                            type="text"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                            placeholder="Ex: Telha Ondulada 6m"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Código</label>
                        <input
                            type="text"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                            placeholder="Ex: PROD001"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Perfil</label>
                        <input
                            type="text"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                            placeholder="Ex: TP40"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Material</label>
                        <select className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40">
                            <option value="">Selecione...</option>
                            <option value="GALV">Galvanizado</option>
                            <option value="GALVALUME">Galvalume</option>
                            <option value="ALUZINC">Aluzinc</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Peso Unitário (kg)</label>
                        <input
                            type="number"
                            step="0.01"
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                            placeholder="2.5"
                        />
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm text-zinc-300">Produto sob medida</span>
                    </label>
                </div>
                <button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                    <Plus size={18} />
                    Cadastrar Produto
                </button>
            </form>
        </div>
    );

    return (
        <div className="flex-1 bg-[#09090b] px-4 pb-8 pt-5 md:px-6 md:pt-6 overflow-y-auto">
            <div className="w-full space-y-5">
                <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                            <UserPlus className="text-indigo-300" size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">Sistema de Cadastros</h1>
                            <p className="text-sm text-zinc-400">Gerencie processos, máquinas e produtos do sistema</p>
                        </div>
                    </div>
                </header>

                {/* Abas de navegação */}
                <div className="flex space-x-1 bg-zinc-900/50 p-1 rounded-xl">
                    <button
                        onClick={() => setAbaAtiva('processos')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            abaAtiva === 'processos'
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                        }`}
                    >
                        Processos
                    </button>
                    <button
                        onClick={() => setAbaAtiva('maquinas')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            abaAtiva === 'maquinas'
                                ? 'bg-green-600 text-white'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                        }`}
                    >
                        Máquinas
                    </button>
                    <button
                        onClick={() => setAbaAtiva('produtos')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            abaAtiva === 'produtos'
                                ? 'bg-orange-600 text-white'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                        }`}
                    >
                        Produtos
                    </button>
                </div>

                {/* Conteúdo das abas */}
                <div className="space-y-6">
                    {abaAtiva === 'processos' && renderFormularioProcessos()}
                    {abaAtiva === 'maquinas' && renderFormularioMaquinas()}
                    {abaAtiva === 'produtos' && renderFormularioProdutos()}
                </div>
            </div>
        </div>
    );
};

export default CadastroScreen;