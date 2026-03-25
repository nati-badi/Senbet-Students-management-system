import { db } from '../db/database';
import { supabase } from './supabaseClient';

export const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : `http://${window.location.hostname}:5000/api`;

async function processCloudData(tableName, cloudData, tableDb, tableStatus, pulledTotalRef) {
    if (!cloudData || cloudData.length === 0) return;
    
    console.log(`Pulled ${cloudData.length} records from ${tableName}. Filtering local conflicts...`);
    
    // Fetch local unsynced records to detect conflicts
    const currentUnsynced = await tableDb.where('synced').equals(0).toArray();
    const unsyncedMap = new Map(currentUnsynced.map(r => [r.id, r]));
    
    const localReadyData = [];
    
    for (const serverRecord of cloudData) {
        let shouldApply = false;
        const localRecord = unsyncedMap.get(serverRecord.id);
        
        if (!localRecord) {
            // No local record exists, definitely apply it
            shouldApply = true;
        } else {
            // Conflict! Check which one is newer. 
            // Fallback to created_at if updated_at is missing (e.g. if SQL migration not yet run)
            const serverTime = (serverRecord.updated_at || serverRecord.created_at) 
                ? new Date(serverRecord.updated_at || serverRecord.created_at).getTime() 
                : 1; // Default to old but non-zero to distinguish from "nothing"
            
            const localTime = localRecord.updated_at ? new Date(localRecord.updated_at).getTime() : 0;
            
            if (serverTime > localTime) {
                console.log(`Conflict resolved: Server is newer for ${tableName}:${serverRecord.id}`);
                shouldApply = true;
            } else {
                console.log(`Conflict resolved: Local is newer for ${tableName}:${serverRecord.id} (Keeping local)`);
                shouldApply = false;
            }
        }
        
        if (shouldApply) {
            const mapped = { ...serverRecord };
            mapped.synced = 1;

            // Explicit Mapping (Supabase lowercase -> Dexie camelCase)
            if (tableName === 'students') {
                if (serverRecord.baptismalname !== undefined) { mapped.baptismalName = serverRecord.baptismalname; delete mapped.baptismalname; }
                if (serverRecord.parentcontact !== undefined) { mapped.parentContact = serverRecord.parentcontact; delete mapped.parentcontact; }
                if (serverRecord.academicyear !== undefined) { mapped.academicYear = serverRecord.academicyear; delete mapped.academicyear; }
                if (serverRecord.dateofentry !== undefined) { mapped.dateOfEntry = serverRecord.dateofentry; delete mapped.dateofentry; }
                if (serverRecord.portalcode !== undefined) { mapped.portalCode = serverRecord.portalcode; delete mapped.portalcode; }
            } else if (tableName === 'assessments') {
                if (serverRecord.subjectname !== undefined) { mapped.subjectName = serverRecord.subjectname; delete mapped.subjectname; }
                if (serverRecord.maxscore !== undefined) { mapped.maxScore = serverRecord.maxscore; delete mapped.maxscore; }
            } else if (tableName === 'marks') {
                if (serverRecord.studentid !== undefined) { mapped.studentId = serverRecord.studentid; delete mapped.studentid; }
                if (serverRecord.assessmentid !== undefined) { mapped.assessmentId = serverRecord.assessmentid; delete mapped.assessmentid; }
                if (serverRecord.assessmentdate !== undefined) { mapped.assessmentDate = serverRecord.assessmentdate; delete mapped.assessmentdate; }
            } else if (tableName === 'attendance') {
                if (serverRecord.studentid !== undefined) { mapped.studentId = serverRecord.studentid; delete mapped.studentid; }
            } else if (tableName === 'teachers') {
                if (serverRecord.accesscode !== undefined) { mapped.accessCode = serverRecord.accesscode; delete mapped.accesscode; }
                if (serverRecord.assignedgrades !== undefined) { mapped.assignedGrades = serverRecord.assignedgrades; delete mapped.assignedgrades; }
                if (serverRecord.assignedsubjects !== undefined) { mapped.assignedSubjects = serverRecord.assignedsubjects; delete mapped.assignedsubjects; }
            }

            localReadyData.push(mapped);
        }
    }

    if (localReadyData.length > 0) {
        await tableDb.bulkPut(localReadyData);
        pulledTotalRef.count += localReadyData.length;
        tableStatus[tableName] = { ...tableStatus[tableName], pull: 'ok', pulled: localReadyData.length };
        console.log(`Applied ${localReadyData.length} records to local ${tableName}`);
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

export async function syncData({ force = false } = {}) {
    console.log(`--- Starting synchronization session ${force ? '(FORCED)' : ''} ---`);

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
            'teachers'
        ];

        let pushedTotal = 0;
        let pulledTotalRef = { count: 0 };
        let tableStatus = {}; 

        const lastSyncRes = await db.settings.get('last_sync_timestamp');
        let lastSyncTime = '1970-01-01T00:00:00Z';
        
        if (!force && lastSyncRes) {
            // Buffer of 2 minutes to prevent edge-case race conditions
            lastSyncTime = new Date(new Date(lastSyncRes.value).getTime() - 120000).toISOString();
        }
        
        console.log(`Syncing changes since: ${lastSyncTime}`);
        
        // --- 0. OBTAIN SERVER TIME FOR CURSOR ---
        // To prevent client/server clock-skew bugs, we ping the server to get ITS current time via trigger.
        let serverSyncStart = new Date().toISOString(); 
        try {
            const { data: pingData } = await supabase
                .from('settings')
                .upsert({ key: 'sys_sync_ping', value: serverSyncStart })
                .select('updated_at')
                .single();
            if (pingData?.updated_at) {
                serverSyncStart = pingData.updated_at;
            }
        } catch(e) { console.warn("Could not get strict server time, falling back to local."); }
        
        const currentSyncStartedAt = serverSyncStart;

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

        // --- 1.5 DELETED RECORDS SYNC ---
        try {
            if (db.deleted_records) {
                const deletedRecords = await db.deleted_records.toArray();
                if (deletedRecords.length > 0) {
                    console.log(`Pushing ${deletedRecords.length} offline deletions...`);
                    const deletionsByTable = {};
                    for (const d of deletedRecords) {
                        if (!deletionsByTable[d.tableName]) deletionsByTable[d.tableName] = [];
                        deletionsByTable[d.tableName].push(d);
                    }

                    for (const [tName, dRecords] of Object.entries(deletionsByTable)) {
                        const idsToDelete = dRecords.map(d => d.recordId);
                        const { error } = await supabase.from(tName).delete().in('id', idsToDelete);
                        if (error) {
                            console.error(`Failed to push deletions for ${tName}:`, error);
                        } else {
                            const dIds = dRecords.map(d => d.id);
                            await db.deleted_records.bulkDelete(dIds);
                            console.log(`Successfully pushed ${idsToDelete.length} deletions to ${tName}`);
                        }
                    }
                }
            }
        } catch (e) { console.warn("Deleted records sync warning:", e); }

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
                    
                    const cleanRecords = unsyncedRecords.map(record => {
                        const toPush = { ...record };
                        delete toPush.synced;

                        // Explicit Mapping: CamelCase -> Supabase Columns
                        if (tableName === 'students') {
                            if (record.baptismalName !== undefined) { toPush.baptismalname = record.baptismalName; delete toPush.baptismalName; }
                            if (record.parentContact !== undefined) { toPush.parentcontact = record.parentContact; delete toPush.parentContact; }
                            if (record.academicYear !== undefined) { toPush.academicyear = record.academicYear; delete toPush.academicYear; }
                            if (record.dateOfEntry !== undefined) { toPush.dateofentry = record.dateOfEntry; delete toPush.dateofentry; }
                            if (record.portalCode !== undefined) { toPush.portalcode = record.portalCode; delete toPush.portalCode; }
                        } else if (tableName === 'assessments') {
                            if (record.subjectName !== undefined) { toPush.subjectname = record.subjectName; delete toPush.subjectName; }
                            if (record.maxScore !== undefined) { toPush.maxscore = record.maxScore; delete toPush.maxScore; }
                        } else if (tableName === 'marks') {
                            if (record.studentId !== undefined) { toPush.studentid = record.studentId; delete toPush.studentId; }
                            if (record.assessmentId !== undefined) { toPush.assessmentid = record.assessmentId; delete toPush.assessmentId; }
                            if (record.assessmentDate !== undefined) { toPush.assessmentdate = record.assessmentDate; delete toPush.assessmentDate; }
                            if (toPush.score !== undefined && toPush.score !== null) toPush.score = Math.round(parseFloat(toPush.score));
                        } else if (tableName === 'attendance') {
                            if (record.studentId !== undefined) { toPush.studentid = record.studentId; delete toPush.studentId; }
                        } else if (tableName === 'teachers') {
                            if (record.accessCode !== undefined) { toPush.accesscode = record.accessCode; delete toPush.accessCode; }
                            if (record.assignedGrades !== undefined) { toPush.assignedgrades = record.assignedGrades; delete toPush.assignedGrades; }
                            if (record.assignedSubjects !== undefined) { toPush.assignedsubjects = record.assignedSubjects; delete toPush.assignedSubjects; }
                        }

                        return toPush;
                    });

                    const { error: pushError } = await supabase
                        .from(tableName)
                        .upsert(cleanRecords, { onConflict: 'id' });

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
