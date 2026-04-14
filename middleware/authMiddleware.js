const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1]; // "Bearer <token>"
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. Invalid token format.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Advanced Security: Session Binding Validation
        const requestDeviceId = req.header('X-Device-Id');
        if (decoded.deviceId && requestDeviceId && decoded.deviceId !== requestDeviceId) {
            console.warn(`[Security] Session hijack attempt blocked for User ${decoded.id}. Device Mismatch: ${decoded.deviceId} vs ${requestDeviceId}`);
            return res.status(401).json({ success: false, message: 'Security Breach: Session is bound to a different device. Please login again.' });
        }

        req.user = decoded; // { id, role, deviceId }
        next();
    } catch (error) {
        console.error("JWT Verification Error:", error);
        res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};

module.exports = authMiddleware;
