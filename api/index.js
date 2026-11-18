// Vercel serverless entry: runs the Express app from server.ts.
// server.ts is bundled to server-dist/server.mjs by `npm run build` (see package.json),
// because Vercel's per-file TypeScript compile leaves extensionless ESM imports that Node rejects.
// vercel.json rewrites /api/*, /health, /robots.txt, /sitemap.xml, /feeds/* and /uploads/* here;
// everything else is served from the static Vite build in dist/.
import { buildApp } from '../server-dist/server.mjs';

const appPromise = buildApp();

export default async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
}
