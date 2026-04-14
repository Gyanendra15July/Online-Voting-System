const pool = require('./config/db');

async function upgradeDB() {
    try {
        console.log('Upgrading User Table...');
        await pool.query('ALTER TABLE users ADD COLUMN voter_id VARCHAR(50) UNIQUE');
        await pool.query('ALTER TABLE users ADD COLUMN face_data MEDIUMTEXT');
        console.log('Successfully upgraded database schema with biometric fields.');
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
