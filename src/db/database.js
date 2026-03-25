import Dexie from "dexie";

export const db = new Dexie("SenbetSchoolDB");

// Define the tables for the teacher's device and admin
// Define the tables for the teacher's device and admin
db.version(1).stores({
  students: "++id, name, grade, parentContact",
  attendance: "++id, studentId, date, status, synced",
  marks: "++id, studentId, assessmentDate, subject, score, synced"
});

db.version(2).stores({
  students: "++id, name, baptismalName, grade, parentContact",
}).upgrade(trans => {
  // This allows existing v1 databases to update schema safely without migrating specific table rows manually
  return trans.students.toCollection().modify(student => {
    student.baptismalName = student.baptismalName || "";
  });
});

db.version(3).stores({
  students: "++id, name, baptismalName, gender, academicYear, grade, parentContact",
}).upgrade(trans => {
  return trans.students.toCollection().modify(student => {
    student.gender = student.gender || "Male";
    student.academicYear = student.academicYear || new Date().getFullYear().toString();
  });
});

db.version(4).stores({
  students: "++id, name, baptismalName, gender, academicYear, grade, parentContact, synced",
  attendance: "++id, studentId, date, status, synced",
  marks: "++id, studentId, assessmentDate, subject, score, synced"
}).upgrade(trans => {
  trans.students.toCollection().modify(s => { s.synced = s.synced || 0; });
  trans.attendance.toCollection().modify(a => { a.synced = a.synced || 0; });
  trans.marks.toCollection().modify(m => { m.synced = m.synced || 0; });
});

db.version(5).stores({
  students: "++id, name, baptismalName, gender, academicYear, grade, parentContact, synced",
  attendance: "++id, studentId, date, status, synced",
  marks: "++id, studentId, assessmentDate, subject, score, synced",
  subjects: "++id, name, synced"
}).upgrade(trans => {
  trans.subjects.toCollection().modify(s => { s.synced = s.synced || 0; });
});

db.version(6).stores({
  students: "++id, name, baptismalName, gender, academicYear, grade, parentContact, synced",
  attendance: "++id, studentId, date, status, synced",
  marks: "++id, studentId, assessmentDate, subject, score, assessmentId, synced",
  subjects: "++id, name, synced",
  assessments: "++id, name, subjectName, grade, maxScore, date, synced"
}).upgrade(trans => {
  trans.assessments.toCollection().modify(a => { a.synced = a.synced || 0; });
});

db.version(7).stores({
  marks: "++id, [studentId+assessmentId], studentId, assessmentDate, subject, score, assessmentId, synced",
});

db.version(8).stores({
  settings: "key, value" // stores key-value pairs like currentAcademicYear, currentSemester
});

db.version(9).stores({
  students: "++id, name, baptismalName, gender, academicYear, grade, parentContact, portalCode, synced",
}).upgrade(trans => {
  return trans.students.toCollection().modify(s => {
    // Generate a simple 6-digit random code for existing students if they don't have one
    if (!s.portalCode) {
      s.portalCode = Math.floor(100000 + Math.random() * 900000).toString();
    }
  });
});

db.version(10).stores({
  teachers: "++id, name, phone, assignedGrades, assignedSubjects, synced"
});

db.version(11).stores({
  teachers: "++id, name, phone, accessCode, assignedGrades, assignedSubjects, synced"
}).upgrade(trans => {
  return trans.teachers.toCollection().modify(t => {
    if (!t.accessCode) {
      t.accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    }
  });
});

db.version(12).stores({
  templates: "++id, type, name, config, isDefault, synced"
});

db.version(13).stores({
  assessments: "++id, name, subjectName, grade, maxScore, date, semester, synced",
  attendance: "++id, studentId, date, status, semester, synced",
});

db.version(14).stores({
  subjects: "++id, name, semester, synced",
});

db.version(15).stores({
  assessments: "++id, name, subjectName, grade, maxScore, date, synced",
});

db.version(16).stores({
  students: "++id, name, baptismalName, gender, academicYear, grade, parentContact, portalCode, synced",
  attendance: "++id, studentId, date, status, semester, synced",
  marks: "++id, studentId, assessmentDate, subject, score, assessmentId, synced",
  subjects: "++id, name, semester, synced",
  assessments: "++id, name, subjectName, grade, maxScore, date, synced",
  teachers: "++id, name, phone, accessCode, assignedGrades, assignedSubjects, synced",
  settings: "key, value"
});

db.version(18).stores({
  students: "++id, name, baptismalName, gender, academicYear, grade, parentContact, portalCode, synced, updated_at",
  attendance: "++id, studentId, date, status, semester, synced, updated_at, [studentId+date]",
  marks: "++id, studentId, assessmentDate, subject, score, assessmentId, semester, synced, updated_at, [studentId+assessmentId]",
  subjects: "++id, name, semester, synced, updated_at",
  assessments: "++id, name, subjectName, grade, maxScore, date, semester, synced, updated_at",
  teachers: "++id, name, phone, accessCode, assignedGrades, assignedSubjects, synced, updated_at",
  settings: "key, value, updated_at"
});

db.version(19).stores({
  students: "++id, name, baptismalName, gender, academicYear, grade, parentContact, portalCode, synced, updated_at",
  attendance: "++id, studentId, date, status, semester, synced, updated_at, [studentId+date]",
  marks: "++id, studentId, assessmentDate, subject, score, assessmentId, semester, synced, updated_at, [studentId+assessmentId]",
  subjects: "++id, name, semester, synced, updated_at",
  assessments: "++id, name, subjectName, grade, maxScore, date, semester, synced, updated_at",
  teachers: "++id, name, phone, accessCode, assignedGrades, assignedSubjects, synced, updated_at",
  settings: "key, value, updated_at",
  deleted_records: "++id, tableName, recordId"
});
