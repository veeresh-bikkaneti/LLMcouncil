export const CONFIG = {
    MAX_HISTORY: 50,
    ANALYSIS_TIMEOUT: 60000, // 60 seconds
    AGENT_TIMEOUT: 30000, // 30 seconds per agent
    DEFAULT_PROVIDER: 'openai' as const,
    DEFAULT_MODEL: 'gpt-4-turbo',

    // Privacy & Security
    REQUIRE_PRIVACY_CONSENT: true,
    WARN_ON_SENSITIVE_DATA: true,
    ENCRYPT_API_KEYS: true, // Chrome handles this automatically
};

export const AGENT_PROMPTS = {
    vision: (text: string) => `As a Vision Agent, analyze this text for UI/UX issues, visual aspects, and design concerns:\n\n${text}\n\nProvide specific, actionable insights about visual and user experience elements.`,

    technical: (text: string) => `As a Technical Librarian, provide technical solutions, documentation references, and code fixes for:\n\n${text}\n\nInclude links to relevant documentation and suggest specific implementations.`,

    empathy: (text: string) => `As an Empathy Analyst, assess the user sentiment, urgency level, and emotional context of:\n\n${text}\n\nIdentify frustration levels, urgency indicators, and user needs.`,

    chairperson: (analyses: string[]) => `As Chairperson, synthesize these agent analyses into a final verdict:\n\n${analyses.map((a, i) => `Agent ${i + 1}:\n${a}`).join('\n\n')}\n\nProvide a consensus recommendation with clear action items.`
};

export const MESSAGES = {
    NO_API_KEY: 'Please configure your API key in Settings',
    ANALYSIS_ERROR: 'Failed to analyze text. Please try again.',
    NO_TEXT_SELECTED: 'No text selected. Please select text to analyze.',
    STORAGE_ERROR: 'Failed to save analysis to history',
    PRIVACY_CONSENT_REQUIRED: 'You must accept the privacy notice to use LLM Council',
    SENSITIVE_DATA_WARNING: '⚠️ Warning: Avoid selecting passwords or sensitive information',
    API_KEY_SECURITY: '🔒 Your API key is encrypted and stored locally. Never share it with anyone.'
};

export const PRIVACY_POLICY = {
    title: 'LLM Council Privacy Policy',
    points: [
        'Selected text is sent to third-party AI providers (OpenAI, Anthropic) for analysis',
        'Your API keys are encrypted and stored locally in Chrome storage',
        'Analysis history is stored locally on your device and can be cleared at any time',
        'No data is collected or sent to LLM Council developers',
        'You can revoke consent and delete all data by uninstalling the extension'
    ],
    externalPolicies: {
        openai: 'https://openai.com/policies/privacy-policy',
        anthropic: 'https://www.anthropic.com/privacy'
    }
};
