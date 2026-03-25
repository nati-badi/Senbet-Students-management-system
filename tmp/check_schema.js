import { supabase } from '../src/utils/supabaseClient.js';

async function checkSchema() {
    console.log("Checking Supabase Schema...");
    const tables = ['students', 'marks', 'attendance', 'assessments', 'subjects', 'teachers'];
    
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error fetching from ${table}:`, error);
        } else if (data && data.length > 0) {
            console.log(`Table: ${table}`);
            console.log(`Keys: ${Object.keys(data[0]).join(', ')}`);
        } else {
            console.log(`Table: ${table} (empty)`);
        }
    }
}

checkSchema();
