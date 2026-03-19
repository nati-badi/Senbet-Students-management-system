import { db } from '../db/database';
import { supabase } from './supabaseClient';

export const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : `http://${window.location.hostname}:5000/api`;

async function processCloudData(tableName, cloudData, tableDb, tableStatus, pulledTotalRef) {
    if (!cloudData || cloudData.length === 0) return;
    
    console.log(`Pulled ${cloudData.length} records from ${tableName}. Filtering local conflicts...`);
    
    // Filter out records that are currently unsynced locally to prevent data loss
    const currentUnsynced = await tableDb.where('synced').equals(0).toArray();
    const unsyncedIds = new Set(currentUnsynced.map(r => r.id));
    
    const localReadyData = cloudData
        .filter(record => !unsyncedIds.has(record.id))
        .map(record => {
            const { updated_at, ...mapped } = record;
            mapped.synced = 1;

            // Dynamic Field Mapping (Postgres lowercase -> JS camelCase)
            if (tableName === 'students') {
                if (record.baptismalname !== undefined) { mapped.baptismalName = record.baptismalname; delete mapped.baptismalname; }
                if (record.parentcontact !== undefined) { mapped.parentContact = record.parentcontact; delete mapped.parentcontact; }
                if (record.academicyear !== undefined) { mapped.academicYear = record.academicyear; delete mapped.academicyear; }
                if (record.dateofentry !== undefined) { mapped.dateOfEntry = record.dateofentry; delete mapped.dateofentry; }
                if (record.portalcode !== undefined) { mapped.portalCode = record.portalcode; delete mapped.portalcode; }
            } else if (tableName === 'assessments') {
                if (record.subjectname !== undefined) { mapped.subjectName = record.subjectname; delete mapped.subjectname; }
                if (record.maxscore !== undefined) { mapped.maxScore = record.maxscore; delete mapped.maxscore; }
            } else if (tableName === 'marks') {
                if (record.studentid !== undefined) { mapped.studentId = record.studentid; delete mapped.studentid; }
                if (record.assessmentid !== undefined) { mapped.assessmentId = record.assessmentid; delete mapped.assessmentid; }
                if (record.assessmentdate !== undefined) { mapped.assessmentDate = record.assessmentdate; delete mapped.assessmentdate; }
            } else if (tableName === 'attendance') {
                if (record.studentid !== undefined) { mapped.studentId = record.studentid; delete mapped.studentid; }
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
        pulledTotalRef.count += localReadyData.length;
        tableStatus[tableName] = { ...tableStatus[tableName], pull: 'ok', pulled: localReadyData.length };
        console.log(`Applied ${localReadyData.length} updates to ${tableName}`);
    } else {
        tableStatus[tableName] = { ...tableStatus[tableName], pull: 'idle' };
    }
}

async function cleanupDeletedRecords(tableName, tableDb) {
    // Only for tables where deletions are common and need propagation
    if (!['marks', 'attendance'].includes(tableName)) return;

    console.log(`Checking for deleted records in ${tableName}...`);
    try {
        // Fetch All current IDs from Supabase for this table
        const { data: remoteIds, error: idError } = await supabase
            .from(tableName)
            .select('id');
        
        if (idError) throw idError;

        const remoteIdSet = new Set(remoteIds.map(r => r.id));
        
        // Find local records that are marked as synced but missing from remote
        const localSyncedRecords = await tableDb.where('synced').equals(1).toArray();
        const idsToRemove = localSyncedRecords
            .filter(r => !remoteIdSet.has(r.id))
            .map(r => r.id);

        if (idsToRemove.length > 0) {
            console.log(`Sync: removing ${idsToRemove.length} deleted records from local ${tableName}`);
            await tableDb.bulkDelete(idsToRemove);
        }
    } catch (e) {
        console.warn(`Deletion cleanup failed for ${tableName}:`, e);
    }
}

export async function syncData() {
    console.log("--- Starting synchronization session ---");

    if (!supabase) {
        const msg = "Cloud Sync is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.";
        console.warn(msg);
        return { success: false, error: msg };
    }

    try {
        const TABLES = [
            'subjects',
            'students',
            'assessments',
            'attendance',
            'marks',
            'teachers',
            'templates'
        ];

        let pushedTotal = 0;
        let pulledTotalRef = { count: 0 };
        let tableStatus = {}; 

        const lastSyncRes = await db.settings.get('last_sync_timestamp');
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
                    let tablePushed = 0;
                    const unsyncedRecords = await db.table(tableName).where('synced').equals(0).toArray();
                    
                    if (unsyncedRecords.length > 0) {
                    console.log(`Pushing ${unsyncedRecords.length} unsynced records for ${tableName}...`);
                    
                    // Normalize for Postgres (lowercase keys) and exclude problematic columns
                    const cleanRecords = unsyncedRecords.map(record => {
                        // 1. First, create a lowercased version of the record
                        const lowercased = {};
                        Object.keys(record).forEach(k => {
                            lowercased[k.toLowerCase()] = record[k];
                        });

                        // 2. Exclude non-Supabase columns
                        const { 
                            synced, 
                            updated_at,
                            semester, // Local-only for some tables
                            ...rest 
                        } = lowercased;

                        // 3. Ensure ID exists
                        if (!rest.id) rest.id = crypto.randomUUID();
                        
                        // 4. Special handling for types (like rounding score)
                        if (tableName === 'marks' && rest.score !== undefined && rest.score !== null) {
                            rest.score = Math.round(parseFloat(rest.score));
                        }
                        
                        return rest;
                    });

                    let conflictKeys = 'id';
                    const { error: pushError } = await supabase
                        .from(tableName)
                        .upsert(cleanRecords, { onConflict: conflictKeys });

                    if (pushError) {
                        console.error(`Push failed for ${tableName}:`, pushError);
                        tableStatus[tableName] = { ...tableStatus[tableName], push: 'error', error: pushError.message };
                    } else {
                        const ids = unsyncedRecords.map(r => r.id);
                        await tableDb.where('id').anyOf(ids).modify({ synced: 1 });
                        tablePushed = cleanRecords.length;
                        pushedTotal += tablePushed;
                        tableStatus[tableName] = { ...tableStatus[tableName], push: 'ok', pushed: tablePushed };
                        console.log(`Successfully pushed ${tablePushed} records to ${tableName}`);
                    }
                } else {
                    tableStatus[tableName] = { ...tableStatus[tableName], push: 'idle' };
                }

                // --- 2b. PULL PHASE ---
                console.log(`Pulling updates for ${tableName}...`);
                const { data: cloudData, error: pullError } = await supabase
                    .from(tableName)
                    .select('*')
                    .gt('updated_at', lastSyncTime);

                if (pullError) {
                    if (pullError.code === '42703' || pullError.message?.includes('updated_at')) {
                        console.warn(`Table ${tableName} missing updated_at. Pulling all...`);
                        const { data: allData, error: allErr } = await supabase.from(tableName).select('*');
                        if (!allErr) await processCloudData(tableName, allData, tableDb, tableStatus, pulledTotalRef);
                    } else {
                        console.error(`Pull failed for ${tableName}:`, pullError);
                        tableStatus[tableName] = { ...tableStatus[tableName], pull: 'error', error: pullError.message };
                    }
                } else {
                    await processCloudData(tableName, cloudData, tableDb, tableStatus, pulledTotalRef);
                }

                // --- 2c. DELETION CLEANUP (Plan B) ---
                await cleanupDeletedRecords(tableName, tableDb);

            } catch (err) {
                console.error(`Fatal error syncing table ${tableName}:`, err);
                tableStatus[tableName] = { status: 'fatal', error: err.message };
            }
        }

        await db.settings.put({ key: 'last_sync_timestamp', value: currentSyncStartedAt });
        
        const errors = Object.values(tableStatus).filter(s => s.push === 'error' || s.pull === 'error');
        const hasErrors = errors.length > 0;

        console.log(`\n--- Sync Finished ---`);
        console.log(`Pushed: ${pushedTotal}, Pulled: ${pulledTotalRef.count}`);
        
        return { 
            success: !hasErrors, 
            pushed: pushedTotal, 
            pulled: pulledTotalRef.count, 
            tableStatus,
            error: hasErrors ? `Sync failed for ${errors.length} tables.` : null
        };

    } catch (error) {
        console.error("Sync process fatal error:", error);
        return { success: false, error: error.message || "Unknown error during sync." };
    }
}
