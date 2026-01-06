import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Clock,
  Trash2,
  Timer,
  AlertOctagon,
  Download,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";

import { CATALOGO_MAQUINAS } from "../data/catalogoMaquinas";
import { DICIONARIO_PARADAS } from "../data/dicionarioParadas";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
const formatarDataVisual = (dataISO) => {
  if (!dataISO) return "-";
  const [ano, mes, dia] = String(dataISO).split("-");
  if (!ano || !mes || !dia) return String(dataISO);
  return `${dia}/${mes}/${ano}`;
};

const hojeISOcorrigido = () => {
  const hoje = new Date();
  const offset = hoje.getTimezoneOffset() * 60000;
  return new Date(hoje.getTime() - offset).toISOString().slice(0, 10);
};

const horaParaMinutos = (hhmm) => {
  if (!hhmm || !String(hhmm).includes(":")) return 0;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
};

const calcularDuracao = (inicio, fim) => {
  if (!inicio || !fim) return 0;
  return horaParaMinutos(fim) - horaParaMinutos(inicio);
};

const normalizarHeader = (h) =>
  String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\w]/g, "");

// ✅ Normaliza data (aceita ISO, BR, Date, serial Excel)
const normalizeISODate = (v) => {
  if (!v) return "";

  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const off = v.getTimezoneOffset() * 60000;
    return new Date(v.getTime() - off).toISOString().slice(0, 10);
  }

  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date
    const utc = new Date(Math.round((v - 25569) * 86400 * 1000));
    const off = utc.getTimezoneOffset() * 60000;
    return new Date(utc.getTime() - off).toISOString().slice(0, 10);
  }

  return "";
};

// ✅ Normaliza hora (aceita "07:20", "07:20:00", Date, serial Excel 0.x)
const asHHMM = (v) => {
  if (v == null || v === "") return "";

  // Excel time serial (fração do dia)
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1) {
    const totalMin = Math.round(v * 24 * 60);
    const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, "0");
    const mm = String(totalMin % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // Date
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const hh = String(v.getHours()).padStart(2, "0");
    const mm = String(v.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const s = String(v).trim();

  // "12:10:00" -> "12:10"
  const m0 = s.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/);
  if (m0) return `${m0[1].padStart(2, "0")}:${m0[2]}`;

  // "8:5" -> "08:05"
  const m1 = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m1) return `${m1[1].padStart(2, "0")}:${m1[2].padStart(2, "0")}`;

  // "0810" -> "08:10"
  const m2 = s.match(/^(\d{2})(\d{2})$/);
  if (m2) return `${m2[1]}:${m2[2]}`;

  return "";
};

// ✅ “chave” única de máquina em qualquer registro
const getMaquinaKey = (p) =>
  String(p?.maquinaId ?? p?.maquina ?? p?.maquinaNorm ?? p?.maq ?? "").trim();

