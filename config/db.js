const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'voting_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const fs = require('fs');
const path = require('path');

// Immediately test connection robustness on startup and Auto-CREATE DB
(async () => {
    try {
        // Pre-flight check: Auto-create database if not exists
        const tempConn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });
        const dbName = process.env.DB_NAME || 'voting_system';
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await tempConn.query(`USE \`${dbName}\``);
        
        // Auto-create tables if missing
        const [tables] = await tempConn.query("SHOW TABLES LIKE 'users'");
        if (tables.length === 0) {
            console.log('\x1b[33mInitialize: Missing tables detected, executing schema.sql...\x1b[0m');
            const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
            const schemaStatements = schema.split(';').filter(stmt => stmt.trim() !== '');
            for (let stmt of schemaStatements) {
                await tempConn.query(stmt);
            }

            try {
                const seed = fs.readFileSync(path.join(__dirname, '../seed.sql'), 'utf8');
                const seedStatements = seed.split(';').filter(stmt => stmt.trim() !== '');
                for (let stmt of seedStatements) {
                    await tempConn.query(stmt);
                }
                console.log('\x1b[32m✔ Seed data successfully injected!\x1b[0m');
            } catch(e) {}
        }
        await tempConn.end();

        // Main Pool Check
        const connection = await pool.getConnection();
        console.log('\x1b[32m✔ Internal Service: Database connection established successfully!\x1b[0m');
        connection.release();
    } catch (error) {
        console.error('\x1b[31m✖ CRITICAL: Database connection failed. Verify MySQL is running.\x1b[0m');
        console.error('Error Details:', error.message);
    }
})();

module.exports = pool;
