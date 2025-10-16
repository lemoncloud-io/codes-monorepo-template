import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/dev';

function App() {
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const fetchHello = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/hello`);
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage('Error fetching from API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Template Web</h1>
      <p>Hello World from {API_URL}</p>

      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={fetchHello}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Call API'}
        </button>

        {message && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f0f0', borderRadius: '4px' }}>
            <strong>API Response:</strong> {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
