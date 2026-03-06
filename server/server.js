const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Process Error Listeners
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/sync - Pull all data from server
app.get('/api/sync', async (req, res) => {
    console.log('Incoming GET /api/sync request');
    const data = { students: [], attendance: [], marks: [] };

    try {
        const getStudents = () => new Promise((resolve, reject) => {
            db.all("SELECT * FROM students", [], (err, rows) => err ? reject(err) : resolve(rows));
        });
        const getAttendance = () => new Promise((resolve, reject) => {
            db.all("SELECT * FROM attendance", [], (err, rows) => err ? reject(err) : resolve(rows));
        });
        const getMarks = () => new Promise((resolve, reject) => {
            db.all("SELECT * FROM marks", [], (err, rows) => err ? reject(err) : resolve(rows));
        });

        data.students = await getStudents();
        data.attendance = await getAttendance();
        data.marks = await getMarks();

        console.log(`Sending sync data: ${data.students.length} students, ${data.attendance.length} attendance, ${data.marks.length} marks`);
        res.json(data);
    } catch (err) {
        console.error('Error in GET /api/sync:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sync - Receive data from local device (Upsert)
app.post('/api/sync', (req, res) => {
    console.log('Incoming POST /api/sync request');
    const { students, attendance, marks } = req.body;
    console.log(`Received: ${students?.length || 0} students, ${attendance?.length || 0} attendance, ${marks?.length || 0} marks`);

    db.serialize(() => {
        let errorOccurred = false;

        // Students Upsert
        if (students && students.length > 0) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO students (id, name, baptismalName, gender, academicYear, grade, parentContact) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            students.forEach(s => stmt.run(s.id, s.name, s.baptismalName, s.gender, s.academicYear, s.grade, s.parentContact, (err) => {
                if (err) { console.error('Error inserting student:', err); errorOccurred = true; }
            }));
            stmt.finalize();
        }

        // Attendance Upsert
        if (attendance && attendance.length > 0) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO attendance (id, studentId, date, status) VALUES (?, ?, ?, ?)`);
            attendance.forEach(a => stmt.run(a.id, a.studentId, a.date, a.status, (err) => {
                if (err) { console.error('Error inserting attendance:', err); errorOccurred = true; }
            }));
            stmt.finalize();
        }

        // Marks Upsert
        if (marks && marks.length > 0) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO marks (id, studentId, assessmentDate, subject, score) VALUES (?, ?, ?, ?, ?)`);
            marks.forEach(m => stmt.run(m.id, m.studentId, m.assessmentDate, m.subject, m.score, (err) => {
                if (err) { console.error('Error inserting mark:', err); errorOccurred = true; }
            }));
            stmt.finalize();
        }

        if (errorOccurred) {
            console.error('One or more errors occurred during SQLite upsert');
        } else {
            console.log('Successfully processed sync data');
        }
    });

    res.json({ status: 'success', message: 'Sync processed (check server logs for details)' });
});

// DELETE /api/sync/clear - Wipe all data from the master database
app.delete('/api/sync/clear', async (req, res) => {
    console.log('Incoming DELETE /api/sync/clear request - WIPING ALL DATA');

    const run = (sql) => new Promise((resolve, reject) => {
        db.run(sql, (err) => err ? reject(err) : resolve());
    });

    try {
        await run('DELETE FROM students');
        await run('DELETE FROM attendance');
        await run('DELETE FROM marks');
        // Compact the DB file after a wipe
        db.run('VACUUM', (err) => { if (err) console.error('Vacuum error:', err); });
        console.log('Successfully Wiped Database');
        res.json({ status: 'success', message: 'Database wiped clean' });
    } catch (err) {
        console.error('Failed to wipe database:', err);
        res.status(500).json({ error: 'Failed to wipe database: ' + err.message });
    }
});


app.listen(PORT, () => {
    console.log(`Senbet School Server running on http://localhost:${PORT}`);
});
