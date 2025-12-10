// src/data/catalogoProdutos.js

import { CATALOGO_TELHAS } from './catalogoTelhas';
import { CATALOGO_PERFIL } from './catalogoPerfil';

// Catálogo geral de PA para quem ainda importa CATALOGO_PRODUTOS
export const CATALOGO_PRODUTOS = [
  ...CATALOGO_TELHAS,
  ...CATALOGO_PERFIL,
];


''