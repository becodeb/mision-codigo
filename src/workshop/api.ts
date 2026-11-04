// Child-facing API calls.
import { ApiError, get, send } from '../net/http.ts';
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

/** Resolves null when the child has no saved project for this game yet. */
export async function getProject(gameId: string): Promise<ProjectResponse | null> {
  try {
    return await get<ProjectResponse>(projectPath(gameId));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
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
