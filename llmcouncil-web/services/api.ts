const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// ============= HELPER =============
// Placeholder for token management
function getToken() {
    return localStorage.getItem('token') || '';
}

// ============= AUTH =============
export async function login(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw new Error('Login failed');
    const data = await response.json();
    localStorage.setItem('token', data.token);
    return data;
}

// ============= SUBMIT TICKET =============
export async function submitTicket(query: string, image?: File) {
    const formData = new FormData();
    formData.append('query', query);
    if (image) formData.append('image', image);

    const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
    });

    if (!response.ok) throw new Error('Submission failed');
    const data = await response.json();
    return data; // { reportId, status }
}

// ============= POLL FOR RESULTS =============
export async function pollResults(reportId: string) {
    const response = await fetch(`${API_URL}/api/results/${reportId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
    });

    if (!response.ok) throw new Error('Poll failed');
    return response.json();
}

// ============= HISTORY =============
export async function fetchHistory(limit = 50, offset = 0) {
    const response = await fetch(
        `${API_URL}/api/history?limit=${limit}&offset=${offset}`,
        { headers: { 'Authorization': `Bearer ${getToken()}` } }
    );

    if (!response.ok) throw new Error('Fetch history failed');
    return response.json();
}

// ============= ANALYTICS =============
export async function fetchAnalytics() {
    const response = await fetch(`${API_URL}/api/analytics`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
    });

    if (!response.ok) throw new Error('Fetch analytics failed');
    return response.json();
}
