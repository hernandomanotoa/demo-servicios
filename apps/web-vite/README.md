# web-vite — Vite + React

Frontend secundario. Consume datos de la API Node.

## Scripts

```bash
npm run dev     # Dev server en localhost:5173
npm run build   # Build de producción
npm run preview # Preview del build en localhost:4173
```

## Estructura

- `src/App.jsx` — Componente principal que hace fetch a `http://localhost:3001/`
- `vite.config.js` — Configuración con host `0.0.0.0` para Docker
