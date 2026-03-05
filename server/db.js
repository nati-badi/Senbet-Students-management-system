const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server-db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Students table
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        baptismalName TEXT,
        gender TEXT,
        academicYear TEXT,
        grade TEXT,
        parentContact TEXT
    )`);

    // Attendance table
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        studentId TEXT,
        date TEXT,
        status TEXT,
        FOREIGN KEY (studentId) REFERENCES students (id)
    )`);

    // Marks table
    db.run(`CREATE TABLE IF NOT EXISTS marks (
        id TEXT PRIMARY KEY,
        studentId TEXT,
        assessmentDate TEXT,
        subject TEXT,
        score REAL,
        FOREIGN KEY (studentId) REFERENCES students (id)
    )`);
});

module.exports = db;
