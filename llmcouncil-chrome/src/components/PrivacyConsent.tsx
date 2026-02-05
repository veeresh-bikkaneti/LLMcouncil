import React, { useState, useEffect } from 'react';
import { storage } from '../utils/storage';

export function PrivacyConsent() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        checkConsent();
    }, []);

    async function checkConsent() {
        const hasConsent = await storage.hasPrivacyConsent();
        if (!hasConsent) {
            setVisible(true);
        }
    }

    async function handleAccept() {
        await storage.setPrivacyConsent(true);
        setVisible(false);
    }

    async function handleDecline() {
        await storage.setPrivacyConsent(false);
        setVisible(false);
        // Optionally redirect to options page to configure local LLM
    }

    if (!visible) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex items-start mb-4">
                    <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="ml-3 flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Privacy Notice
                        </h3>
                        <div className="mt-2 text-sm text-gray-700 space-y-2">
                            <p className="font-medium text-amber-700">
                                ⚠️ Your selected text will be sent to external AI services
                            </p>
                            <p>
                                LLM Council sends your selected text to third-party AI providers (OpenAI, Anthropic) for analysis.
                            </p>
                            <p className="font-medium">What is sent:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                                <li>Selected text from webpages</li>
                                <li>Page URL (for context)</li>
                            </ul>
                            <p className="font-medium">What is stored locally:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                                <li>Your API keys (encrypted by Chrome)</li>
                                <li>Analysis history (can be cleared)</li>
                            </ul>
                            <p className="text-xs text-gray-500 mt-3">
                                By continuing, you agree that your content may be processed by third-party AI providers subject to their privacy policies.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={handleDecline}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Decline
                    </button>
                    <button
                        onClick={handleAccept}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Accept & Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
