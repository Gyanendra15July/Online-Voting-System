const pool = require('./config/db');

async function upgradeDB() {
    try {
        console.log('Upgrading Candidates Table...');
        await pool.query('ALTER TABLE candidates ADD COLUMN party_name VARCHAR(100)');
        await pool.query('ALTER TABLE candidates ADD COLUMN party_logo VARCHAR(255)');
        console.log('Successfully upgraded database schema with party details.');
        process.exit(0);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
             console.log('Fields already exist, skipping.');
             process.exit(0);
        } else {
             console.error('Failed to upgrade DB', e);
             process.exit(1);
        }
    }
}
upgradeDB();