// -----------------------------------------------------------------------------
// COMPONENTE
// -----------------------------------------------------------------------------
export const ParadasScreen = ({ eventosParada = [], onRegistrarParada, deletarParada }) => {
  const [dataSelecionada, setDataSelecionada] = useState(hojeISOcorrigido);
  const [maquinaId, setMaquinaId] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [motivoCodigo, setMotivoCodigo] = useState("");

  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef(null);

  const motivosDisponiveis = useMemo(() => DICIONARIO_PARADAS, []);
  const maquinasAtivas = useMemo(() => CATALOGO_MAQUINAS.filter((m) => m.ativo), []);

  const getDescricaoMotivo = (codigo) =>
    motivosDisponiveis.find((m) => m.codigo === codigo || m.cod === codigo)?.evento || "-";

  // ✅ AQUI é o bug clássico: teu catálogo usa maquinaId, não id
  const getNomeMaquina = (id) =>
    maquinasAtivas.find((m) => m.maquinaId === id)?.nomeExibicao || id || "-";

  // ---------------------------------------------------------------------------
  // LISTA (filtra + normaliza os campos que a UI usa)
  // ---------------------------------------------------------------------------
  const paradasDoDia = useMemo(() => {
    const diaSelISO = normalizeISODate(dataSelecionada);

    const filtradas = (eventosParada || []).filter((p) => {
      const dataISO = normalizeISODate(p.data);
      const dataOk = dataISO === diaSelISO;

      if (!maquinaId) return dataOk;
      return dataOk && getMaquinaKey(p) === String(maquinaId);
    });

    const normalizadas = filtradas.map((p) => {
      const inicioNorm = asHHMM(p.horaInicio ?? p.inicio ?? p.inicioNorm);
      const fimNorm = asHHMM(p.horaFim ?? p.fim ?? p.fimNorm);

      const motivoNorm = String(p.motivoCodigo ?? p.motivoNorm ?? p.codMotivo ?? p.motivo ?? "").trim();
      const descNorm = p.descMotivo ?? p.descNorm ?? getDescricaoMotivo(motivoNorm);

      const maquinaNorm = getMaquinaKey(p);

      const duracaoMinutos =
        Number(p.duracaoMinutos ?? p.duracao) ||
        calcularDuracao(inicioNorm, fimNorm);

      const isProducao = motivoNorm === "TU001";
      const isCritico = !isProducao && duracaoMinutos >= 30;

      return {
        ...p,
        data: normalizeISODate(p.data),
        inicioNorm,
        fimNorm,
        motivoNorm,
        descNorm,
        maquinaNorm,
        duracaoMinutos,
        isProducao,
        isCritico,
      };
    });

    return normalizadas.sort((a, b) => (a.inicioNorm || "").localeCompare(b.inicioNorm || ""));
  }, [eventosParada, dataSelecionada, maquinaId, motivosDisponiveis, maquinasAtivas]);

  // Total (excluindo TU001)
  const totalMinutosParados = useMemo(() => {
    return paradasDoDia.reduce((acc, p) => {
      if (p.isProducao) return acc;
      return acc + (Number(p.duracaoMinutos) || 0);
    }, 0);
  }, [paradasDoDia]);

  // Auto-preencher horário (pega o último fim da máquina selecionada)
  const ultimaParadaDaMaquina = useMemo(() => {
    if (!maquinaId) return null;

    const listaMaquina = paradasDoDia.filter((p) => p.maquinaNorm === maquinaId);
    if (!listaMaquina.length) return null;

    return listaMaquina.sort((a, b) => (a.fimNorm || "").localeCompare(b.fimNorm || ""))[listaMaquina.length - 1];
  }, [paradasDoDia, maquinaId]);

  useEffect(() => {
    if (!horaInicio && ultimaParadaDaMaquina?.fimNorm) setHoraInicio(ultimaParadaDaMaquina.fimNorm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimaParadaDaMaquina]);

  // ---------------------------------------------------------------------------
  // MODELO + IMPORT EXCEL
  // ---------------------------------------------------------------------------
  const baixarModeloExcel = () => {
    const exemplo = [
      {
        data: "2025-12-16",
        maquinaId: "PERFIL_U_MARAFON",
        horaInicio: "08:00",
        horaFim: "08:30",
        motivoCodigo: "TU002",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(exemplo, {
      header: ["data", "maquinaId", "horaInicio", "horaFim", "motivoCodigo"],
    });

    ws["!cols"] = [
      { wch: 12 }, // data
      { wch: 24 }, // maquinaId
      { wch: 10 }, // horaInicio
      { wch: 10 }, // horaFim
      { wch: 14 }, // motivoCodigo
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PARADAS");
    XLSX.writeFile(wb, "modelo_paradas.xlsx");
  };

  const abrirUploadExcel = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const importarExcel = async (file) => {
    if (!file) return;
    setImportando(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];

      const rowsRaw = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rowsRaw.length) {
        alert("Arquivo vazio.");
        return;
      }

      const rows = rowsRaw.map((r) => {
        const out = {};
        for (const k of Object.keys(r)) out[normalizarHeader(k)] = r[k];
        return out;
      });

      const pick = (obj, keys) => {
        for (const k of keys) if (obj[k] != null && obj[k] !== "") return obj[k];
        return "";
      };

      let ok = 0;
      let erro = 0;

      for (const r of rows) {
        const data = normalizeISODate(pick(r, ["data", "dia", "dt"]));
        const maq = String(pick(r, ["maquinaid", "maquina", "equipamento", "maq"])).trim();
        const ini = asHHMM(pick(r, ["horainicio", "inicio", "ini"]));
        const fim = asHHMM(pick(r, ["horafim", "fim", "final"]));
        const motivo = String(pick(r, ["motivocodigo", "motivo", "codigo", "codmotivo"])).trim();

        if (!data || !maq || !ini || !fim || !motivo) {
          erro++;
          continue;
        }

        if (fim <= ini) {
          erro++;
          continue;
        }

        const maquinaExiste = maquinasAtivas.some((m) => m.maquinaId === maq);
        const motivoExiste = motivosDisponiveis.some((m) => m.codigo === motivo || m.cod === motivo);
        if (!maquinaExiste || !motivoExiste) {
          erro++;
          continue;
        }

        const duracaoMin = calcularDuracao(ini, fim);
        if (duracaoMin <= 0) {
          erro++;
          continue;
        }

        const novaParada = {
          data, // ✅ ISO
          maquinaId: maq, // ✅ chave do catálogo
          horaInicio: ini,
          horaFim: fim,
          motivoCodigo: motivo,
          descMotivo: getDescricaoMotivo(motivo),
          duracaoMinutos: duracaoMin,
        };

        if (onRegistrarParada) onRegistrarParada(novaParada);
        ok++;
      }

      alert(`Importação concluída.\n✅ Inseridos: ${ok}\n❌ Ignorados: ${erro}`);
    } catch (e) {
      console.error(e);
      alert("Erro ao importar Excel. Veja o console.");
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---------------------------------------------------------------------------
  // CONFIRMAR
  // ---------------------------------------------------------------------------
  const handleConfirmar = () => {
    if (!maquinaId || !horaInicio || !horaFim || !motivoCodigo) {
      alert("Preencha todos os campos.");
      return;
    }

    if (horaFim <= horaInicio) {
      alert("Horário final deve ser maior que o inicial.");
      return;
    }

    // Conflito simples
    const temConflito = paradasDoDia.some(
      (p) =>
        p.maquinaNorm === maquinaId &&
        ((horaInicio >= p.inicioNorm && horaInicio < p.fimNorm) ||
          (horaFim > p.inicioNorm && horaFim <= p.fimNorm))
    );

    if (temConflito) {
      if (!window.confirm("Conflito de horário nesta máquina. Salvar mesmo assim?")) return;
    }

    const duracaoMin = calcularDuracao(horaInicio, horaFim);
    if (duracaoMin <= 0) {
      alert("Não foi possível calcular a duração da parada.");
      return;
    }

    const novaParada = {
      data: normalizeISODate(dataSelecionada),
      maquinaId,
      horaInicio,
      horaFim,
      motivoCodigo,
      descMotivo: getDescricaoMotivo(motivoCodigo),
      duracaoMinutos: duracaoMin,
    };

    if (onRegistrarParada) onRegistrarParada(novaParada);

    setHoraInicio(horaFim);
    setHoraFim("");
    setMotivoCodigo("");
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col md:flex-row gap-6 h-full overflow-y-auto md:overflow-hidden">
      {/* ESQUERDA */}
      <div className="w-full md:w-[380px] flex-shrink-0 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Apontar</h1>
              <p className="text-xs text-zinc-500">Registo de inatividade ou produção</p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Máquina</label>
            <select
              value={maquinaId}
              onChange={(e) => {
                setMaquinaId(e.target.value);
                setHoraInicio("");
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none"
            >
              <option value="">Selecione...</option>
              {maquinasAtivas.map((m) => (
                <option key={m.maquinaId} value={m.maquinaId}>
                  {m.nomeExibicao}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Data</label>
            <input
              type="date"
              value={normalizeISODate(dataSelecionada)}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Início</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none text-center"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Fim</label>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none text-center"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Motivo</label>
            <select
              value={motivoCodigo}
              onChange={(e) => setMotivoCodigo(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-base text-white focus:border-red-500 outline-none"
            >
              <option value="">Selecione...</option>
              {motivosDisponiveis.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.codigo} - {m.evento}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleConfirmar}
            className="mt-4 w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
          >
            <Clock size={20} /> Confirmar
          </button>

          <div className="mt-6 border-t border-zinc-800 pt-4" />

          {/* Upload / Modelo */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={abrirUploadExcel}
              disabled={importando}
              className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 transition
                ${
                  importando
                    ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                }`}
              title="Importar Excel"
            >
              <Upload size={14} />
              {importando ? "Importando..." : "Upload"}
            </button>

            <button
              onClick={baixarModeloExcel}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 transition flex items-center gap-2 text-xs"
              title="Baixar modelo Excel"
            >
              <Download size={14} />
              Modelo
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => importarExcel(e.target.files?.[0])}
            />
          </div>
        </div>
      </div>

      {/* DIREITA */}
      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">Histórico do Dia</h2>
            <p className="text-sm text-zinc-500 mt-1">
              {paradasDoDia.length} registro(s) em {formatarDataVisual(normalizeISODate(dataSelecionada))}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-zinc-900 px-5 py-3 rounded-xl border border-zinc-800">
            <AlertOctagon size={20} className="text-red-500" />
            <span className="text-base font-mono font-bold text-zinc-200">
              Total Parado: {Math.floor(totalMinutosParados / 60)}h {totalMinutosParados % 60}m
            </span>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-[140px_1fr_180px_60px] gap-4 px-6 py-3 bg-zinc-900/30 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider shrink-0">
          <div>Horário / Dur.</div>
          <div>Motivo</div>
          <div className="text-right">Máquina</div>
          <div className="text-center">#</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {paradasDoDia.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
              <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                <Clock size={32} opacity={0.5} />
              </div>
              <p className="text-sm font-medium">Nenhum registro encontrado.</p>
            </div>
          ) : (
            paradasDoDia.map((p, idx) => (
              <div
                key={`${p.data}-${p.inicioNorm}-${idx}`}
                className={`group flex flex-col md:grid md:grid-cols-[140px_1fr_180px_60px] gap-3 md:gap-4 items-start md:items-center px-4 py-4 rounded-xl border transition-all
                  ${
                    p.isCritico
                      ? "bg-red-950/20 border-red-500/30 hover:border-red-500/50"
                      : p.isProducao
                      ? "bg-emerald-950/10 border-emerald-900/30 hover:border-emerald-700/50"
                      : "bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-800/60 hover:border-zinc-700"
                  }`}
              >
                <div className="flex flex-col gap-1 w-full">
                  <span className="md:hidden text-[10px] text-zinc-500 uppercase font-bold">
                    Horário / Dur.
                  </span>
                  <span className="text-sm font-mono font-medium text-zinc-200">
                    {p.inicioNorm || "-"} - {p.fimNorm || "-"}
                  </span>
                  <div
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded w-fit text-xs font-bold
                      ${
                        p.isCritico
                          ? "bg-red-500/20 text-red-400"
                          : p.isProducao
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                  >
                    <Timer size={12} /> {Number(p.duracaoMinutos) || 0} min
                  </div>
                </div>

                <div className="min-w-0 flex flex-col justify-center w-full">
                  <span className="md:hidden text-[10px] text-zinc-500 uppercase font-bold">
                    Motivo
                  </span>
                  <span
                    className={`text-sm font-semibold block truncate ${
                      p.isCritico
                        ? "text-red-200"
                        : p.isProducao
                        ? "text-emerald-200"
                        : "text-zinc-200"
                    }`}
                  >
                    {p.descNorm || "-"}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono mt-0.5">{p.motivoNorm || "-"}</span>
                </div>

                <div className="text-left md:text-right truncate flex items-center md:justify-end w-full">
                  <span className="md:hidden text-[10px] text-zinc-500 uppercase font-bold mr-2">
                    Máquina
                  </span>
                  <span className="text-xs font-medium text-zinc-400 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 truncate max-w-full">
                    {getNomeMaquina(p.maquinaNorm)}
                  </span>
                </div>

                <div className="flex justify-end md:justify-center w-full">
                  {deletarParada && (
                    <button
                      onClick={() => deletarParada(p.id)}
                      className="p-2.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Excluir Registro"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
