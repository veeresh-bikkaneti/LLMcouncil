"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const requestLogger = (req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
};
exports.default = requestLogger;
