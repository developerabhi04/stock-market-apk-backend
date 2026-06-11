const sanitizeValue = (value) => {
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    if (value && typeof value === 'object') {
        const sanitizedObject = {};

        for (const [key, nestedValue] of Object.entries(value)) {
            const sanitizedKey = key.replace(/\$/g, '').replace(/\./g, '');
            sanitizedObject[sanitizedKey] = sanitizeValue(nestedValue);
        }

        return sanitizedObject;
    }

    return value;
};

const mongoSanitizeMiddleware = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
    }

    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeValue(req.params);
    }

    next();
};

export default mongoSanitizeMiddleware;