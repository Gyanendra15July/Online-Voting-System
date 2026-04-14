const pool = require('../config/db');

const logAudit = async (userId, action, details, ip) => {
    try {
        await pool.query(
            'INSERT INTO audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [userId || null, action, details, ip || 'UNKNOWN']
        );
    } catch (e) {
        console.error("Audit log error:", e);
    }
};

module.exports = { logAudit };
