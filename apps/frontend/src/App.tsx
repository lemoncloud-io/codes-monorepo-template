import React, { useState } from 'react';
import { HelloWorldResponse } from '@shared';

const API_URL = ((window as any).API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000');

const App = () => {
  const [data, setData] = useState<HelloWorldResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchHello = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/hello/0`);
      const result: HelloWorldResponse = await response.json();
      setData(result);
    } catch (err) {
      setError('Error fetching from API');
      console.error('Error fetching from API', err);
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

        {error && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#fee', borderRadius: '4px', color: '#c00' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {data && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f0f0', borderRadius: '4px' }}>
            <strong>API Response:</strong>
            <pre style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
