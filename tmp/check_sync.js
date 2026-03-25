import { db } from '../src/db/database.js';

async function checkSyncStatus() {
    try {
        const lastSyncRes = await db.settings.get('last_sync_timestamp');
        console.log("Last Sync Timestamp in Dexie:", lastSyncRes ? lastSyncRes.value : "None");
        
        const unsyncedCount = {};
        const tables = ['students', 'marks', 'attendance', 'assessments', 'subjects', 'teachers'];
        for (const table of tables) {
            const count = await db[table].where('synced').equals(0).count();
            unsyncedCount[table] = count;
        }
        console.log("Unsynced Records Count:", JSON.stringify(unsyncedCount));
    } catch (e) {
        console.error("Failed to check sync status:", e);
    }
}

checkSyncStatus();
