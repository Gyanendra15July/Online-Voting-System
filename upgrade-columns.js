const pool = require('./config/db');

async function upgradeDB() {
    try {
        console.log('Upgrading Candidates Table Columns...');
        await pool.query('ALTER TABLE candidates MODIFY party_logo LONGTEXT');
        await pool.query('ALTER TABLE candidates MODIFY photo_url LONGTEXT');
        console.log('Successfully upgraded columns to LONGTEXT.');
        process.exit(0);
    } catch (e) {
        console.error('Failed to upgrade DB', e);
        process.exit(1);
    }
}
upgradeDB();
