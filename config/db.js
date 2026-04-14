const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'voting_system',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : null
});

const fs = require('fs');
const path = require('path');

// Immediately test connection robustness on startup and Auto-CREATE DB/Tables
(async () => {
    try {
        const dbName = process.env.DB_NAME || 'voting_system';
        
        // Use the pool to check for tables directly (more compatible with restricted users)
        const [tables] = await pool.query(`SHOW TABLES LIKE 'users'`);
        
        if (tables.length === 0) {
            console.log('\x1b[33mInitialize: Core tables missing, setting up schema...\x1b[0m');
            const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
            const schemaStatements = schema.split(';').filter(stmt => stmt.trim() !== '');
            for (let stmt of schemaStatements) {
                if (stmt.trim()) await pool.query(stmt);
            }

            try {
                const seed = fs.readFileSync(path.join(__dirname, '../seed.sql'), 'utf8');
                const seedStatements = seed.split(';').filter(stmt => stmt.trim() !== '');
                for (let stmt of seedStatements) {
                   if (stmt.trim()) await pool.query(stmt);
                }
                console.log('\x1b[32m✔ Seed data successfully injected!\x1b[0m');
            } catch(e) {
                console.log('[Info] Seed data skipped or already present.');
            }
        } else {
             // Proactive Column Fixes (Repair existing schema)
             console.log('\x1b[36m✔ Verifying database column integrity...\x1b[0m');
             try {
                 const [cols] = await pool.query("SHOW COLUMNS FROM elections LIKE 'results_published'");
                 if (cols.length === 0) {
                     await pool.query("ALTER TABLE elections ADD COLUMN results_published BOOLEAN DEFAULT FALSE");
                     console.log('\x1b[32m✔ Repaired: Added results_published to elections table.\x1b[0m');
                 }
                 
                 const [uCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'device_id'");
                 if (uCols.length === 0) {
                     await pool.query("ALTER TABLE users ADD COLUMN device_id VARCHAR(255)");
                     console.log('\x1b[32m✔ Repaired: Added device_id to users table.\x1b[0m');
                 }
                 
                 const [vCols] = await pool.query("SHOW COLUMNS FROM votes LIKE 'device_id'");
                 if (vCols.length === 0) {
                     await pool.query("ALTER TABLE votes ADD COLUMN device_id VARCHAR(255)");
                     console.log('\x1b[32m✔ Repaired: Added device_id to votes table.\x1b[0m');
                 }

                 // NEW: Candidates table repairs
                 const [pCols] = await pool.query("SHOW COLUMNS FROM candidates LIKE 'party_name'");
                 if (pCols.length === 0) {
                     await pool.query("ALTER TABLE candidates ADD COLUMN party_name VARCHAR(100)");
                     console.log('\x1b[32m✔ Repaired: Added party_name to candidates table.\x1b[0m');
                 }
                 const [plCols] = await pool.query("SHOW COLUMNS FROM candidates LIKE 'party_logo'");
                 if (plCols.length === 0) {
                     await pool.query("ALTER TABLE candidates ADD COLUMN party_logo LONGTEXT");
                     console.log('\x1b[32m✔ Repaired: Added party_logo to candidates table.\x1b[0m');
                 }

                 // Fix Data Too Long issues for candidate photos
                 console.log('\x1b[36m✔ Upgrading photo_url column capacity...\x1b[0m');
                 await pool.query("ALTER TABLE candidates MODIFY COLUMN photo_url LONGTEXT");
             } catch(repairErr) {
                 console.warn('[Warning] Maintenance: Could not auto-repair columns. Permission denied?', repairErr.message);
             }
        }

        console.log('\x1b[32m✔ Internal Service: Database connection established successfully!\x1b[0m');
    } catch (error) {
        console.error('\x1b[31m✖ CRITICAL: Database initialization failed.\x1b[0m');
        console.error('Error Details:', error.message);
    }
})();

module.exports = pool;
