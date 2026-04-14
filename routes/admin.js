const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { logAudit } = require('../utils/logger');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(['admin']));



// GET /elections
router.get('/elections', async (req, res) => {
    console.log(`[Admin API] GET /elections requested by admin_id: ${req.user.id}`);
    try {
        const [elections] = await pool.query('SELECT * FROM elections ORDER BY start_time DESC');
        res.json({ success: true, data: elections });
    } catch (error) {
        console.error("Error fetching all elections:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /elections
router.post('/elections', async (req, res) => {
    const { title, description, start_time, end_time } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO elections (title, description, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?)',
            [title, description, start_time, end_time, req.user.id]
        );
        await logAudit(req.user.id, 'CREATE_ELECTION', `Created election ID: ${result.insertId}`, req.ip);
        res.status(201).json({ success: true, message: 'Election created', data: { id: result.insertId } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUT /elections/:id
router.put('/elections/:id', async (req, res) => {
    const { title, description, start_time, end_time, status } = req.body;
    try {
        await pool.query(
            'UPDATE elections SET title = ?, description = ?, start_time = ?, end_time = ?, status = ? WHERE id = ?',
            [title, description, start_time, end_time, status, req.params.id]
        );
        await logAudit(req.user.id, 'UPDATE_ELECTION', `Updated election ID: ${req.params.id}`, req.ip);
        res.json({ success: true, message: 'Election updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE /elections/:id
router.delete('/elections/:id', async (req, res) => {
    const electionId = req.params.id;
    console.log(`[Admin API] DELETE Election Request received for ID: ${electionId}`);
    try {
        // Since we enabled ON DELETE CASCADE in the DB, deleting the election 
        // will automatically purge all related votes and candidates.
        const [result] = await pool.query('DELETE FROM elections WHERE id = ?', [electionId]);
        console.log(`[Admin API] Database delete result for ID ${electionId}:`, result);
        
        await logAudit(req.user.id, 'DELETE_ELECTION', `Permanently Deleted election ID: ${electionId} and all associated data`, req.ip);
        
        res.json({ success: true, message: 'Election and all related data deleted successfully' });
    } catch (error) {
        console.error(`[Admin API] CRITICAL ERROR deleting election ${electionId}:`, error);
        res.status(500).json({ success: false, message: 'Server error: Failed to delete election' });
    }
});

// PUT /elections/:id/start
router.put('/elections/:id/start', async (req, res) => {
    try {
        await pool.query("UPDATE elections SET status = 'active' WHERE id = ?", [req.params.id]);
        await logAudit(req.user.id, 'START_ELECTION', `Force Started election ID: ${req.params.id}`, req.ip);
        res.json({ success: true, message: 'Election successfully started' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUT /elections/:id/stop
router.put('/elections/:id/stop', async (req, res) => {
    const electionId = req.params.id;
    console.log(`[Admin API] Stop Election Request received for ID: ${electionId}`);
    try {
        const [result] = await pool.query("UPDATE elections SET status = 'closed' WHERE id = ?", [electionId]);
        console.log(`[Admin API] Database update result for ID ${electionId}:`, result);
        
        await logAudit(req.user.id, 'STOP_ELECTION', `Force Stopped election ID: ${electionId}`, req.ip);
        
        console.log(`[Admin API] Election ${electionId} successfully stopped and audited.`);
        res.json({ success: true, message: 'Election successfully stopped' });
    } catch (error) {
        console.error(`[Admin API] CRITICAL ERROR stopping election ${electionId}:`, error);
        res.status(500).json({ success: false, message: 'Server error: Failed to stop election' });
    }
});

// POST /elections/:id/candidates
router.post('/elections/:id/candidates', async (req, res) => {
    const { name, party, party_name, party_logo, bio, photo_url } = req.body;
    
    // Explicit Base64 Rejection to prevent longtext crashes if fallback wasn't adequate
    if (party_logo && party_logo.startsWith("data:image")) {
         return res.status(400).json({ success: false, message: 'Base64 images are not supported. Please upload using the drag and drop URL uploader tools.' });
    }
    
    try {
        const [result] = await pool.query(
            'INSERT INTO candidates (election_id, name, party, party_name, party_logo, bio, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.params.id, name, party, party_name, party_logo, bio, photo_url]
        );
        await logAudit(req.user.id, 'ADD_CANDIDATE', `Added candidate ID: ${result.insertId} to election: ${req.params.id}`, req.ip);
        res.status(201).json({ success: true, message: 'Candidate added', data: { id: result.insertId } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE /candidates/:id
router.delete('/candidates/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM candidates WHERE id = ?', [req.params.id]);
        await logAudit(req.user.id, 'REMOVE_CANDIDATE', `Removed candidate ID: ${req.params.id}`, req.ip);
        res.json({ success: true, message: 'Candidate removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /elections/:id/results
router.get('/elections/:id/results', async (req, res) => {
    try {
        const [candidates] = await pool.query(
            `SELECT c.id, c.name, c.party, c.party_name, c.party_logo, c.photo_url, (SELECT COUNT(*) FROM votes v WHERE v.candidate_id = c.id) as vote_count 
             FROM candidates c WHERE c.election_id = ?`,
            [req.params.id]
        );
        const [totalVotesRes] = await pool.query('SELECT COUNT(*) as total FROM votes WHERE election_id = ?', [req.params.id]);
        const totalVotes = totalVotesRes[0].total;
        
        const [totalVotersRes] = await pool.query("SELECT COUNT(*) as total FROM users WHERE role='voter'");
        const totalVoters = totalVotersRes[0].total;
        
        const turnout = totalVoters > 0 ? ((totalVotes / totalVoters) * 100).toFixed(2) : 0;
        
        res.json({ success: true, data: { candidates, totalVotes, turnout: parseFloat(turnout) } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /users
router.get('/users', async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, name, email, role, is_verified, is_blocked, created_at FROM users');
        res.json({ success: true, data: users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PATCH /users/:id/verify
router.patch('/users/:id/verify', async (req, res) => {
    const { is_verified } = req.body;
    try {
        await pool.query('UPDATE users SET is_verified = ? WHERE id = ?', [is_verified, req.params.id]);
        await logAudit(req.user.id, 'VERIFY_USER', `Changed verification status of user ID: ${req.params.id} to ${is_verified}`, req.ip);
        res.json({ success: true, message: 'User verification updated' });
    } catch (error) {
        console.error("Error verifying user:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PATCH /users/:id/block
router.patch('/users/:id/block', async (req, res) => {
    const { is_blocked } = req.body;
    try {
        await pool.query('UPDATE users SET is_blocked = ? WHERE id = ?', [is_blocked, req.params.id]);
        await logAudit(req.user.id, 'BLOCK_USER', `Changed block status of user ID: ${req.params.id} to ${is_blocked}`, req.ip);
        res.json({ success: true, message: 'User block status updated' });
    } catch (error) {
        console.error("Error blocking user:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /audit-log
router.get('/audit-log', async (req, res) => {
    try {
        const [logs] = await pool.query('SELECT a.*, u.name as user_name FROM audit_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 100');
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
