// La fuente de `/yo` del proceso, armada con la configuración.
import { getConfig } from '../config/config.server';
import { createAdminApi } from './admin-api.server';
import { createTeamMemberSource, type TeamMemberSource } from './team-member-source.server';

let source: TeamMemberSource | null = null;

export function getTeamMemberSource(): TeamMemberSource {
  source ??= createTeamMemberSource({ api: createAdminApi({ baseUrl: getConfig().adminApiUrl }) });
  return source;
}
