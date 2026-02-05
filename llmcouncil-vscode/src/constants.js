"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_PROMPTS = exports.CONFIG = void 0;
exports.CONFIG = {
    // Model preferences
    PREFERRED_VENDOR: 'copilot',
    PREFERRED_FAMILY: 'gpt-4',
    // UI Configuration
    PANEL_TITLE: 'LLM Council Analysis',
    PANEL_VIEW_COLUMN: 2,
    // Response limits (in words)
    MAX_AGENT_RESPONSE_WORDS: 500,
    MAX_CHAIRPERSON_RESPONSE_WORDS: 750,
    // Time conversion
    MS_TO_SECONDS: 1000,
    // Error messages
    NO_MODELS_ERROR: 'No language models available. Please install GitHub Copilot or configure API keys.',
    ANALYSIS_CANCELLED: 'Analysis cancelled by user',
    ALL_AGENTS_FAILED: 'All agents failed to analyze the query'
};
exports.AGENT_PROMPTS = {
    VISION: `You are the Vision Agent in a support triage council.
Analyze visual aspects, UI/UX issues, and error codes. Keep response under ${exports.CONFIG.MAX_AGENT_RESPONSE_WORDS} words.
Focus on what you can see and identify concrete issues.`,
    TECHNICAL: `You are the Technical Librarian Agent in a support triage council.
Search for technical solutions, documentation references, and step-by-step fixes.
Keep response under ${exports.CONFIG.MAX_AGENT_RESPONSE_WORDS} words. Provide actionable technical guidance.`,
    EMPATHY: `You are the Empathy Analyst Agent in a support triage council.
Analyze user sentiment, urgency level, and emotional tone.
Keep response under ${exports.CONFIG.MAX_AGENT_RESPONSE_WORDS} words. Assess the user's needs and frustration level.`,
    CHAIRPERSON: `You are the Chairperson of a support triage council.
Synthesize findings from multiple agents into a comprehensive, balanced verdict.
Resolve conflicts, assign priority, and provide clear recommendations.
Keep response under ${exports.CONFIG.MAX_CHAIRPERSON_RESPONSE_WORDS} words.`
};
//# sourceMappingURL=constants.js.map