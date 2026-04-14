const pool = require('./config/db');

async function migrateResultsPublished() {
    try {
        console.log('Migrating Render Database: Adding results_published column...');
        
        // Check if column exists
        const [columns] = await pool.query("SHOW COLUMNS FROM elections LIKE 'results_published'");
        
        if (columns.length === 0) {
            await pool.query("ALTER TABLE elections ADD COLUMN results_published BOOLEAN DEFAULT FALSE");
            console.log('✔ Column results_published added successfully.');
        } else {
            console.log('ℹ Column results_published already exists.');
        }

        console.log('Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateResultsPublished();
