// Request and response types for every route. Shared by the server and the browser:
// keep this file free of Node APIs.
import type { ClassId, LevelId } from './levels.ts';

export const GAME_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
/** Largest accepted request body, project included. */
export const MAX_BODY_BYTES = 512 * 1024;

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface OkResponse {
  ok: true;
}

// ---- Child ----

export interface StudentListItem {
  id: number;
  name: string;
  group: string;
}
export interface StudentsResponse {
  students: StudentListItem[];
}

export interface SessionRequest {
  studentId: number;
}
export interface SessionStudent {
  id: number;
  name: string;
  group: string;
  level: LevelId;
}
export interface SessionResponse {
  student: SessionStudent;
  activeClass: ClassId;
}

export interface SettingsResponse {
  activeClass: ClassId;
}

export interface CompletedStep {
  id: string;
  /** ISO timestamp of the moment the step was completed. */
  at: string;
}
export interface GameProgress {
  currentStep: string | null;
  completedSteps: CompletedStep[];
  activeSeconds: number;
  finished: boolean;
}

export interface ProjectSummary {
  gameId: string;
  progress: GameProgress;
  updatedAt: string;
}
export interface ProjectsResponse {
  projects: ProjectSummary[];
}
export interface ProjectResponse extends ProjectSummary {
  /** Opaque to the server. */
  project: unknown;
}
export interface SaveProjectRequest {
  project: unknown;
  progress: GameProgress;
}
export interface SaveProjectResponse {
  gameId: string;
  updatedAt: string;
}

// ---- Teacher ----

export interface AdminLoginRequest {
  password: string;
}
export interface AdminSessionResponse {
  authenticated: boolean;
  /** False when the server runs without ADMIN_PASSWORD. */
  loginEnabled: boolean;
}

export interface AdminStudent {
  id: number;
  name: string;
  group: string;
  level: LevelId;
  createdAt: string;
}
export interface AdminStudentsResponse {
  students: AdminStudent[];
}
export interface AdminStudentResponse {
  student: AdminStudent;
}
export interface CreateStudentRequest {
  name: string;
  group: string;
  level: LevelId;
}
export interface UpdateStudentRequest {
  name?: string;
  group?: string;
  level?: LevelId;
}

export interface ImportStudentsRequest {
  /** One child per line: `Nombre, grupo, nivel` separated by commas or tabs. */
  text: string;
}
export interface ImportLineError {
  /** 1-based line number in the pasted text. */
  line: number;
  message: string;
}
export interface ImportStudentsResponse {
  created: number;
  updated: number;
  errors: ImportLineError[];
}

export interface UpdateSettingsRequest {
  activeClass: ClassId;
}

export interface ProgressEntry {
  studentId: number;
  name: string;
  group: string;
  level: LevelId;
  gameId: string;
  currentStep: string | null;
  completedCount: number;
  activeSeconds: number;
  finished: boolean;
  updatedAt: string;
}
export interface StuckStep {
  stepId: string;
  /** Unfinished students currently stopped at this step. */
  count: number;
}
export interface GameAggregate {
  gameId: string;
  /** Students who have a project for this game. */
  started: number;
  finished: number;
  averageActiveSeconds: number;
  /** Steps with the most unfinished students, most crowded first (at most 3). */
  stuckSteps: StuckStep[];
}
export interface AdminProgressResponse {
  entries: ProgressEntry[];
  games: GameAggregate[];
}
