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
