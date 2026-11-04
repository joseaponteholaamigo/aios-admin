// Las escrituras de la API de admin del proceso, armadas con la configuración.
import { getConfig } from '../config/config.server';
import { createAdminWriteApi, type AdminWriteApi } from './admin-write-api.server';

let api: AdminWriteApi | null = null;

export function getAdminWriteApi(): AdminWriteApi {
  api ??= createAdminWriteApi({ baseUrl: getConfig().adminApiUrl });
  return api;
}
