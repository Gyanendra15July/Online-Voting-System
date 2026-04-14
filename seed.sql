-- Seed Date
INSERT INTO users (name, email, password, role, is_verified) VALUES 
('Admin User', 'admin@vote.com', '$2a$12$KGCqxaDk0NyKeJuYR39ka.gRCUaBhq2USv3tkann19/9wPQXL7vnG', 'admin', TRUE);

INSERT INTO elections (title, description, start_time, end_time, status, created_by) VALUES
('Presidential Election 2026', 'National Election for President', NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 2 DAY, 'active', 1);

INSERT INTO candidates (election_id, name, party, bio, photo_url) VALUES
(1, 'Alice Smith', 'Progressive Party', 'Focused on education and healthcare.', 'https://placehold.co/150/6366f1/ffffff?text=Alice'),
(1, 'Bob Johnson', 'Conservative Party', 'Strong economy and lower taxes.', 'https://placehold.co/150/ec4899/ffffff?text=Bob'),
(1, 'Charlie Davis', 'Green Party', 'Environmental protection and renewable energy.', 'https://placehold.co/150/10b981/ffffff?text=Charlie');
