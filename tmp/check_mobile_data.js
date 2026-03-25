import { supabase } from '../src/utils/supabaseClient.js';

async function checkMobileData() {
    console.log("Checking Supabase 'marks' table...");
    try {
        const { data, error } = await supabase
            .from('marks')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error(error);
            return;
        }

        console.log("Latest 5 Marks in Supabase:");
        data.forEach(m => {
            console.log(JSON.stringify(m, null, 2));
        });
        
    } catch (e) {
        console.error(e);
    }
}

checkMobileData();
