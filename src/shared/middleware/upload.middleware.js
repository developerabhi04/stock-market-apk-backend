import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const imageFileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype =
        allowedTypes.test(file.mimetype) ||
        file.mimetype === 'image/svg+xml';

    if (mimetype && extname) {
        return cb(null, true);
    }

    cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp, svg)'));
};

// ==================== BANNER UPLOAD ====================
const bannerUploadsDir = path.join(__dirname, '../../../uploads/banners');
ensureDir(bannerUploadsDir);

const bannerStorage = multer.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, bannerUploadsDir);
    },
    filename: function (_req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});

export const uploadBannerImage = multer({
    storage: bannerStorage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: imageFileFilter
}).single('banner');

// ==================== INDEX LOGO UPLOAD ====================
const indexUploadsDir = path.join(__dirname, '../../../uploads/indices');
ensureDir(indexUploadsDir);

const indexStorage = multer.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, indexUploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const safeSymbol = (req.body.symbol || req.params.id || 'index')
            .toString()
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .toLowerCase();

        cb(null, `index-${safeSymbol}-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
    }
});

export const uploadIndexLogo = multer({
    storage: indexStorage,
    limits: {
        fileSize: 2 * 1024 * 1024
    },
    fileFilter: imageFileFilter
}).single('logo');

// ==================== STOCK LOGO UPLOAD ====================
const stockUploadsDir = path.join(__dirname, '../../../uploads/stocks');
ensureDir(stockUploadsDir);

const stockStorage = multer.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, stockUploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const safeSymbol = (req.body.symbol || req.params.id || 'stock')
            .toString()
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .toLowerCase();

        cb(null, `stock-${safeSymbol}-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
    }
});

export const uploadStockLogo = multer({
    storage: stockStorage,
    limits: {
        fileSize: 2 * 1024 * 1024
    },
    fileFilter: imageFileFilter
}).single('logo');