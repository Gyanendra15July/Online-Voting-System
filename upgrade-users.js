const pool = require('./config/db');

async function upgradeUsersDB() {
    try {
        console.log('Upgrading Users Table...');
        await pool.query('ALTER TABLE users ADD COLUMN photo_url VARCHAR(255)');
        console.log('Successfully upgraded users table with photo_url.');
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
upgradeUsersDB();
