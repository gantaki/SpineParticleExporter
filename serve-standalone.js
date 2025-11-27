#!/usr/bin/env node
/**
 * Simple HTTP server for testing standalone version
 * Usage: node serve-standalone.js [version] [port]
 *
 * Examples:
 *   node serve-standalone.js           # serve default version on port 3000
 *   node serve-standalone.js v99       # serve v99 on port 3000
 *   node serve-standalone.js v97 4000  # serve v97 on port 4000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Parse CLI arguments: version (non-numeric) and optional port (numeric)
const args = process.argv.slice(2);
const defaultVersion = normalizeVersion(args.find(arg => !/^\d+$/.test(arg)) || 'v99');
const PORT = parseInt(args.find(arg => /^\d+$/.test(arg)), 10) || 3000;

// Preload HTML templates for runtime substitution
const htmlTemplates = {
  'standalone.html': fs.readFileSync(path.join(__dirname, 'standalone.html'), 'utf8'),
  'standalone-debug.html': fs.readFileSync(path.join(__dirname, 'standalone-debug.html'), 'utf8')
};

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.tsx': 'text/typescript-jsx',
  '.ts': 'text/typescript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  let filePath = '.' + req.url;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const requestedVersion = normalizeVersion(url.searchParams.get('version') || url.searchParams.get('v') || defaultVersion);

  if (filePath === './') {
    filePath = './standalone.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeType = MIME_TYPES[extname] || 'application/octet-stream';

  // Render HTML templates with the selected version
  const templateName = path.basename(filePath);
  const template = htmlTemplates[templateName];
  if (template) {
    const html = applyVersionTemplate(template, requestedVersion);
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(html, 'utf-8');
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Particle → Spine Exporter Standalone Server (${defaultVersion})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running at http://localhost:${PORT}/`);
  console.log(`📄 Opening: http://localhost:${PORT}/standalone.html?v=${defaultVersion}`);
  console.log('   Use ?version=v96|v97|v98|v99 to swap builds per request.');
  console.log(`   CLI: node serve-standalone.js ${defaultVersion} ${PORT} # serves particle-spine-exporter_alpha_${defaultVersion}.tsx`);
  console.log('\n💡 Press Ctrl+C to stop the server\n');
});

function normalizeVersion(input) {
  if (!input) return 'v99';
  const trimmed = String(input).trim();
  const cleaned = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
  return `v${cleaned}`;
}

function applyVersionTemplate(template, version) {
  const entry = `particle-spine-exporter_alpha_${version}.tsx`;
  return template
    .replace(/__VERSION__/g, version)
    .replace(/__STANDALONE_ENTRY__/g, entry);
}
