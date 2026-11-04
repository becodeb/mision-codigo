// Teacher API calls. A 401 on any call after login tells the panel the session ended.
import { ApiError, get, send } from '../net/http.ts';
import type {
  AdminProgressResponse,
  AdminSessionResponse,
  AdminStudentResponse,
  AdminStudentsResponse,
  CreateStudentRequest,
  ImportStudentsResponse,
  OkResponse,
  SettingsResponse,
  UpdateStudentRequest,
} from '../shared/api.ts';
import type { ClassId } from '../shared/levels.ts';

const authLostListeners = new Set<() => void>();

/** Subscribes to "the teacher session is gone". Returns the unsubscribe function. */
export function onAuthLost(listener: () => void): () => void {
  authLostListeners.add(listener);
  return () => {
    authLostListeners.delete(listener);
  };
}

async function guarded<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) authLostListeners.forEach((listener) => listener());
    throw error;
  }
}

// Session calls are not guarded: a 401 on login means a wrong password, not a lost session.
export const getAdminSession = () => get<AdminSessionResponse>('/api/admin/session');
export const login = (password: string) => send<OkResponse>('POST', '/api/admin/session', { password });
export const logout = () => send<OkResponse>('DELETE', '/api/admin/session');

export const listStudents = () => guarded(get<AdminStudentsResponse>('/api/admin/students'));
export const createStudent = (body: CreateStudentRequest) =>
  guarded(send<AdminStudentResponse>('POST', '/api/admin/students', body));
export const updateStudent = (id: number, patch: UpdateStudentRequest) =>
  guarded(send<AdminStudentResponse>('PATCH', `/api/admin/students/${id}`, patch));
export const deleteStudent = (id: number) => guarded(send<OkResponse>('DELETE', `/api/admin/students/${id}`));
export const importStudents = (text: string) =>
  guarded(send<ImportStudentsResponse>('POST', '/api/admin/students/import', { text }));

export const getSettings = () => get<SettingsResponse>('/api/settings');
export const setActiveClass = (activeClass: ClassId) =>
  guarded(send<SettingsResponse>('PATCH', '/api/admin/settings', { activeClass }));

export const getProgress = () => guarded(get<AdminProgressResponse>('/api/admin/progress'));
export const deleteProject = (studentId: number, gameId: string) =>
  guarded(send<OkResponse>('DELETE', `/api/admin/students/${studentId}/projects/${encodeURIComponent(gameId)}`));
