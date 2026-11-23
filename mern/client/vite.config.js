import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  server:{port:5173,proxy:{'/api':'http://localhost:5001'}},
  test:{environment:'jsdom',globals:true,setupFiles:['./src/test/setup.js'],css:false,
    include:['src/**/*.test.{js,jsx}'],
    coverage:{provider:'v8',include:['src/**/*.{js,jsx}'],exclude:['src/**/*.test.*','src/test/**','src/main.jsx']}}
});
