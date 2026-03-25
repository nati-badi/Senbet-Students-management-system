import { db } from '../src/db/database.js';

async function checkIds() {
    console.log("Checking Dexie IDs for consistency...");
    const tables = ['students', 'marks', 'attendance', 'assessments', 'subjects', 'teachers'];
    
    for (const table of tables) {
        const records = await db[table].toArray();
        const integerIds = records.filter(r => typeof r.id === 'number');
        const stringIds = records.filter(r => typeof r.id === 'string');
        const uuidIds = stringIds.filter(r => r.id.includes('-'));
        
        console.log(`Table: ${table}`);
        console.log(`  Total: ${records.length}`);
        console.log(`  Integer IDs: ${integerIds.length}`);
        console.log(`  String IDs: ${stringIds.length} (UUID-like: ${uuidIds.length})`);
        
        if (integerIds.length > 0) {
            console.log(`  Example Integer ID: ${integerIds[0].id}`);
        }
    }
}

checkIds();
