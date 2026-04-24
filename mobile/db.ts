import { Platform } from 'react-native';

// Lazy-loaded database instance — only created on native (iOS/Android)
let db: any = null;
let isNative = Platform.OS !== 'web';

const getDB = () => {
  if (!db && isNative) {
    try {
      const SQLite = require('expo-sqlite');
      db = SQLite.openDatabaseSync('senbet.db');
    } catch (e) {
      console.warn('⚠️ expo-sqlite not available, falling back to no-op:', e);
      isNative = false;
    }
  }
  return db;
};

export const initDB = () => {
  const database = getDB();
  if (!database) {
    console.log('ℹ️ SQLite skipped (web environment)');
    return;
  }

  try {
    database.execSync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        grade TEXT,
        portalCode TEXT,
        name TEXT,
        data TEXT,
        isDeleted INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
      CREATE INDEX IF NOT EXISTS idx_students_portalCode ON students(portalCode);

      CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        grade TEXT,
        subject TEXT,
        semester TEXT,
        data TEXT,
        isDeleted INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_assessments_grade ON assessments(grade);

      CREATE TABLE IF NOT EXISTS marks (
        id TEXT PRIMARY KEY,
        studentId TEXT,
        assessmentId TEXT,
        data TEXT,
        isDeleted INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_marks_studentId ON marks(studentId);
      CREATE INDEX IF NOT EXISTS idx_marks_assessmentId ON marks(assessmentId);

      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        studentId TEXT,
        date TEXT,
        data TEXT,
        isDeleted INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_attendance_studentId ON attendance(studentId);

      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        grade TEXT,
        semester TEXT,
        data TEXT,
        isDeleted INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        data TEXT
      );
    `);
    console.log('✅ SQLite Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize SQLite database:', error);
  }
};

export const clearDB = () => {
  const database = getDB();
  if (!database) return;
  try {
    database.execSync(`
      DELETE FROM students;
      DELETE FROM assessments;
      DELETE FROM marks;
      DELETE FROM attendance;
      DELETE FROM subjects;
      DELETE FROM settings;
    `);
    console.log('🗑️ SQLite Database cleared');
  } catch (error) {
    console.error('❌ Failed to clear SQLite database:', error);
  }
};

// --- Helper Functions to insert data ---

export const insertStudents = (students: any[]) => {
  const database = getDB();
  if (!database || !students || students.length === 0) return;
  const statement = database.prepareSync(`
    INSERT OR REPLACE INTO students (id, grade, portalCode, name, data, isDeleted) 
    VALUES ($id, $grade, $portalCode, $name, $data, $isDeleted)
  `);
  try {
    database.withTransactionSync(() => {
      for (const s of students) {
        statement.executeSync({
          $id: s.id,
          $grade: s.grade || '',
          $portalCode: s.portalCode || s.portalcode || '',
          $name: s.name || '',
          $data: JSON.stringify(s),
          $isDeleted: s.isDeleted ? 1 : 0
        });
      }
    });
  } finally {
    statement.finalizeSync();
  }
};

export const insertAssessments = (assessments: any[]) => {
  const database = getDB();
  if (!database || !assessments || assessments.length === 0) return;
  const statement = database.prepareSync(`
    INSERT OR REPLACE INTO assessments (id, grade, subject, semester, data, isDeleted) 
    VALUES ($id, $grade, $subject, $semester, $data, $isDeleted)
  `);
  try {
    database.withTransactionSync(() => {
      for (const a of assessments) {
        statement.executeSync({
          $id: a.id,
          $grade: a.grade || '',
          $subject: a.subject || a.subjectname || '',
          $semester: a.semester || '',
          $data: JSON.stringify(a),
          $isDeleted: a.isDeleted ? 1 : 0
        });
      }
    });
  } finally {
    statement.finalizeSync();
  }
};

export const insertMarks = (marks: any[]) => {
  const database = getDB();
  if (!database || !marks || marks.length === 0) return;
  const statement = database.prepareSync(`
    INSERT OR REPLACE INTO marks (id, studentId, assessmentId, data, isDeleted) 
    VALUES ($id, $studentId, $assessmentId, $data, $isDeleted)
  `);
  try {
    database.withTransactionSync(() => {
      for (const m of marks) {
        statement.executeSync({
          $id: m.id,
          $studentId: m.studentId || m.studentid || '',
          $assessmentId: m.assessmentId || m.assessmentid || '',
          $data: JSON.stringify(m),
          $isDeleted: m.isDeleted ? 1 : 0
        });
      }
    });
  } finally {
    statement.finalizeSync();
  }
};

export const insertAttendance = (attendanceRecords: any[]) => {
  const database = getDB();
  if (!database || !attendanceRecords || attendanceRecords.length === 0) return;
  const statement = database.prepareSync(`
    INSERT OR REPLACE INTO attendance (id, studentId, date, data, isDeleted) 
    VALUES ($id, $studentId, $date, $data, $isDeleted)
  `);
  try {
    database.withTransactionSync(() => {
      for (const a of attendanceRecords) {
        statement.executeSync({
          $id: a.id,
          $studentId: a.studentId || a.studentid || '',
          $date: a.date || '',
          $data: JSON.stringify(a),
          $isDeleted: a.isDeleted ? 1 : 0
        });
      }
    });
  } finally {
    statement.finalizeSync();
  }
};

export const insertSubjects = (subjects: any[]) => {
  const database = getDB();
  if (!database || !subjects || subjects.length === 0) return;
  const statement = database.prepareSync(`
    INSERT OR REPLACE INTO subjects (id, grade, semester, data, isDeleted) 
    VALUES ($id, $grade, $semester, $data, $isDeleted)
  `);
  try {
    database.withTransactionSync(() => {
      for (const s of subjects) {
        statement.executeSync({
          $id: s.id,
          $grade: s.grade || '',
          $semester: s.semester || '',
          $data: JSON.stringify(s),
          $isDeleted: s.isDeleted ? 1 : 0
        });
      }
    });
  } finally {
    statement.finalizeSync();
  }
};

export const insertSettings = (settings: any[]) => {
  const database = getDB();
  if (!database || !settings || settings.length === 0) return;
  const statement = database.prepareSync(`
    INSERT OR REPLACE INTO settings (id, data) 
    VALUES ($id, $data)
  `);
  try {
    database.withTransactionSync(() => {
      for (const s of settings) {
        statement.executeSync({
          $id: s.id,
          $data: JSON.stringify(s),
        });
      }
    });
  } finally {
    statement.finalizeSync();
  }
};

// --- Helper Functions to retrieve data ---

export const getAllStudents = (): any[] => {
  const database = getDB();
  if (!database) return [];
  const result = database.getAllSync('SELECT data FROM students WHERE isDeleted = 0');
  return result.map((r: any) => JSON.parse(r.data));
};

export const getGrades = (): string[] => {
  const database = getDB();
  if (!database) return [];
  const result = database.getAllSync('SELECT DISTINCT grade FROM students WHERE isDeleted = 0 AND grade IS NOT NULL AND grade != ""');
  return result.map((r: any) => r.grade).sort((a: any, b: any) => Number(a) - Number(b));
};

export const getStudentsByGrade = (grade: string): any[] => {
  const database = getDB();
  if (!database) return [];
  const result = database.getAllSync('SELECT data FROM students WHERE grade = ? AND isDeleted = 0 ORDER BY name ASC', [grade]);
  return result.map((r: any) => JSON.parse(r.data));
};

export const getStudentByPortalCode = (code: string): any | null => {
  const database = getDB();
  if (!database) return null;
  const result = database.getFirstSync('SELECT data FROM students WHERE portalCode = ? AND isDeleted = 0', [code]);
  return result ? JSON.parse((result as any).data) : null;
};

export const getAllAssessments = (): any[] => {
  const database = getDB();
  if (!database) return [];
  const result = database.getAllSync('SELECT data FROM assessments WHERE isDeleted = 0');
  return result.map((r: any) => JSON.parse(r.data));
};

export const getAllMarks = (): any[] => {
  const database = getDB();
  if (!database) return [];
  const result = database.getAllSync('SELECT data FROM marks WHERE isDeleted = 0');
  return result.map((r: any) => JSON.parse(r.data));
};

export const getAllAttendance = (): any[] => {
  const database = getDB();
  if (!database) return [];
  const result = database.getAllSync('SELECT data FROM attendance WHERE isDeleted = 0');
  return result.map((r: any) => JSON.parse(r.data));
};

export const getAllSubjects = (): any[] => {
  const database = getDB();
  if (!database) return [];
  const result = database.getAllSync('SELECT data FROM subjects WHERE isDeleted = 0');
  return result.map((r: any) => JSON.parse(r.data));
};

export const getAllSettings = (): any[] => {
  const database = getDB();
  if (!database) return [];
  const result = database.getAllSync('SELECT data FROM settings');
  return result.map((r: any) => JSON.parse(r.data));
};
