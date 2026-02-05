import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { storage } from '../utils/storage';
import './options.css';

function Options() {
    const [provider, setProvider] = useState<'openai' | 'anthropic' | 'gemini'>('openai');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gpt-4');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const config = await storage.getAPIConfig();
        if (config) {
            setProvider(config.provider);
            setApiKey(config.apiKey);
            setModel(config.model);
        }
    };

    const handleSave = async () => {
        setSaveStatus('saving');
        await storage.setAPIConfig({ provider, apiKey, model });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    return (
        <div className="options-container">
            <header className="options-header">
                <h1>⚙️ LLM Council Settings</h1>
                <p className="subtitle">Configure your AI provider and API keys</p>
            </header>

            <div className="options-content">
                <section className="settings-section">
                    <h2>API Configuration</h2>

                    <div className="form-group">
                        <label htmlFor="provider">AI Provider</label>
                        <select
                            id="provider"
                            value={provider}
                            onChange={(e) => setProvider(e.target.value as any)}
                            className="form-control"
                        >
                            <option value="openai">OpenAI (GPT-4)</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="apiKey">API Key</label>
                        <input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your API key"
                            className="form-control"
                        />
                        <small className="form-hint">
                            {provider === 'openai'
                                ? 'Get your key from platform.openai.com'
                                : 'Get your key from console.anthropic.com'}
                        </small>
                    </div>

                    <button
                        onClick={handleSave}
                        className={`save-btn ${saveStatus}`}
                        disabled={saveStatus === 'saving'}
                    >
                        {saveStatus === 'idle' && 'Save Settings'}
                        {saveStatus === 'saving' && 'Saving...'}
                        {saveStatus === 'saved' && '✓ Saved!'}
                    </button>
                </section>

                <section className="info-section">
                    <h3>About LLM Council</h3>
                    <p>Multi-agent AI analysis system that brings collaborative intelligence to your browser.</p>

                    <h4>Council Members:</h4>
                    <ul>
                        <li><strong>👁️ Vision Agent</strong> - Analyzes UI/UX and visual aspects</li>
                        <li><strong>📚 Technical Librarian</strong> - Searches documentation and provides solutions</li>
                        <li><strong>❤️ Empathy Analyst</strong> - Assesses user sentiment and urgency</li>
                        <li><strong>🎯 Chairperson</strong> - Synthesizes perspectives into actionable verdict</li>
                    </ul>

                    <div className="privacy-note">
                        <strong>Privacy:</strong> Your API key is stored locally and never shared. All analysis happens directly with your chosen provider.
                    </div>
                </section>
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Options />
    </React.StrictMode>
);
