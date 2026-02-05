import React from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

function Popup() {
    const openSidePanel = () => {
        chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    };

    const openOptions = () => {
        chrome.runtime.openOptionsPage();
    };

    return (
        <div className="popup-container">
            <div className="popup-header">
                <h1>🤖 LLM Council</h1>
                <p className="subtitle">Multi-Agent AI Analysis</p>
            </div>

            <div className="popup-actions">
                <button className="action-btn primary" onClick={openSidePanel}>
                    <span className="icon">📋</span>
                    <div className="btn-text">
                        <div className="btn-title">Open Council Panel</div>
                        <div className="btn-hint">Analyze selected text</div>
                    </div>
                </button>

                <button className="action-btn secondary" onClick={openOptions}>
                    <span className="icon">⚙️</span>
                    <div className="btn-text">
                        <div className="btn-title">Settings</div>
                        <div className="btn-hint">Configure API keys</div>
                    </div>
                </button>
            </div>

            <div className="popup-footer">
                <p className="usage-hint">Select text on any page and right-click → "Analyze with LLM Council"</p>
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);
