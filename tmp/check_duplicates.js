import { supabase } from '../src/utils/supabaseClient.js';

async function checkDuplicates() {
    console.log("Checking for duplicate marks in Supabase...");
    try {
        const { data, error } = await supabase.from('marks').select('*');
        if (error) throw error;
        
        const map = {};
        const duplicates = [];
        data.forEach(m => {
            const key = `${m.studentid}_${m.assessmentid}`;
            if (map[key]) {
                duplicates.push({ existing: map[key], duplicate: m });
            } else {
                map[key] = m;
            }
        });

        console.log(`Found ${duplicates.length} duplicate pairs out of ${data.length} total marks.`);
        if (duplicates.length > 0) {
            console.log("Example Duplicate:");
            console.log("A:", duplicates[0].existing.id, "Score:", duplicates[0].existing.score);
            console.log("B:", duplicates[0].duplicate.id, "Score:", duplicates[0].duplicate.score);
        }
    } catch (e) {
        console.error(e);
    }
}

checkDuplicates();
