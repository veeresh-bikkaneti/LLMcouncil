"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const constants_1 = require("../../constants");
suite('Constants Unit Tests', () => {
    suite('CONFIG', () => {
        test('should have all required configuration values', () => {
            // Assert
            assert.ok(constants_1.CONFIG.PREFERRED_VENDOR);
            assert.ok(constants_1.CONFIG.PREFERRED_FAMILY);
            assert.ok(constants_1.CONFIG.PANEL_TITLE);
            assert.ok(typeof constants_1.CONFIG.PANEL_VIEW_COLUMN === 'number');
            assert.ok(typeof constants_1.CONFIG.MAX_AGENT_RESPONSE_WORDS === 'number');
            assert.ok(typeof constants_1.CONFIG.MAX_CHAIRPERSON_RESPONSE_WORDS === 'number');
            assert.ok(typeof constants_1.CONFIG.MS_TO_SECONDS === 'number');
            assert.ok(constants_1.CONFIG.NO_MODELS_ERROR);
            assert.ok(constants_1.CONFIG.ANALYSIS_CANCELLED);
            assert.ok(constants_1.CONFIG.ALL_AGENTS_FAILED);
        });
        test('should have sensible word limits', () => {
            // Assert
            assert.strictEqual(constants_1.CONFIG.MAX_AGENT_RESPONSE_WORDS, 500);
            assert.strictEqual(constants_1.CONFIG.MAX_CHAIRPERSON_RESPONSE_WORDS, 750);
            assert.ok(constants_1.CONFIG.MAX_CHAIRPERSON_RESPONSE_WORDS > constants_1.CONFIG.MAX_AGENT_RESPONSE_WORDS);
        });
        test('should have correct time conversion', () => {
            // Assert
            assert.strictEqual(constants_1.CONFIG.MS_TO_SECONDS, 1000);
        });
    });
    suite('AGENT_PROMPTS', () => {
        test('should have prompts for all agent roles', () => {
            // Assert
            assert.ok(constants_1.AGENT_PROMPTS.VISION);
            assert.ok(constants_1.AGENT_PROMPTS.TECHNICAL);
            assert.ok(constants_1.AGENT_PROMPTS.EMPATHY);
            assert.ok(constants_1.AGENT_PROMPTS.CHAIRPERSON);
        });
        test('should include word limits in prompts', () => {
            // Assert
            assert.ok(constants_1.AGENT_PROMPTS.VISION.includes(String(constants_1.CONFIG.MAX_AGENT_RESPONSE_WORDS)));
            assert.ok(constants_1.AGENT_PROMPTS.TECHNICAL.includes(String(constants_1.CONFIG.MAX_AGENT_RESPONSE_WORDS)));
            assert.ok(constants_1.AGENT_PROMPTS.EMPATHY.includes(String(constants_1.CONFIG.MAX_AGENT_RESPONSE_WORDS)));
            assert.ok(constants_1.AGENT_PROMPTS.CHAIRPERSON.includes(String(constants_1.CONFIG.MAX_CHAIRPERSON_RESPONSE_WORDS)));
        });
        test('should have descriptive role descriptions', () => {
            // Assert
            assert.ok(constants_1.AGENT_PROMPTS.VISION.includes('Vision Agent'));
            assert.ok(constants_1.AGENT_PROMPTS.TECHNICAL.includes('Technical Librarian'));
            assert.ok(constants_1.AGENT_PROMPTS.EMPATHY.includes('Empathy Analyst'));
            assert.ok(constants_1.AGENT_PROMPTS.CHAIRPERSON.includes('Chairperson'));
        });
    });
});
//# sourceMappingURL=constants.test.js.map