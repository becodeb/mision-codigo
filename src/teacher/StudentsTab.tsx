// Container for the «Alumnos» tab.
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../net/http.ts';
import type { AdminStudent, CreateStudentRequest, ImportStudentsResponse, UpdateStudentRequest } from '../shared/api.ts';
import * as adminApi from './adminApi.ts';
import { AddStudentForm, ImportBox } from './RosterForms.tsx';
import { StudentsTable } from './StudentsTable.tsx';

export const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Algo salió mal. Pruebe de nuevo.';

export function StudentsTab() {
  const [students, setStudents] = useState<AdminStudent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStudents((await adminApi.listStudents()).students);
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      setStudents((list) => list?.filter((s) => s.id !== id) ?? list);
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  };

  const add = async (input: CreateStudentRequest): Promise<string | null> => {
    try {
      await adminApi.createStudent(input);
      await refresh();
      return null;
    } catch (error) {
      return errorMessage(error);
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
      {loadError && (
        <p className="t-alert" role="alert">
          No se pudo cargar la lista: {loadError}{' '}
          <button className="t-btn" onClick={() => void refresh()}>Reintentar</button>
        </p>
      )}
      {students === null && !loadError && <p className="t-muted" role="status">Cargando alumnos…</p>}
      {students && <StudentsTable students={students} onUpdate={update} onDelete={remove} />}
      <AddStudentForm onAdd={add} />
      <ImportBox onImport={importList} />
    </div>
  );
}
