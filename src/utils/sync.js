import { db } from '../db/database';
import { supabase } from './supabaseClient';

const SYNC_LOG_PREFIX = '🔄 [Sync]';

export const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : `http://${window.location.hostname}:5000/api`;

async function processCloudData(tableName, cloudData, tableDb, tableStatus, pulledTotalRef) {
    if (!cloudData || cloudData.length === 0) {
        console.log(`${SYNC_LOG_PREFIX} No new records to pull for ${tableName}`);
        return;
    }
    
    console.log(`${SYNC_LOG_PREFIX} Pulling ${cloudData.length} updates for ${tableName}...`);
    
    // Map all local records to detect existence and state
    const allTableRecords = await tableDb.toArray();
    const localMap = new Map(allTableRecords.map(r => [r.id, r]));
    
    const localReadyData = [];
    
    for (const serverRecord of cloudData) {
        let shouldApply = false;
        const localRecord = localMap.get(serverRecord.id);
        
        if (!localRecord) {
            // New record from cloud, definitely apply
            shouldApply = true;
        } else {
            // Local record already exists
            const serverTime = (serverRecord.updated_at || serverRecord.created_at) 
                ? new Date(serverRecord.updated_at || serverRecord.created_at).getTime() 
                : 1;
            
            const localTime = localRecord.updated_at ? new Date(localRecord.updated_at).getTime() : 0;
            
            if (localRecord.synced === 1) {
                // If it was already synced, only apply if server is strictly newer
                if (serverTime > localTime) {
                    shouldApply = true;
                }
            } else {
                // Conflict! Local has unsynced changes
                const TIME_BUFFER_MS = 2000;
                if (serverTime > (localTime + TIME_BUFFER_MS)) {
                    console.log(`${SYNC_LOG_PREFIX} Conflict resolved: Server is newer for ${tableName}:${serverRecord.id}`);
                    shouldApply = true;
                } else {
                    console.log(`${SYNC_LOG_PREFIX} Conflict resolved: Local is newer or too close for ${tableName}:${serverRecord.id} (Keeping local)`);
                    shouldApply = false;
                }
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
                if (serverRecord.academicyear !== undefined) { mapped.academicYear = serverRecord.academicyear; delete serverRecord.academicyear; }
            } else if (tableName === 'attendance') {
                if (serverRecord.studentid !== undefined) { mapped.studentId = serverRecord.studentid; delete mapped.studentid; }
                if (serverRecord.academicyear !== undefined) { mapped.academicYear = serverRecord.academicyear; delete serverRecord.academicyear; }
                if (serverRecord.last_modified_by !== undefined) { mapped.markedBy = serverRecord.last_modified_by; }
            } else if (tableName === 'marks') {
                if (serverRecord.studentid !== undefined) { mapped.studentId = serverRecord.studentid; delete mapped.studentid; }
                if (serverRecord.studentId !== undefined && mapped.studentId === undefined) { mapped.studentId = serverRecord.studentId; }
                
                if (serverRecord.assessmentid !== undefined) { mapped.assessmentId = serverRecord.assessmentid; delete mapped.assessmentid; }
                if (serverRecord.assessmentId !== undefined && mapped.assessmentId === undefined) { mapped.assessmentId = serverRecord.assessmentId; }
                
                if (serverRecord.academicyear !== undefined) { mapped.academicYear = serverRecord.academicyear; delete serverRecord.academicyear; }

                if (serverRecord.assessmentdate !== undefined) { mapped.assessmentDate = serverRecord.assessmentdate; delete mapped.assessmentdate; }
                if (serverRecord.subject !== undefined) { mapped.subject = serverRecord.subject; }
                if (serverRecord.semester !== undefined) { mapped.semester = serverRecord.semester; }
                if (serverRecord.score !== undefined) { mapped.score = serverRecord.score; }
            } else if (tableName === 'teachers') {
                if (serverRecord.accesscode !== undefined) { mapped.accessCode = serverRecord.accesscode; delete mapped.accesscode; }
                if (serverRecord.assignedgrades !== undefined) { mapped.assignedGrades = serverRecord.assignedgrades; delete mapped.assignedgrades; }
                if (serverRecord.assignedsubjects !== undefined) { mapped.assignedSubjects = serverRecord.assignedsubjects; delete mapped.assignedsubjects; }
                if (serverRecord.cancreateassessments !== undefined) { mapped.canCreateAssessments = serverRecord.cancreateassessments; delete mapped.cancreateassessments; }
                // Support alternate casing (in case the column was created as camelCase in Supabase)
                if (serverRecord.canCreateAssessments !== undefined && mapped.canCreateAssessments === undefined) {
                    mapped.canCreateAssessments = serverRecord.canCreateAssessments;
                }
            } else if (tableName === 'subjects') {
                if (serverRecord.name !== undefined) { mapped.name = serverRecord.name; }
                if (serverRecord.semester !== undefined) { mapped.semester = serverRecord.semester; }
                if (serverRecord.grade !== undefined) { 
                    // Shield: Never overwrite a local grade with a NULL from the server 
                    // unless the server record is significantly newer (already handled by time check above)
                    if (serverRecord.grade === null && localRecord && localRecord.grade) {
                        mapped.grade = localRecord.grade;
                    } else {
                        mapped.grade = serverRecord.grade; 
                    }
                }
            } else if (tableName === 'announcements') {
                if (serverRecord.title_en !== undefined) { mapped.title_en = serverRecord.title_en; }
                if (serverRecord.title_am !== undefined) { mapped.title_am = serverRecord.title_am; }
                if (serverRecord.content_en !== undefined) { mapped.content_en = serverRecord.content_en; }
                if (serverRecord.content_am !== undefined) { mapped.content_am = serverRecord.content_am; }
                if (serverRecord.date !== undefined) { mapped.date = serverRecord.date; }
                if (serverRecord.priority !== undefined) { mapped.priority = serverRecord.priority; }
                if (serverRecord.active !== undefined) { mapped.active = serverRecord.active; }
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

async function syncDeletionsFromCloud(lastSyncTime) {
    console.log("Checking for remote deletions...");
    try {
        const { data: deletions, error } = await supabase
            .from('deleted_records')
            .select('*')
            .gt('deleted_at', lastSyncTime);
            
        if (error) throw error;
        if (!deletions || deletions.length === 0) return;
        
        console.log(`Applying ${deletions.length} remote deletions...`);
        for (const del of deletions) {
            const tableDb = db[del.table_name];
            if (tableDb) {
                // Determine if we should delete locally
                const exists = await tableDb.get(del.record_id);
                if (exists) {
                    // Safety Shield: Do NOT delete if the local record was updated AFTER the deletion was logged on the server.
                    // This prevents "toxic" or accidental deletion histories (e.g. from buggy update triggers) from wiping new data.
                    const localTime = exists.updated_at ? new Date(exists.updated_at).getTime() : 0;
                    const delTime = new Date(del.deleted_at).getTime();
                    
                    if (localTime > delTime) {
                        console.log(`Shield: Skipping deletion for ${del.table_name}:${del.record_id}. Local record is newer.`);
                        continue;
                    }

                    await tableDb.delete(del.record_id);
                    console.log(`Deleted local ${del.table_name} record ${del.record_id} based on cloud.`);
                }
            }
        }
    } catch (e) {
        console.warn("Remote deletion sync failed:", e);
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
            'teachers',
            'announcements'
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
                // Bypass potential IndexedDB index corruption on the 'synced' field by fetching all and filtering in-memory
                const allRecords = await tableDb.toArray();
                const unsyncedRecords = allRecords.filter(r => r.synced === 0);
                
                if (unsyncedRecords.length > 0) {
                    console.log(`Pushing ${unsyncedRecords.length} unsynced records for ${tableName}...`);
                    
                    const cleanRecords = unsyncedRecords.map(record => {
                        let toPush = { id: record.id };

                        // Strict Whitelist Mapping: Dexie -> Supabase Columns
                        if (tableName === 'students') {
                            toPush = {
                                id: record.id,
                                name: record.name,
                                gender: record.gender,
                                grade: record.grade,
                                baptismalname: record.baptismalName || record.baptismalname,
                                parentcontact: record.parentContact || record.parentcontact,
                                academicyear: record.academicYear || record.academicyear,
                                portalcode: record.portalCode || record.portalcode,
                                archived: record.archived || 0,
                                updated_at: record.updated_at
                            };
                        } else if (tableName === 'assessments') {
                            toPush = {
                                id: record.id,
                                name: record.name,
                                grade: record.grade,
                                semester: record.semester,
                                date: record.date,
                                subjectname: record.subjectName || record.subjectname,
                                maxscore: record.maxScore || record.maxscore,
                                academicyear: record.academicYear || record.academicyear,
                                updated_at: record.updated_at
                            };
                        } else if (tableName === 'marks') {
                            toPush = {
                                id: record.id,
                                score: parseFloat(record.score || 0),
                                subject: record.subject,
                                semester: record.semester,
                                studentid: record.studentId || record.studentid,
                                assessmentid: record.assessmentId || record.assessmentid,
                                assessmentdate: record.assessmentDate || record.assessmentdate,
                                academicyear: record.academicYear || record.academicyear,
                                last_modified_by: record.markedBy || record.markedby || record.last_modified_by,
                                updated_at: record.updated_at
                            };
                        } else if (tableName === 'attendance') {
                            toPush = {
                                id: record.id,
                                date: record.date,
                                status: record.status,
                                semester: record.semester,
                                studentid: record.studentId || record.studentid,
                                academicyear: record.academicYear || record.academicyear,
                                last_modified_by: record.markedBy || record.markedby || record.last_modified_by,
                                updated_at: record.updated_at
                            };
                        } else if (tableName === 'teachers') {
                            toPush = {
                                id: record.id,
                                name: record.name,
                                phone: record.phone,
                                accesscode: record.accessCode || record.accesscode,
                                assignedgrades: record.assignedGrades || record.assignedgrades,
                                assignedsubjects: record.assignedSubjects || record.assignedsubjects,
                                cancreateassessments: record.canCreateAssessments !== undefined ? !!record.canCreateAssessments : (record.cancreateassessments !== undefined ? !!record.cancreateassessments : false),
                                updated_at: record.updated_at || new Date().toISOString()
                            };
                        } else if (tableName === 'subjects') {
                            toPush = {
                                id: record.id,
                                name: record.name,
                                semester: record.semester,
                                grade: record.grade,
                                updated_at: record.updated_at
                            };
                        } else if (tableName === 'announcements') {
                            toPush = {
                                id: record.id,
                                title_en: record.title_en,
                                title_am: record.title_am,
                                content_en: record.content_en,
                                content_am: record.content_am,
                                date: record.date,
                                priority: record.priority || 'medium',
                                active: record.active !== undefined ? record.active : 1,
                                updated_at: record.updated_at
                            };
                        } else if (tableName === 'settings') {
                            toPush = {
                                key: record.key,
                                value: record.value
                            };
                        }

                        // Remove undefined values to avoid Supabase errors
                        Object.keys(toPush).forEach(key => toPush[key] === undefined && delete toPush[key]);
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
                console.log(`${SYNC_LOG_PREFIX} Fetching ${tableName} from cloud (since ${lastSyncTime})...`);
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

                // --- 2c. DELETION CLEANUP ---
                // cleanupDeletedRecords was removed here to prevent accidental data loss.
                // Deletions are now handled via syncDeletionsFromCloud (explicit pulling).

            } catch (err) {
                console.error(`Fatal error syncing table ${tableName}:`, err);
                tableStatus[tableName] = { status: 'fatal', error: err.message };
            }
        }

        // --- 3. PULL DELETIONS PHASE ---
        await syncDeletionsFromCloud(lastSyncTime);

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
