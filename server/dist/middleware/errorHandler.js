"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = errorHandler;
function errorHandler(err, req, res, next) {
    console.error('[ERROR]', err);
    const status = err.statusCode || 500;
    res.status(status).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
    });
}
