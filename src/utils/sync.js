import { db } from '../db/database';
import { supabase } from './supabaseClient';

export async function syncData() {
    console.log("Starting synchronization...");

    if (!supabase) {
        const msg = "Cloud Sync is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.";
        console.warn(msg);
        return { success: false, error: msg };
    }

    try {
        const TABLES = ['students', 'attendance', 'marks', 'subjects', 'assessments'];
        let pushedCount = 0;
        let pulledCount = 0;

        // --- 1. PUSH LOCAL CHANGES TO SUPABASE ---
        console.log("Pushing data to Supabase...");
        for (const tableName of TABLES) {
            const tableDb = db[tableName];

            // Get records where synced === 0
            let unsyncedRecords = await tableDb.where('synced').equals(0).toArray();

            if (unsyncedRecords.length > 0) {
                // 1a. Ensure all records have IDs (legacy data support) before pushing
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

                // 1b. Clean and Normalize records for Supabase (lowercase keys for Postgres)
                const cleanRecords = unsyncedRecords.map(record => {
                    const { synced, ...rest } = record;
                    // Convert keys to lowercase to match Supabase Postgres defaults
                    const normalized = {};
                    Object.keys(rest).forEach(key => {
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

                // 1d. Mark local records as synced (synced === 1)
                const localUpdates = unsyncedRecords.map(r => ({ ...r, synced: 1 }));
                await tableDb.bulkPut(localUpdates);

                pushedCount += cleanRecords.length;
                console.log(`Pushed ${cleanRecords.length} records to ${tableName}`);
            }
        }

        // --- 2. PULL CLOUD CHANGES TO LOCAL DB ---
        console.log("Pulling data from Supabase...");
        for (const tableName of TABLES) {
            const tableDb = db[tableName];

            // In a production app, you would use a "last_sync_timestamp" to only pull new records.
            // For simplicity and guaranteed consistency here, we will pull all cloud records 
            // and upsert them locally. Since Dexie offline apps are generally light, this is fine.
            const { data, error } = await supabase
                .from(tableName)
                .select('*');

            if (error) {
                console.error(`Error pulling from ${tableName}:`, error);
                throw error;
            }

            if (data && data.length > 0) {
                // Map lowercase Postgres keys back to our local camelCase schema if necessary
                // Tables where we know we use camelCase: students, assessments, marks, attendance
                const localReadyData = data.map(record => {
                    const mapped = { ...record, synced: 1 };

                    // Specific mapping for known camelCase fields
                    if (tableName === 'students') {
                        if (record.baptismalname) mapped.baptismalName = record.baptismalname;
                        if (record.parentcontact) mapped.parentContact = record.parentcontact;
                        if (record.academicyear) mapped.academicYear = record.academicyear;
                        if (record.dateofentry) mapped.dateOfEntry = record.dateofentry;
                    } else if (tableName === 'assessments') {
                        if (record.subjectname) mapped.subjectName = record.subjectname;
                        if (record.maxscore) mapped.maxScore = record.maxscore;
                    } else if (tableName === 'marks') {
                        if (record.studentid) mapped.studentId = record.studentid;
                        if (record.assessmentid) mapped.assessmentId = record.assessmentid;
                        if (record.assessmentdate) mapped.assessmentDate = record.assessmentdate;
                    } else if (tableName === 'attendance') {
                        if (record.studentid) mapped.studentId = record.studentid;
                    }

                    return mapped;
                });

                // bulkPut will upsert (replace if ID exists, insert if new)
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
