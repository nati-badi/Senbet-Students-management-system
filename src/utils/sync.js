import { db } from '../db/database';
import { supabase } from './supabaseClient';

export const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : `http://${window.location.hostname}:5000/api`;

export async function syncData() {
    console.log("--- Starting synchronization session ---");

    if (!supabase) {
        const msg = "Cloud Sync is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.";
        console.warn(msg);
        return { success: false, error: msg };
    }

    try {
        // Table order matters for foreign keys: push/pull parents before children
        const TABLES = [
            'subjects',     // Parent of assessments (theoretically)
            'students',     // Parent of attendance/marks
            'assessments',  // Parent of marks
            'attendance',   // Child of students
            'marks',        // Child of students and assessments
            'teachers',     // Independent
            'templates'     // Independent
        ];

        let pushedTotal = 0;
        let pulledTotal = 0;
        let tableStatus = {}; 

        // --- 0. PRE-SYNC: GET TIMESTAMP ---
        const lastSyncRes = await db.settings.get('last_sync_timestamp');
        // Subtract 1 minute safety buffer to account for clock drift between client and server
        const lastSyncTime = lastSyncRes 
            ? new Date(new Date(lastSyncRes.value).getTime() - 60000).toISOString() 
            : '1970-01-01T00:00:00Z';
        
        console.log(`Syncing changes since: ${lastSyncTime}`);
        const currentSyncStartedAt = new Date().toISOString();

        // --- 1. SETTINGS SYNC (Special Case) ---
        try {
            const localSettings = await db.settings.toArray();
            const normalizedSettings = localSettings
                .filter(s => s.key !== 'last_sync_timestamp')
                .map(s => ({
                    key: s.key,
                    value: typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value),
                    synced: 1
                }));
            
            if (normalizedSettings.length > 0) {
                await supabase.from('settings').upsert(normalizedSettings, { onConflict: 'key' });
            }

            const { data: cloudSettings } = await supabase
                .from('settings')
                .select('*')
                .gt('updated_at', lastSyncTime);
            
            if (cloudSettings) {
                for (const s of cloudSettings) {
                    let val = s.value;
                    try { if (val && (val.startsWith('{') || val.startsWith('['))) val = JSON.parse(val); } catch (e) {}
                    await db.settings.put({ key: s.key, value: val });
                }
            }
        } catch (e) { console.warn("Settings sync warning:", e); }

        // --- 2. MAIN SYNC LOOP ---
        for (const tableName of TABLES) {
            console.log(`\n--- Syncing Table: ${tableName} ---`);
            try {
                const tableDb = db[tableName];
                if (!tableDb) {
                    tableStatus[tableName] = { status: 'skipped', error: 'Not in local DB' };
                    continue;
                }

                // --- 2a. PUSH PHASE ---
                let unsyncedRecords = await tableDb.where('synced').equals(0).toArray();
                let tablePushed = 0;

                if (unsyncedRecords.length > 0) {
                    console.log(`Pushing ${unsyncedRecords.length} unsynced records...`);
                    
                    // Normalize for Postgres (lowercase keys)
                    const cleanRecords = unsyncedRecords.map(record => {
                        const { synced, ...rest } = record;
                        const normalized = {};
                        // Ensure ID exists
                        if (!rest.id) rest.id = crypto.randomUUID();
                        
                        Object.keys(rest).forEach(key => {
                            normalized[key.toLowerCase()] = rest[key];
                        });
                        return normalized;
                    });

                    const { error: pushError } = await supabase
                        .from(tableName)
                        .upsert(cleanRecords, { onConflict: 'id' });

                    if (pushError) {
                        console.error(`Push failed for ${tableName}:`, pushError);
                        tableStatus[tableName] = { ...tableStatus[tableName], push: 'error', error: pushError.message };
                    } else {
                        // Mark as synced locally
                        const ids = unsyncedRecords.map(r => r.id);
                        await tableDb.where('id').anyOf(ids).modify({ synced: 1 });
                        tablePushed = cleanRecords.length;
                        pushedTotal += tablePushed;
                        tableStatus[tableName] = { ...tableStatus[tableName], push: 'ok', pushed: tablePushed };
                    }
                } else {
                    tableStatus[tableName] = { ...tableStatus[tableName], push: 'idle' };
                }

                // --- 2b. PULL PHASE ---
                console.log(`Pulling updates since ${lastSyncTime}...`);
                const { data: cloudData, error: pullError } = await supabase
                    .from(tableName)
                    .select('*')
                    .gt('updated_at', lastSyncTime);

                if (pullError) {
                    console.error(`Pull failed for ${tableName}:`, pullError);
                    tableStatus[tableName] = { ...tableStatus[tableName], pull: 'error', error: pullError.message };
                } else if (cloudData && cloudData.length > 0) {
                    console.log(`Pulled ${cloudData.length} records. Filtering local conflicts...`);
                    
                    // Filter out records that are currently unsynced locally to prevent data loss
                    const currentUnsynced = await tableDb.where('synced').equals(0).toArray();
                    const unsyncedIds = new Set(currentUnsynced.map(r => r.id));
                    
                    const localReadyData = cloudData
                        .filter(record => !unsyncedIds.has(record.id))
                        .map(record => {
                            const { updated_at, ...mapped } = record;
                            mapped.synced = 1;

                            // Dynamic Field Mapping (Postgres lowercase -> JS camelCase)
                            if (tableName === 'subjects') {
                                if (record.semester !== undefined) { mapped.semester = record.semester; }
                            } else if (tableName === 'students') {
                                if (record.baptismalname !== undefined) { mapped.baptismalName = record.baptismalname; delete mapped.baptismalname; }
                                if (record.parentcontact !== undefined) { mapped.parentContact = record.parentcontact; delete mapped.parentcontact; }
                                if (record.academicyear !== undefined) { mapped.academicYear = record.academicyear; delete mapped.academicyear; }
                                if (record.dateofentry !== undefined) { mapped.dateOfEntry = record.dateofentry; delete mapped.dateofentry; }
                                if (record.portalcode !== undefined) { mapped.portalCode = record.portalcode; delete mapped.portalcode; }
                            } else if (tableName === 'assessments') {
                                if (record.subjectname !== undefined) { mapped.subjectName = record.subjectname; delete mapped.subjectname; }
                                if (record.maxscore !== undefined) { mapped.maxScore = record.maxscore; delete mapped.maxscore; }
                                // 'date' is already correct
                            } else if (tableName === 'marks') {
                                if (record.studentid !== undefined) { mapped.studentId = record.studentid; delete mapped.studentid; }
                                if (record.assessmentid !== undefined) { mapped.assessmentId = record.assessmentid; delete mapped.assessmentid; }
                                if (record.assessmentdate !== undefined) { mapped.assessmentDate = record.assessmentdate; delete mapped.assessmentdate; }
                            } else if (tableName === 'attendance') {
                                if (record.studentid !== undefined) { mapped.studentId = record.studentid; delete mapped.studentid; }
                                if (record.semester !== undefined) { mapped.semester = record.semester; }
                            } else if (tableName === 'teachers') {
                                if (record.accesscode !== undefined) { mapped.accessCode = record.accesscode; delete mapped.accesscode; }
                                if (record.assignedgrades !== undefined) { mapped.assignedGrades = record.assignedgrades; delete mapped.assignedgrades; }
                                if (record.assignedsubjects !== undefined) { mapped.assignedSubjects = record.assignedsubjects; delete mapped.assignedsubjects; }
                            } else if (tableName === 'templates') {
                                if (record.isdefault !== undefined) { mapped.isDefault = record.isdefault; delete mapped.isdefault; }
                            }
                            return mapped;
                        });

                    if (localReadyData.length > 0) {
                        await tableDb.bulkPut(localReadyData);
                        pulledTotal += localReadyData.length;
                        tableStatus[tableName] = { ...tableStatus[tableName], pull: 'ok', pulled: localReadyData.length };
                        console.log(`Applied ${localReadyData.length} updates to ${tableName}`);
                    } else {
                        tableStatus[tableName] = { ...tableStatus[tableName], pull: 'idle' };
                    }
                } else {
                    tableStatus[tableName] = { ...tableStatus[tableName], pull: 'idle' };
                }

            } catch (err) {
                console.error(`Fatal error syncing table ${tableName}:`, err);
                tableStatus[tableName] = { status: 'fatal', error: err.message };
            }
        }

        // --- 4. POST-SYNC: UPDATE TIMESTAMP ---
        await db.settings.put({ key: 'last_sync_timestamp', value: currentSyncStartedAt });

        console.log(`\n--- Sync Finished ---`);
        console.log(`Pushed: ${pushedTotal}, Pulled: ${pulledTotal}`);
        return { success: true, pushed: pushedTotal, pulled: pulledTotal, tableStatus };

    } catch (error) {
        console.error("Sync process fatal error:", error);
        return { success: false, error: error.message || "Unknown error during sync." };
    }
}
