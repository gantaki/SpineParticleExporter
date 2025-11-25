#!/bin/bash
# Скрипт для быстрого запуска v97 в браузере

echo "🚀 Создание проекта для запуска Particle Spine Exporter v97..."

# Создаем папку для проекта
mkdir -p particle-exporter-demo
cd particle-exporter-demo

# Инициализируем npm проект
cat > package.json << 'EOF'
{
  "name": "particle-exporter-demo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "typescript": "^5.2.2"
  }
}
EOF

# Создаем конфиг Vite
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})
EOF

# Создаем tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

cat > tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF

# Создаем структуру папок
mkdir -p src
mkdir -p public

# Создаем index.html
cat > index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Particle Spine Exporter v97</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# Создаем main.tsx
cat > src/main.tsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# Создаем App.tsx (здесь будет импорт компонента)
cat > src/App.tsx << 'EOF'
import ParticleSpineExporter from './ParticleSpineExporter'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ParticleSpineExporter />
    </div>
  )
}

export default App
EOF

# Создаем index.css с Tailwind
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
EOF

# Создаем tailwind.config.js
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# Создаем postcss.config.js
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Добавляем Tailwind в dependencies
npm pkg set dependencies.tailwindcss="^3.3.0"
npm pkg set dependencies.autoprefixer="^10.4.16"
npm pkg set dependencies.postcss="^8.4.32"

echo ""
echo "✅ Проект создан!"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Скопируйте v97 в проект:"
echo "   cp ../particle-spine-exporter_alpha_v97.tsx src/ParticleSpineExporter.tsx"
echo ""
echo "2. Установите зависимости:"
echo "   cd particle-exporter-demo"
echo "   npm install"
echo ""
echo "3. Запустите dev сервер:"
echo "   npm run dev"
echo ""
echo "4. Откройте браузер на http://localhost:3000"
echo ""
