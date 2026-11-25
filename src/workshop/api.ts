// Child-facing API calls.
import { ApiError, get, send } from '../net/http.ts';
import type { ServerProject } from './autosave.ts';
import type {
  OkResponse,
  ProjectResponse,
  ProjectsResponse,
  SaveProjectRequest,
  SaveProjectResponse,
  SessionResponse,
  StudentsResponse,
} from '../shared/api.ts';

const projectPath = (gameId: string) => `/api/projects/${encodeURIComponent(gameId)}`;

export const listStudents = () => get<StudentsResponse>('/api/students');
export const startSession = (studentId: number) => send<SessionResponse>('POST', '/api/session', { studentId });
export const getSession = () => get<SessionResponse>('/api/session');
export const endSession = () => send<OkResponse>('DELETE', '/api/session');
export const listProjects = () => get<ProjectsResponse>('/api/projects');

export async function getProject(gameId: string): Promise<ServerProject> {
  try {
    const saved = await get<ProjectResponse>(projectPath(gameId));
    return { saved, epoch: saved.epoch };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { saved: null, epoch: error.epoch ?? 0 };
    throw error;
  }
}

export const saveProject = (gameId: string, body: SaveProjectRequest) =>
  send<SaveProjectResponse>('PUT', projectPath(gameId), body);

/** Last-chance save while the page closes. The body is already serialized and small. */
export function saveProjectKeepalive(gameId: string, body: string): void {
  void fetch(projectPath(gameId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => undefined);
}
