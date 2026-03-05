import { db } from '../db/database';

export const API_BASE = 'http://localhost:5000/api';

export async function syncData() {
    console.log("Starting synchronization...");
    try {
        // 1. PUSH local changes to Server
        const unsyncedStudents = await db.students.where('synced').equals(0).toArray();
        const unsyncedAttendance = await db.attendance.where('synced').equals(0).toArray();
        const unsyncedMarks = await db.marks.where('synced').equals(0).toArray();

        // Migration: Ensure all records have IDs (for data added before UUID switch)
        for (const s of unsyncedStudents) if (!s.id) { s.id = crypto.randomUUID(); await db.students.put(s); }
        for (const a of unsyncedAttendance) if (!a.id) { a.id = crypto.randomUUID(); await db.attendance.put(a); }
        for (const m of unsyncedMarks) if (!m.id) { m.id = crypto.randomUUID(); await db.marks.put(m); }

        console.log(`Local unsynced data: ${unsyncedStudents.length} students, ${unsyncedAttendance.length} attendance, ${unsyncedMarks.length} marks`);

        if (unsyncedStudents.length > 0 || unsyncedAttendance.length > 0 || unsyncedMarks.length > 0) {
            console.log("Pushing data to server...");
            const pushResponse = await fetch(`${API_BASE}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    students: unsyncedStudents,
                    attendance: unsyncedAttendance,
                    marks: unsyncedMarks
                })
            });

            if (pushResponse.ok) {
                const pushResult = await pushResponse.json();
                console.log("Server accepted push:", pushResult);

                // Mark as synced locally
                const studentIds = unsyncedStudents.map(s => s.id);
                const attendanceIds = unsyncedAttendance.map(a => a.id);
                const markIds = unsyncedMarks.map(m => m.id);

                await db.students.where('id').anyOf(studentIds).modify({ synced: 1 });
                await db.attendance.where('id').anyOf(attendanceIds).modify({ synced: 1 });
                await db.marks.where('id').anyOf(markIds).modify({ synced: 1 });
                console.log("Locally marked records as synced.");
            } else {
                const errText = await pushResponse.text();
                console.error("Server push failed:", pushResponse.status, errText);
                throw new Error(`Server push failed with status ${pushResponse.status}`);
            }
        }

        // 2. PULL master data from Server
        console.log("Pulling data from server...");
        const pullResponse = await fetch(`${API_BASE}/sync`);
        if (pullResponse.ok) {
            const data = await pullResponse.json();
            console.log(`Received from server: ${data.students?.length || 0} students, ${data.attendance?.length || 0} attendance, ${data.marks?.length || 0} marks`);

            // bulkPut ensures we upsert (replace existing by ID)
            if (data.students?.length) await db.students.bulkPut(data.students.map(s => ({ ...s, synced: 1 })));
            if (data.attendance?.length) await db.attendance.bulkPut(data.attendance.map(a => ({ ...a, synced: 1 })));
            if (data.marks?.length) await db.marks.bulkPut(data.marks.map(m => ({ ...m, synced: 1 })));
            console.log("Local database updated with server data.");
        } else {
            console.error("Server pull failed:", pullResponse.status);
            throw new Error(`Server pull failed with status ${pullResponse.status}`);
        }

        console.log("Synchronization finished successfully.");
        return { success: true };
    } catch (error) {
        console.error("Sync process error:", error);
        return { success: false, error: error.message };
    }
}
