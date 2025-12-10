// src/data/oeeCatalogHelpers.js

import { CATALOGO_PERFIL } from './catalogoPerfil';
import { CATALOGO_TELHAS } from './catalogoTelhas';
import { GRUPOS_MAQUINAS } from './gruposMaquinas';
import { CATALOGO_MAQUINAS } from './catalogoMaquinas';

// -----------------------------------------------------------------------------
// 1) CATÁLOGO ÚNICO DE PRODUTOS ACABADOS (PA)
// -----------------------------------------------------------------------------

export const CATALOGO_PA = [
  ...CATALOGO_TELHAS,
  ...CATALOGO_PERFIL,
];

// -----------------------------------------------------------------------------
// 2) MAPA RÁPIDO POR CÓDIGO (PRODUTOS)
// -----------------------------------------------------------------------------

const normalizeCod = (cod) => String(cod ?? '').trim();

const MAPA_PA_POR_COD = CATALOGO_PA.reduce((acc, item) => {
  const key = normalizeCod(item.cod);
  if (key) acc[key] = item;
  return acc;
}, {});

export const getProdutoByCod = (cod) => {
  const key = normalizeCod(cod);
  return MAPA_PA_POR_COD[key] || null;
};

export const getGrupoByCod = (cod) => {
  const prod = getProdutoByCod(cod);
  return prod?.grupo || null;
};

export const getGruposDisponiveis = () => {
  const set = new Set(
    CATALOGO_PA.map((p) => p.grupo).filter(Boolean)
  );
  return Array.from(set); // ['GRUPO_TELHAS', 'GRUPO_PERFIS']
};

export const getProdutosByGrupo = (grupoId) =>
  CATALOGO_PA.filter((p) => p.grupo === grupoId);

// -----------------------------------------------------------------------------
// 3) MAPA DE MÁQUINAS
// -----------------------------------------------------------------------------

const MAPA_MAQ_POR_ID = CATALOGO_MAQUINAS.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

// Pega máquina pelo id (ex.: 'PERFIL_U_MARAFON')
export const getMaquinaById = (maquinaId) =>
  MAPA_MAQ_POR_ID[maquinaId] || null;

// Pega o objeto do grupo de máquinas pelo id do grupo (GRUPO_TELHAS / GRUPO_PERFIS)
export const getGrupoMaquinas = (grupoId) =>
  GRUPOS_MAQUINAS.find((g) => g.id === grupoId) || null;

// Retorna **objetos de máquina** do grupo (não só os ids)
export const getMaquinasByGrupo = (grupoId) => {
  const grupo = getGrupoMaquinas(grupoId);
  if (!grupo) return [];
  return grupo.maquinas
    .map((maqId) => getMaquinaById(maqId))
    .filter(Boolean);
};
