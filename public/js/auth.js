// Prevent UI flicker while auth logic determines routing
document.documentElement.style.visibility = 'hidden';

// Core Tokens
const getToken = () => localStorage.getItem('token');
const getRole = () => localStorage.getItem('role');

/**
 * Advanced Device Fingerprinting Utility
 * Generates a unique, persistent identifier for the user's current environment.
 */
const getDeviceId = () => {
    const nav = window.navigator;
    const screen = window.screen;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Canvas Fingerprinting (Standard Anti-Fraud Technique)
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125,1,62,20);
    ctx.fillStyle = "#069";
    ctx.fillText("eVoteSecurity_v1:Fingerprint", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("eVoteSecurity_v1:Fingerprint", 4, 17);
    const canvasHash = canvas.toDataURL();

    const components = [
        nav.userAgent,
        nav.language,
        screen.colorDepth,
        screen.height,
        screen.width,
        new Date().getTimezoneOffset(),
        nav.platform,
        canvasHash.substring(0, 100) // Sample of the canvas hash
    ];
    
    // Create a simple hash of the components string
    const fingerprintString = components.join('||');
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
        const char = fingerprintString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `DEVICE_${Math.abs(hash).toString(16).toUpperCase()}`;
};

// Refresh/Auth State Preserver Middleware
const checkAuth = async (requiredRole = null) => {
    const token = getToken();

    // No token -> Kick to login logic
    if (!token) {
        const path = window.location.pathname;
        if (!path.endsWith('index.html') && !path.endsWith('register.html') && path !== '/') {
            window.location.href = 'index.html';
        } else {
            document.documentElement.style.visibility = 'visible';
        }
        return false;
    }
    
    // Validate Token + Restore Local Session Details
    try {
        const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (!res.ok || !data.success) {
            throw new Error('Invalid or expired session');
        }
        
        // Refresh local cache via DB fetch
        const user = data.data;
        localStorage.setItem('role', user.role);
        localStorage.setItem('name', user.name);

        const currentPath = window.location.pathname;
        
        // If they hit index/register while actively logged in -> dashboard
        if (currentPath.endsWith('index.html') || currentPath.endsWith('register.html') || currentPath === '/') {
            window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
            return false;
        }

        // Role authorization check
        if (requiredRole && user.role !== requiredRole) {
            window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
            return false;
        }

        // Auth fully cleared, display validated DOM
        document.documentElement.style.visibility = 'visible';
        return true;
        
    } catch(err) {
        console.error("Auth mismatch:", err);
        logout(); // Force clean
        return false;
    }
};

// UI helpers
const showAlert = (message, type = 'error') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// API helpers
const API_BASE_URL = ''; // Relative path for production (Same origin)

const apiCall = async (url, method = 'GET', body = null) => {
    const token = getToken();
    const headers = { 
        'Content-Type': 'application/json',
        'X-Device-Id': getDeviceId() // Anti-fraud header for constant session validation
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const targetUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    let res;
    try {
        res = await fetch(targetUrl, config);
    } catch (networkError) {
        console.error("Fetch API Failed. Target URL:", targetUrl, "Error:", networkError);
        throw new Error(`Network error: Could not reach the API server at ${targetUrl}`);
    }
    
    // Only auto-logout on 401 (token expired/invalid), NOT on 403 (permission denied)
    // 403 is a business logic error (e.g. "already voted", "not verified") — NOT a session error
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please login again.');
    }

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch(e) {
        console.error("Not JSON:", text);
        throw new Error('API Error: Expected JSON but received HTML/Text. Check backend router.');
    }

    if (!res.ok) {
        throw new Error(data.message || 'API request failed');
    }
    return data;
};

// Identity
const loginUser = async (email, password) => {
    const data = await apiCall('/api/auth/login', 'POST', { 
        email, 
        password,
        device_id: getDeviceId() 
    });
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('role', data.data.role);
    localStorage.setItem('name', data.data.name);
    window.location.href = data.data.role === 'admin' ? 'admin.html' : 'dashboard.html';
};

const registerUser = async (name, email, password, role, voterId, faceData, photoUrl) => {
    const data = await apiCall('/api/auth/register', 'POST', { 
        name, 
        email, 
        password, 
        role, 
        voter_id: voterId, 
        face_data: faceData, 
        photo_url: photoUrl,
        device_id: getDeviceId()
    });
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('role', data.data.role);
    window.location.href = data.data.role === 'admin' ? 'admin.html' : 'dashboard.html';
};

const logout = () => {
    localStorage.clear(); // Safe full purge
    window.location.href = 'index.html';
};

// Immediately invoke session validation independently when auth.js executes
checkAuth();
