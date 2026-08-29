import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    /**
     * Icons are compiled into the bundle as inline SVG from the locally
     * installed Material Symbols set — the same approach the public site uses.
     * A webfont or a runtime fetch would mean a request the dashboard does not
     * need, and icons arriving after paint shift the layout under them.
     */
    Icons({ compiler: 'vue3', scale: 1.15 })
  ],
  server: {
    port: 8000,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      /*
       * The chat's socket, which does not travel over /api.
       *
       * AI-TRAP: ws:true is the whole point. Without the entry the client
       * connects to Vite instead of the API and the chat simply never receives
       * anything; without ws:true the handshake succeeds over polling and then
       * the upgrade to a websocket fails, which looks like a chat that works
       * for a minute and then stops.
       */
      '/socket.io': { target: 'http://localhost:4000', changeOrigin: true, ws: true }
    }
  }
});
