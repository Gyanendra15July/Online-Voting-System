const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const voteRoutes = require('./routes/vote');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Elevated significantly for development testing environments
    message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 50, // Elevated for seamless developer local testing
    message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' }
});

app.use('/api/', apiLimiter);

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/upload', uploadRoutes);

// Database connection test API route
app.get('/api/test-db', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 + 1 AS connection_status');
        res.status(200).json({ 
            success: true, 
            message: 'Database connection is active!', 
            data: rows[0] 
        });
    } catch (err) {
        console.error('Test DB Route Error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database connection failed', 
            error: err.message 
        });
    }
});

// Explicit JSON formatting constraint for generic API missing endpoints
app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: `404 API Not Found: Endpoint ${req.method} ${req.originalUrl} does not exist.` });
});

// Fallback to index.html for unknown frontend routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cron job: Full Election Lifecycle Manager (runs every minute)
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();
        const [elections] = await pool.query('SELECT id, start_time, end_time, status, results_published FROM elections');
        
        for (let election of elections) {
            const start = new Date(election.start_time);
            const end = new Date(election.end_time);
            let newStatus = election.status;

            if (now < start) {
                newStatus = 'upcoming';
            } else if (now >= start && now <= end) {
                newStatus = 'active';
            } else if (now > end) {
                newStatus = 'closed';
            }

            // Status transition
            if (newStatus !== election.status) {
                await pool.query('UPDATE elections SET status = ? WHERE id = ?', [newStatus, election.id]);
                console.log(`[Lifecycle] Election ${election.id} status: ${election.status} → ${newStatus}`);
            }

            // Auto-publish results when election closes
            if (newStatus === 'closed' && !election.results_published) {
                // Calculate and cache winner info
                const [candidates] = await pool.query(
                    `SELECT c.id, c.name, (SELECT COUNT(*) FROM votes v WHERE v.candidate_id = c.id) as vote_count 
                     FROM candidates c WHERE c.election_id = ? ORDER BY vote_count DESC`,
                    [election.id]
                );
                
                const winner = candidates.length > 0 ? candidates[0].name : 'No candidates';
                const totalVotes = candidates.reduce((sum, c) => sum + c.vote_count, 0);
                
                await pool.query('UPDATE elections SET results_published = TRUE WHERE id = ?', [election.id]);
                console.log(`[Lifecycle] Election ${election.id} results auto-published. Winner: ${winner} (${totalVotes} total votes)`);
            }
        }
    } catch (err) {
        console.error('[Lifecycle] Cron error:', err);
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Unhandled Rejections Handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n\x1b[32m✔ Server successfully started in production mode!\x1b[0m`);
    console.log(`Server listening on \x1b[36m\x1b[4m0.0.0.0:${PORT}\x1b[0m\n`);
    
    // Auto-open browser logic removed for cloud deployment (Render/Heroku/etc)
});
