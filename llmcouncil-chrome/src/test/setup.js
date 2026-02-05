"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("@testing-library/jest-dom");
const vitest_1 = require("vitest");
const react_1 = require("@testing-library/react");
// Cleanup after each test
(0, vitest_1.afterEach)(() => {
    (0, react_1.cleanup)();
});
// Mock Chrome APIs
global.chrome = {
    storage: {
        local: {
            get: vitest_1.vi.fn(),
            set: vitest_1.vi.fn(),
            clear: vitest_1.vi.fn(),
        },
    },
    runtime: {
        sendMessage: vitest_1.vi.fn(),
        onMessage: {
            addListener: vitest_1.vi.fn(),
            removeListener: vitest_1.vi.fn(),
        },
    },
    sidePanel: {
        open: vitest_1.vi.fn(),
    },
    contextMenus: {
        create: vitest_1.vi.fn(),
    },
};
//# sourceMappingURL=setup.js.map