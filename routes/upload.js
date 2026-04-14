const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure uploads dir
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded' });
        }

        const filename = `img-${Date.now()}.jpg`;
        const filepath = path.join(uploadDir, filename);

        // Compress and resize
        await sharp(req.file.buffer)
            .resize({ width: 500, withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toFile(filepath);

        // Map correctly to base URL
        const url = `/uploads/${filename}`;
        
        res.json({ success: true, url });
    } catch (error) {
        console.error('Upload Error:', error);
        if (error.message === 'Only images are allowed' || error.code === 'LIMIT_FILE_SIZE') {
             res.status(400).json({ success: false, message: error.message });
        } else {
             res.status(500).json({ success: false, message: 'Upload failed' });
        }
    }
});

module.exports = router;
