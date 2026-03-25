import { db } from '../src/db/database.js';

async function checkmarks() {
    console.log("Checking Dexie 'marks' table...");
    try {
        const marks = await db.marks.toArray();
        console.log(`Total local marks: ${marks.length}`);
        if(marks.length > 0) {
            console.log("Last 5 local marks:");
            for(let i=Math.max(0, marks.length-5); i<marks.length; i++) {
                console.log(JSON.stringify(marks[i]));
            }
        }
    } catch (e) {
        console.error(e);
    }
}

checkmarks();
