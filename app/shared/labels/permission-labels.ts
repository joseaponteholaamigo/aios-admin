// Los nombres que ve la persona para cada módulo y cada nivel.
import type { Level, Module } from '../../domain/permissions';

export const MODULE_LABELS: Record<Module, string> = {
  overview: 'Vista general',
  companies: 'Empresas',
  interviews: 'Entrevistas',
  documents: 'Documentos',
  documentText: 'Texto de los documentos',
  skills: 'Skills',
  clientUsers: 'Usuarios',
  usage: 'Consumo',
  governance: 'Gobernanza',
  upsell: 'Upsell',
};

export const LEVEL_LABELS: Record<Level, string> = {
  view: 'Ver',
  edit: 'Editar',
};
