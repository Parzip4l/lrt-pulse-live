import { spawn } from 'node:child_process';
import { createTrafficServer } from './traffic-api.mjs';

// The passenger service is private to this container; only Nginx exposes port 4023.
const server = createTrafficServer();
let nginx;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  server.close();
  nginx?.kill('SIGQUIT');
  setTimeout(() => {
    nginx?.kill('SIGKILL');
    process.exit(code);
  }, 5000);
  if (!nginx) process.exit(code);
  else nginx.once('exit', () => process.exit(code));
}
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
server.on('error', () => { console.error('Passenger service failed to start'); stop(1); });
server.listen(3001, '127.0.0.1', () => {
  nginx = spawn('nginx', ['-g', 'daemon off;'], { stdio: 'inherit' });
  nginx.on('error', () => stop(1));
  nginx.on('exit', (code) => { if (!stopping) { server.close(); process.exit(code || 1); } });
});
