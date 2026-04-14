const pool = require('./config/db');

async function fixCascades() {
    try {
        console.log('Fixing Database Cascades for Safe Deletion...');
        
        // Fix votes -> elections cascade
        try {
            await pool.query("ALTER TABLE votes DROP FOREIGN KEY votes_ibfk_2");
        } catch (e) {} 
        await pool.query("ALTER TABLE votes ADD CONSTRAINT votes_ibfk_2 FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE");
        console.log('✔ Added CASCADE to votes -> elections');

        // Fix votes -> candidates cascade
        try {
            await pool.query("ALTER TABLE votes DROP FOREIGN KEY votes_ibfk_3");
        } catch (e) {}
        await pool.query("ALTER TABLE votes ADD CONSTRAINT votes_ibfk_3 FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE");
        console.log('✔ Added CASCADE to votes -> candidates');
        
        console.log('Cascade fix complete.');
        process.exit(0);
    } catch (e) {
        console.error('Cascade fix failed:', e);
        process.exit(1);
    }
}
fixCascades();
