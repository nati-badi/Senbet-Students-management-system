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
