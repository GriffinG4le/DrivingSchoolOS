// Vercel Serverless Function entrypoint
const app = require('../src/server');

module.exports = (req, res) => {
  // Mount the Express app at /api on Vercel
  // so routes like /health become /api/health.
  req.url = req.url?.replace(/^\/api/, '') || req.url;
  return app(req, res);
};

