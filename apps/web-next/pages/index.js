import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3004/')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ error: 'No se pudo conectar a API Python' }));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 40 }}>
      <h1>🚀 Next.js en puerto 3000</h1>
      <p>Este es el frontend principal servido desde el contenedor Docker.</p>
      <h2>Respuesta de API Python (puerto 3004):</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
