const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function initDB() {
    try {
        console.log('Connecting to MySQL Server...');
        // Connect without database selected
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        const dbName = process.env.DB_NAME || 'voting_system';
        console.log(`Creating database '${dbName}' if not exists...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await connection.query(`USE \`${dbName}\``);

        console.log('Executing schema.sql...');
        const schema = fs.readFileSync('./schema.sql', 'utf8');
        const schemaStatements = schema.split(';').filter(stmt => stmt.trim() !== '');
        for (let stmt of schemaStatements) {
            await connection.query(stmt);
        }
        
        // Add is_blocked if not exists
        try {
            await connection.query('ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE');
            console.log('Added is_blocked column to users table');
        } catch(e) {
            // Probably already exists
        }

        console.log('Executing seed.sql...');
        try {
            const seed = fs.readFileSync('./seed.sql', 'utf8');
            const seedStatements = seed.split(';').filter(stmt => stmt.trim() !== '');
            for (let stmt of seedStatements) {
                await connection.query(stmt);
            }
        } catch(e) {
             console.log('Seed execution failed/ignored (maybe duplicate entry).');
        }

        console.log('Database Initialization Complete!');
        process.exit(0);
    } catch (err) {
        console.error('Failed to initialize database:', err.message);
        process.exit(1);
    }
}

initDB();
