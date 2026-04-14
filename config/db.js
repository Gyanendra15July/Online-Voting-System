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
        }

        console.log('\x1b[32m✔ Internal Service: Database connection established successfully!\x1b[0m');
    } catch (error) {
        console.error('\x1b[31m✖ CRITICAL: Database initialization failed.\x1b[0m');
        console.error('Error Details:', error.message);
    }
})();

module.exports = pool;
