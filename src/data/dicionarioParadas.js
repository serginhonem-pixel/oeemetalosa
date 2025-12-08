// src/data/dicionarioEventos.js

export const DICIONARIO_PARADAS = [
  { codigo: 'IN001', evento: 'Diálogo de Segurança do Trabalho (DDS)', grupo: 'IND' },
  { codigo: 'IN003', evento: 'Setup (Preparação de Máquina)', grupo: 'IND' },
  { codigo: 'IN005', evento: 'Manutenção Corretiva', grupo: 'IND' },
  { codigo: 'IN007', evento: 'Treinamento / Reunião Geral', grupo: 'IND' },
  { codigo: 'IN013', evento: 'Aguardando ferramental', grupo: 'IND' },
  { codigo: 'IN014', evento: 'Falta de matéria prima', grupo: 'IND' },
  { codigo: 'IN016', evento: 'Falta de colaborador', grupo: 'IND' },
  { codigo: 'IN017', evento: 'Espera por empilhadeira', grupo: 'IND' },
  { codigo: 'IN021', evento: 'Organização do setor - 5S', grupo: 'IND' },
  { codigo: 'IN024', evento: 'Aguardando equipamento compartilhado', grupo: 'IND' },
  { codigo: 'IN032', evento: 'Manutenção Autônoma', grupo: 'IND' },
  { codigo: 'IN033', evento: 'Revezamento', grupo: 'IND' },

  { codigo: 'PP001', evento: 'Máquina não planejada', grupo: 'PP' },
  { codigo: 'PP002', evento: 'Manutenção Programada', grupo: 'PP' },
  { codigo: 'PP006', evento: 'Refeição (almoço, jantar e lanche)', grupo: 'PP' },
  { codigo: 'PP009', evento: 'Parada programada da planta', grupo: 'PP' },

  { codigo: 'RE002', evento: 'Inspeção ou troca ferramental', grupo: 'RET' },
  { codigo: 'RE005', evento: 'Regulagem-Problema ferramental', grupo: 'RET' },
  { codigo: 'RE006', evento: 'Regulagem-Problema de matéria Prima', grupo: 'RET' },
  { codigo: 'RE007', evento: 'Regulagem-Problema de processo', grupo: 'RET' },
  { codigo: 'RE008', evento: 'Regulagem-Problema equipamento', grupo: 'RET' },

  { codigo: 'TU001', evento: 'Produção', grupo: 'TU' },
  { codigo: 'TU002', evento: 'Abastecimento de máquina', grupo: 'TU' },
  { codigo: 'TU003', evento: 'Produção Velocidade Reduzida', grupo: 'TU' },
  { codigo: 'TU004', evento: 'Retirada de Material', grupo: 'TU' },
];