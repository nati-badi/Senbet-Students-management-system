import { db } from '../db/database';
import { supabase } from './supabaseClient';

export const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : `http://${window.location.hostname}:5000/api`;

export async function syncData() {
    console.log("Starting synchronization...");

    if (!supabase) {
        const msg = "Cloud Sync is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.";
        console.warn(msg);
        return { success: false, error: msg };
    }

    try {
        const TABLES = ['students', 'attendance', 'marks', 'subjects', 'assessments', 'teachers'];
        let pushedCount = 0;
        let pulledCount = 0;

        // --- 1. SETTINGS SYNC (Special Case) ---
        console.log("Syncing settings...");
        const localSettings = await db.settings.toArray();
        if (localSettings.length > 0) {
            const normalizedSettings = localSettings.map(s => ({
                key: s.key,
                value: typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)
            }));
            const { error: settingsPushError } = await supabase
                .from('settings')
                .upsert(normalizedSettings, { onConflict: 'key' });
            
            if (settingsPushError) {
                console.warn("Settings push warning (continuing):", settingsPushError);
            }
        }

        const { data: cloudSettings, error: settingsPullError } = await supabase
            .from('settings')
            .select('*');
        
        if (!settingsPullError && cloudSettings) {
            for (const s of cloudSettings) {
                let val = s.value;
                try { 
                    if (val.startsWith('{') || val.startsWith('[')) val = JSON.parse(val); 
                } catch (e) {}
                await db.settings.put({ key: s.key, value: val });
            }
        }

        // --- 2. PUSH LOCAL CHANGES TO SUPABASE ---
        console.log("Pushing data to Supabase...");
        for (const tableName of TABLES) {
            const tableDb = db[tableName];
            if (!tableDb) continue;

            // Get records where synced === 0
            let unsyncedRecords = await tableDb.where('synced').equals(0).toArray();

            if (unsyncedRecords.length > 0) {
                // 1a. Ensure all records have IDs
                let needsLocalUpdate = false;
                for (const record of unsyncedRecords) {
                    if (!record.id) {
                        record.id = crypto.randomUUID();
                        needsLocalUpdate = true;
                    }
                }

                if (needsLocalUpdate) {
                    await tableDb.bulkPut(unsyncedRecords);
                }

                // 1b. Clean and Normalize records for Supabase
                const cleanRecords = unsyncedRecords.map(record => {
                    const { synced, ...rest } = record;
                    const normalized = {};
                    Object.keys(rest).forEach(key => {
                        // Special handling for camelCase keys to lowercase
                        normalized[key.toLowerCase()] = rest[key];
                    });
                    return normalized;
                });

                // 1c. Upsert to Supabase
                const { error } = await supabase
                    .from(tableName)
                    .upsert(cleanRecords, { onConflict: 'id' });

                if (error) {
                    console.error(`Error pushing to ${tableName}:`, error);
                    throw error;
                }

                // 1d. Mark local records as synced
                const localUpdates = unsyncedRecords.map(r => ({ ...r, synced: 1 }));
                await tableDb.bulkPut(localUpdates);

                pushedCount += cleanRecords.length;
                console.log(`Pushed ${cleanRecords.length} records to ${tableName}`);
            }
        }

        // --- 3. PULL CLOUD CHANGES TO LOCAL DB ---
        console.log("Pulling data from Supabase...");
        for (const tableName of TABLES) {
            const tableDb = db[tableName];
            if (!tableDb) continue;

            const { data, error } = await supabase
                .from(tableName)
                .select('*');

            if (error) {
                console.error(`Error pulling from ${tableName}:`, error);
                throw error;
            }

            if (data && data.length > 0) {
                const localReadyData = data.map(record => {
                    const mapped = { ...record, synced: 1 };

                    // Map lowercase Postgres keys back to camelCase
                    if (tableName === 'students') {
                        if (record.baptismalname !== undefined) mapped.baptismalName = record.baptismalname;
                        if (record.parentcontact !== undefined) mapped.parentContact = record.parentcontact;
                        if (record.academicyear !== undefined) mapped.academicYear = record.academicyear;
                        if (record.dateofentry !== undefined) mapped.dateOfEntry = record.dateofentry;
                        if (record.portalcode !== undefined) mapped.portalCode = record.portalcode;
                    } else if (tableName === 'assessments') {
                        if (record.subjectname !== undefined) mapped.subjectName = record.subjectname;
                        if (record.maxscore !== undefined) mapped.maxScore = record.maxscore;
                    } else if (tableName === 'marks') {
                        if (record.studentid !== undefined) mapped.studentId = record.studentid;
                        if (record.assessmentid !== undefined) mapped.assessmentId = record.assessmentid;
                        if (record.assessmentdate !== undefined) mapped.assessmentDate = record.assessmentdate;
                    } else if (tableName === 'attendance') {
                        if (record.studentid !== undefined) mapped.studentId = record.studentid;
                    } else if (tableName === 'teachers') {
                        if (record.accesscode !== undefined) mapped.accessCode = record.accesscode;
                        if (record.assignedgrades !== undefined) mapped.assignedGrades = record.assignedgrades;
                        if (record.assignedsubjects !== undefined) mapped.assignedSubjects = record.assignedsubjects;
                    }

                    return mapped;
                });

                await tableDb.bulkPut(localReadyData);
                pulledCount += data.length;
                console.log(`Pulled ${data.length} records into ${tableName}`);
            }
        }

        console.log(`Synchronization finished successfully. Pushed: ${pushedCount}, Pulled: ${pulledCount}`);
        return { success: true, pushed: pushedCount, pulled: pulledCount };

    } catch (error) {
        console.error("Sync process error:", error);
        return { success: false, error: error.message || "An unknown error occurred during sync." };
    }
}
