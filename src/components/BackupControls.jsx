import React, { useRef } from 'react';
import { Download, Upload } from 'lucide-react'; // Adicionando ícones para padrão visual

const BackupControls = ({ onExportBackup, onImportBackup }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        onImportBackup && onImportBackup(json);
      } catch (err) {
        console.error('Erro ao ler backup:', err);
        alert('Arquivo de backup inválido ou corrompido.');
      } finally {
        // ✅ CORREÇÃO: Reseta o input para permitir subir o mesmo arquivo novamente se necessário
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; 
        }
      }
    };
    reader.readAsText(file);
  };

  const handleClickImport = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex gap-2 items-center">
      {/* Botão Exportar */}
      <button
        onClick={onExportBackup}
        className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 hover:bg-zinc-700 transition-colors"
        title="Baixar dados atuais"
      >
        <Download size={14} className="text-emerald-400" />
        Exportar Backup
      </button>

      {/* Botão Importar */}
      <button
        onClick={handleClickImport}
        className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 hover:bg-zinc-700 transition-colors"
        title="Carregar dados de um arquivo"
      >
        <Upload size={14} className="text-blue-400" />
        Importar Backup
      </button>

      {/* Input Oculto */}
      <input
        type="file"
        accept=".json,application/json"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default BackupControls;