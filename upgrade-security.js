const pool = require('./config/db');

async function upgradeSecurity() {
    try {
        console.log('Upgrading database for Advanced Security...');
        
        // Add device_id to users
        await pool.query("ALTER TABLE users ADD COLUMN device_id VARCHAR(255)");
        console.log('✔ Added device_id to users table');
        
        // Add device_id to votes
        await pool.query("ALTER TABLE votes ADD COLUMN device_id VARCHAR(255)");
        console.log('✔ Added device_id to votes table');
        
        console.log('Security database upgrade complete.');
        process.exit(0);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Columns already exist, skipping.');
            process.exit(0);
        }
        console.error('Security upgrade failed:', e);
        process.exit(1);
    }
}
upgradeSecurity();
