// Las lecturas de la API de admin del proceso, armadas con la configuración.
import { getConfig } from '../config/config.server';
import { createAdminReadApi, type AdminReadApi } from './admin-read-api.server';

let api: AdminReadApi | null = null;

export function getAdminReadApi(): AdminReadApi {
  api ??= createAdminReadApi({ baseUrl: getConfig().adminApiUrl });
  return api;
}
