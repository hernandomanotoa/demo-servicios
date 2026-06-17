import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ error: 'No se pudo conectar a API Node' }));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 40 }}>
      <h1>⚡ Vite en puerto 5173</h1>
      <p>Este es el frontend secundario servido desde el contenedor Docker.</p>
      <h2>Respuesta de API Node (puerto 3001):</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export default App;
