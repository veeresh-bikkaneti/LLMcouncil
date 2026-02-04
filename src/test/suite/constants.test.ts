import * as assert from 'assert';
import { CONFIG, AGENT_PROMPTS } from '../../constants';
import { AgentRole } from '../../types/agents';

suite('Constants Unit Tests', () => {
    suite('CONFIG', () => {
        test('should have all required configuration values', () => {
            // Assert
            assert.ok(CONFIG.PREFERRED_VENDOR);
            assert.ok(CONFIG.PREFERRED_FAMILY);
            assert.ok(CONFIG.PANEL_TITLE);
            assert.ok(typeof CONFIG.PANEL_VIEW_COLUMN === 'number');
            assert.ok(typeof CONFIG.MAX_AGENT_RESPONSE_WORDS === 'number');
            assert.ok(typeof CONFIG.MAX_CHAIRPERSON_RESPONSE_WORDS === 'number');
            assert.ok(typeof CONFIG.MS_TO_SECONDS === 'number');
            assert.ok(CONFIG.NO_MODELS_ERROR);
            assert.ok(CONFIG.ANALYSIS_CANCELLED);
            assert.ok(CONFIG.ALL_AGENTS_FAILED);
        });

        test('should have sensible word limits', () => {
            // Assert
            assert.strictEqual(CONFIG.MAX_AGENT_RESPONSE_WORDS, 500);
            assert.strictEqual(CONFIG.MAX_CHAIRPERSON_RESPONSE_WORDS, 750);
            assert.ok(CONFIG.MAX_CHAIRPERSON_RESPONSE_WORDS > CONFIG.MAX_AGENT_RESPONSE_WORDS);
        });

        test('should have correct time conversion', () => {
            // Assert
            assert.strictEqual(CONFIG.MS_TO_SECONDS, 1000);
        });
    });

    suite('AGENT_PROMPTS', () => {
        test('should have prompts for all agent roles', () => {
            // Assert
            assert.ok(AGENT_PROMPTS.VISION);
            assert.ok(AGENT_PROMPTS.TECHNICAL);
            assert.ok(AGENT_PROMPTS.EMPATHY);
            assert.ok(AGENT_PROMPTS.CHAIRPERSON);
        });

        test('should include word limits in prompts', () => {
            // Assert
            assert.ok(AGENT_PROMPTS.VISION.includes(String(CONFIG.MAX_AGENT_RESPONSE_WORDS)));
            assert.ok(AGENT_PROMPTS.TECHNICAL.includes(String(CONFIG.MAX_AGENT_RESPONSE_WORDS)));
            assert.ok(AGENT_PROMPTS.EMPATHY.includes(String(CONFIG.MAX_AGENT_RESPONSE_WORDS)));
            assert.ok(AGENT_PROMPTS.CHAIRPERSON.includes(String(CONFIG.MAX_CHAIRPERSON_RESPONSE_WORDS)));
        });

        test('should have descriptive role descriptions', () => {
            // Assert
            assert.ok(AGENT_PROMPTS.VISION.includes('Vision Agent'));
            assert.ok(AGENT_PROMPTS.TECHNICAL.includes('Technical Librarian'));
            assert.ok(AGENT_PROMPTS.EMPATHY.includes('Empathy Analyst'));
            assert.ok(AGENT_PROMPTS.CHAIRPERSON.includes('Chairperson'));
        });
    });
});
