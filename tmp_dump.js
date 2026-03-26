import Dexie from 'dexie';

const db = new Dexie('SenbetSchoolDB');
db.version(131).stores({
  students: "++id, name, baptismalName, gender, academicYear, grade, parentContact, portalCode, synced, updated_at"
});

async function dump() {
  try {
    const students = await db.table('students').limit(5).toArray();
    console.log(JSON.stringify(students, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

dump();
