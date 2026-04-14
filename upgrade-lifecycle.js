const pool = require('./config/db');

async function upgradeLifecycle() {
    try {
        console.log('Adding results_published column to elections table...');
        await pool.query("ALTER TABLE elections ADD COLUMN results_published BOOLEAN DEFAULT FALSE");
        console.log('✔ results_published column added successfully.');
        process.exit(0);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists, skipping.');
            process.exit(0);
        }
        console.error('Failed:', e);
        process.exit(1);
    }
}
upgradeLifecycle();
