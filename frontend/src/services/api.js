// frontend/src/services/api.js
const API_BASE_URL = 'http://localhost:5000/api';

export const apiLogin = async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    return response.json();
};

export const apiGetTargets = async () => {
    const response = await fetch(`${API_BASE_URL}/targets`);
    return response.json();
};

export const apiAddTarget = async (targetPath) => {
    const response = await fetch(`${API_BASE_URL}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_path: targetPath }),
    });
    return response.json();
};

export const apiTriggerScan = async (targetId = null) => {
    const response = await fetch(`${API_BASE_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId }),
    });
    return response.json();
};

export const apiGetAlerts = async () => {
    const response = await fetch(`${API_BASE_URL}/alerts`);
    return response.json();
};