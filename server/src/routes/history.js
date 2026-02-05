"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/history', (req, res) => {
    res.json({ status: 'success', data: [] });
});
exports.default = router;
//# sourceMappingURL=history.js.map