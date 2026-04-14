const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { logAudit } = require('../utils/logger');
const { sendResponse } = require('../utils/helpers');

const router = express.Router();



router.post('/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['voter', 'admin']).withMessage('Role must be either voter or admin')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendResponse(res, 400, false, 'Validation error', errors.array());

    let { name, email, password, role, voter_id, face_data, photo_url, device_id } = req.body;
    
    if (!device_id) return sendResponse(res, 400, false, 'Device fingerprint is required for secure registration');
    
    // Role-specific validation
    if (role === 'voter') {
        if (!voter_id || voter_id.trim() === '') return sendResponse(res, 400, false, 'Voter ID is required for voters.');
        if (!face_data || face_data.trim() === '') return sendResponse(res, 400, false, 'Biometric face data is required for voters.');
    }

    if (role === 'admin') {
        if (!email.toLowerCase().endsWith('@vote.com')) {
            return sendResponse(res, 403, false, 'Unauthorized admin access: Only @vote.com domains allowed.');
        }
    }

    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return sendResponse(res, 400, false, 'Email already registered');

        if (role === 'voter') {
            const [existingVoter] = await pool.query('SELECT id FROM users WHERE voter_id = ?', [voter_id]);
            if (existingVoter.length > 0) return sendResponse(res, 400, false, 'Voter ID already registered');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        let insertData = [name, email, hashedPassword, role];
        let query = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';

        if (role === 'voter') {
            insertData = [name, email, hashedPassword, role, voter_id, face_data, device_id];
            query = 'INSERT INTO users (name, email, password, role, voter_id, face_data, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
        } else if (role === 'admin') {
            insertData = [name, email, hashedPassword, role, photo_url, device_id];
            query = 'INSERT INTO users (name, email, password, role, photo_url, device_id) VALUES (?, ?, ?, ?, ?, ?)';
        }

        const [result] = await pool.query(query, insertData);

        const userId = result.insertId;
        // Bind JWT specifically to this device fingerprint
        const token = jwt.sign({ id: userId, role, deviceId: device_id }, process.env.JWT_SECRET, { expiresIn: '24h' });

        await logAudit(userId, 'REGISTER', `User registered as ${role} carrying biometric signature`, req.ip);

        return sendResponse(res, 201, true, 'Registration+Verification successful', { token, role });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
             if(error.message.includes('voter_id')) {
                 return sendResponse(res, 400, false, 'Duplicate Voter ID: This identity has already been registered.');
             }
        }
        return sendResponse(res, 500, false, 'Server error');
    }
});

router.post('/login', [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation error', data: errors.array() });

    const { email, password, device_id } = req.body;
    
    if (!device_id) return sendResponse(res, 400, false, 'Device fingerprint is required for secure authentication');

    try {
        console.log(`[Auth API] Login attempt for email: ${email}`);
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            console.log(`[Auth API] User not found for email: ${email}`);
            return sendResponse(res, 400, false, 'Invalid credentials: User not found');
        }

        const user = users[0];
        
        if (user.is_blocked) {
            console.log(`[Auth API] Blocked user attempt for email: ${email}`);
            return sendResponse(res, 403, false, 'Your account has been blocked by an administrator.');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`[Auth API] Incorrect password for email: ${email}`);
            return sendResponse(res, 400, false, 'Invalid credentials: Incorrect password');
        }

        console.log(`[Auth API] Login successful for user_id: ${user.id}`);
        
        // Update device_id on login to bind current session
        await pool.query('UPDATE users SET device_id = ? WHERE id = ?', [device_id, user.id]);
        
        // Bind JWT specifically to this device fingerprint
        const token = jwt.sign({ id: user.id, role: user.role, deviceId: device_id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        
        await logAudit(user.id, 'LOGIN', 'User logged in', req.ip);

        return sendResponse(res, 200, true, 'Login successful', { token, role: user.role, name: user.name });
    } catch (error) {
        console.error(error);
        return sendResponse(res, 500, false, 'Server error');
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, name, email, role, is_verified, created_at FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
        
        res.json({ success: true, data: users[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
