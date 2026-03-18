// base route for the backend
const API_BASE_URL = 'http://127.0.0.1:8000'

export async function getHealth() {

    // does a request for base/health
    const response = await fetch(`${API_BASE_URL}/health`)
    
    // checks if the status is not ok
    if (!response.ok) {
        throw new Error('Failed to fetch backend health')
    }

    // Returns the response
    return response.json()
}