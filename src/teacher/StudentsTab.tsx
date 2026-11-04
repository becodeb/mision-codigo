// Container for the «Alumnos» tab.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../net/http.ts';
import type { AdminStudent, CreateStudentRequest, ImportStudentsResponse, UpdateStudentRequest } from '../shared/api.ts';
import { teamName } from '../shared/levels.ts';
import type { LevelId } from '../shared/levels.ts';
import * as adminApi from './adminApi.ts';
import { QuickAdd } from './QuickAdd.tsx';
import { ImportBox } from './RosterForms.tsx';
import { createLevelSaver, findDuplicate, withLevel } from './roster.ts';
import { StudentList } from './StudentList.tsx';

export const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Algo salió mal. Pruebe de nuevo.';

const duplicateMessage = (name: string, group: string): string =>
  `Ya hay un alumno llamado «${name}»${group ? ` en ${group}` : ' sin grado'}. Si son dos chicos distintos, agregue la inicial del apellido.`;

const levelSaveMessage = (name: string, error: unknown): string =>
  error instanceof ApiError && !error.isNetwork
    ? `No se guardó el nivel de ${name}: ${error.message}`
    : `No se guardó el nivel de ${name}. Revise la conexión y pruebe de nuevo.`;

export function StudentsTab() {
  const [students, setStudents] = useState<AdminStudent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [levelErrors, setLevelErrors] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const studentsRef = useRef<AdminStudent[] | null>(null);
  studentsRef.current = students;
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const nameOf = (id: number): string => studentsRef.current?.find((s) => s.id === id)?.name ?? 'el alumno';

  const saver = useMemo(
    () =>
      createLevelSaver({
        save: (id, level) => adminApi.updateStudent(id, { level }),
        apply: (id, level) => setStudents((list) => (list ? withLevel(list, id, level) : list)),
        onSaved: (id, level) => {
          setLevelErrors((errors) => {
            if (!(id in errors)) return errors;
            const { [id]: _gone, ...rest } = errors;
            return rest;
          });
          setNotice(`${nameOf(id)} pasó al ${teamName(level)}.`);
          clearTimeout(noticeTimer.current);
          noticeTimer.current = setTimeout(() => setNotice(null), 3500);
        },
        onError: (id, error) => setLevelErrors((errors) => ({ ...errors, [id]: levelSaveMessage(nameOf(id), error) })),
      }),
    // nameOf only reads a ref.
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const { students: list } = await adminApi.listStudents();
      saver.forget();
      setLevelErrors({});
      setStudents(list);
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [saver]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changeLevel = (student: AdminStudent, level: LevelId) => {
    setLevelErrors(({ [student.id]: _gone, ...rest }) => rest);
    saver.change(student.id, student.level, level);
  };

  const update = async (id: number, patch: UpdateStudentRequest): Promise<string | null> => {
    try {
      const { student } = await adminApi.updateStudent(id, patch);
      setStudents((list) => list?.map((s) => (s.id === id ? student : s)) ?? list);
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  };

  const remove = async (id: number): Promise<string | null> => {
    try {
      await adminApi.deleteStudent(id);
      saver.forget(id);
      setStudents((list) => list?.filter((s) => s.id !== id) ?? list);
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  };

  const add = async (input: CreateStudentRequest): Promise<{ error: string } | { added: string }> => {
    const clash = studentsRef.current ? findDuplicate(studentsRef.current, input.name, input.group) : undefined;
    if (clash) return { error: duplicateMessage(clash.name, clash.group) };
    try {
      const { student } = await adminApi.createStudent(input);
      setStudents((list) => (list ? [...list, student] : [student]));
      return { added: student.name };
    } catch (error) {
      if (error instanceof ApiError && error.code === 'student_exists') {
        return { error: duplicateMessage(input.name, input.group) };
      }
      return { error: errorMessage(error) };
    }
  };

  const importList = async (text: string): Promise<ImportStudentsResponse | string> => {
    try {
      const result = await adminApi.importStudents(text);
      await refresh();
      return result;
    } catch (error) {
      return errorMessage(error);
    }
  };

  return (
    <div className="t-stack">
      <QuickAdd onAdd={add} />
      {loadError && (
        <p className="t-alert" role="alert">
          No se pudo cargar la lista: {loadError}{' '}
          <button className="t-btn" onClick={() => void refresh()}>Reintentar</button>
        </p>
      )}
      {students === null && !loadError && <p className="t-muted" role="status">Cargando alumnos…</p>}
      {students && (
        <StudentList
          students={students}
          levelErrors={levelErrors}
          notice={notice}
          onLevel={changeLevel}
          onUpdate={update}
          onDelete={remove}
        />
      )}
      <ImportBox onImport={importList} />
    </div>
  );
}
