import React, { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { IS_LOCALHOST } from '../utils/env'; // ✅ seu arquivo existe

const BackupControls = ({ onExportBackup, onImportBackup }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    // ✅ blindagem extra (se alguém tentar forçar o input)
    if (!IS_LOCALHOST) {
      alert('Importar backup JSON é permitido apenas no localhost (modo dev).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
        // ✅ permite subir o mesmo arquivo novamente
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClickImport = () => {
    // ✅ proteção principal: não abre seletor em produção
    if (!IS_LOCALHOST) {
      alert('Importar backup JSON é permitido apenas no localhost (modo dev).');
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="flex gap-2 items-center">
      {/* Exportar */}
      <button
        onClick={onExportBackup}
        className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 hover:bg-zinc-700 transition-colors"
        title="Baixar dados atuais"
        type="button"
      >
        <Download size={14} className="text-emerald-400" />
        Exportar Backup
      </button>

      {/* Importar */}
      <button
        onClick={handleClickImport}
        className={
          IS_LOCALHOST
            ? "flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 hover:bg-zinc-700 transition-colors"
            : "flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 opacity-60 cursor-not-allowed"
        }
        title={IS_LOCALHOST ? "Carregar dados de um arquivo" : "Disponível apenas no localhost"}
        type="button"
      >
        <Upload size={14} className={IS_LOCALHOST ? "text-blue-400" : "text-zinc-500"} />
        Importar Backup
      </button>

      {/* ✅ em produção nem existe input, então nunca abre seletor */}
      {IS_LOCALHOST && (
        <input
          type="file"
          accept=".json,application/json"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      )}
    </div>
  );
};

export default BackupControls;
