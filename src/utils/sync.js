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

                // 1b. Clean records for Supabase (remove local 'synced' flag)
                const cleanRecords = unsyncedRecords.map(record => {
                    const { synced, ...rest } = record;
                    return rest;
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
                // Add synced: 1 back to cloud data before putting into Dexie
                const localReadyData = data.map(record => ({ ...record, synced: 1 }));

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
