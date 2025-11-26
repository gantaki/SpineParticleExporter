#!/usr/bin/env node
/**
 * Build standalone v97.tsx from modular sources
 *
 * This script combines all modules into a single self-contained TSX file
 * that can be used without a build system.
 */

const fs = require('fs');
const path = require('path');

const modulesDir = './particle-spine-exporter-v97';
const outputFile = './particle-spine-exporter_alpha_v97.tsx';

console.log('🔨 Building standalone v97 from modules...\n');

// Module files in correct order
const modules = [
  'types.ts',
  'utils.ts',
  'components.tsx',
  'core.ts',
  'export.ts',
  'index.tsx'
];

// Read all modules
const modulesContent = modules.map(moduleName => {
  const filePath = path.join(modulesDir, moduleName);
  console.log(`📖 Reading ${moduleName}...`);
  return {
    name: moduleName,
    content: fs.readFileSync(filePath, 'utf8')
  };
});

console.log('\n🔧 Processing modules...\n');

// Process each module
const processedModules = modulesContent.map(({ name, content }) => {
  console.log(`  Processing ${name}...`);

  let processed = content;

  // Remove module header comments (but keep main header from index.tsx)
  if (name !== 'index.tsx') {
    processed = processed.replace(/^\/\*\*[\s\S]*?\*\/\n\n/m, '');
  }

  // Remove all import statements for local modules
  processed = processed.replace(/^import\s+(?:type\s+)?{[^}]+}\s+from\s+['"]\.\/[^'"]+['"];?\n/gm, '');
  processed = processed.replace(/^import\s+{[^}]+}\s+from\s+['"]\.\/[^'"]+['"];?\n/gm, '');

  // Remove export statements at end of files
  processed = processed.replace(/^export\s+{[\s\S]*?};?\s*$/gm, '');

  // For index.tsx, keep React and lucide-react imports
  if (name === 'index.tsx') {
    // These imports should stay
  } else {
    // For other files, we need to preserve React imports if they exist
    // but remove them later when combining since index.tsx will have them
    if (name === 'components.tsx') {
      // Keep the React imports in components, they'll be deduplicated
    }
  }

  return processed.trim();
});

console.log('\n🔗 Combining modules...\n');

// Combine everything
let standalone = '';

// Start with the header from index.tsx
const indexContent = processedModules[5]; // index.tsx
const headerMatch = indexContent.match(/^\/\*\*[\s\S]*?\*\//);
if (headerMatch) {
  standalone += headerMatch[0] + '\n\n';
}

// Add React imports (from index.tsx)
const reactImportsMatch = indexContent.match(/^import React(?:,\s*{([^}]+)})?\s+from 'react';/m);
const lucideImportsMatch = indexContent.match(/^import {([^}]+)}\s+from\s+'lucide-react';/m);

if (reactImportsMatch) {
  // Replace React import with global destructuring for browser compatibility
  const hooks = reactImportsMatch[1] ? reactImportsMatch[1].trim() : '';
  standalone += `// React from CDN (defined in standalone.html)\n`;
  if (hooks) {
    standalone += `const { ${hooks} } = React;\n`;
  }
}
if (lucideImportsMatch) {
  // Replace lucide-react import with window.LucideReact destructuring for browser compatibility
  const iconNames = lucideImportsMatch[1].trim();
  standalone += `// Lucide icons from window.LucideReact (defined in standalone.html)\n`;
  standalone += `const { ${iconNames} } = window.LucideReact || {};\n`;
}
standalone += '\n';

// Add comment separators and content
standalone += '// ============================================================\n';
standalone += '// TYPES AND INTERFACES\n';
standalone += '// ============================================================\n\n';
standalone += processedModules[0].replace(/^import[\s\S]*?;?\n\n?/gm, '') + '\n\n';

standalone += '// ============================================================\n';
standalone += '// UTILITY FUNCTIONS\n';
standalone += '// ============================================================\n\n';
standalone += processedModules[1].replace(/^import[\s\S]*?;?\n\n?/gm, '') + '\n\n';

standalone += '// ============================================================\n';
standalone += '// UI COMPONENTS\n';
standalone += '// ============================================================\n\n';
// Remove React imports from components since we already have them
let componentsCode = processedModules[2];
// Remove all React imports (handles: import React from 'react' and import React, { ... } from 'react')
componentsCode = componentsCode.replace(/^import\s+React(?:,\s*{[^}]*})?\s+from\s+['"]react['"];?\s*\n/gm, '');
// Remove standalone hook imports like: import { useState } from 'react'
componentsCode = componentsCode.replace(/^import\s+{[^}]+}\s+from\s+['"]react['"];?\s*\n/gm, '');
// Remove lucide-react imports
componentsCode = componentsCode.replace(/^import\s+{[^}]+}\s+from\s+['"]lucide-react['"];?\s*\n/gm, '');
// Remove type imports
componentsCode = componentsCode.replace(/^import\s+type\s+{[^}]+}\s+from\s+['"][^'"]+['"];?\s*\n/gm, '');
standalone += componentsCode + '\n\n';

standalone += '// ============================================================\n';
standalone += '// PARTICLE SYSTEM CORE\n';
standalone += '// ============================================================\n\n';
standalone += processedModules[3].replace(/^import[\s\S]*?;?\n\n?/gm, '') + '\n\n';

standalone += '// ============================================================\n';
standalone += '// EXPORT FUNCTIONALITY\n';
standalone += '// ============================================================\n\n';
standalone += processedModules[4].replace(/^import[\s\S]*?;?\n\n?/gm, '') + '\n\n';

standalone += '// ============================================================\n';
standalone += '// MAIN COMPONENT\n';
standalone += '// ============================================================\n\n';
// Remove header and imports from index
let mainCode = processedModules[5];
mainCode = mainCode.replace(/^\/\*\*[\s\S]*?\*\/\n\n/m, '');
mainCode = mainCode.replace(/^import[\s\S]*?;?\n/gm, '');
// Remove comment blocks at the start
mainCode = mainCode.replace(/^\/\/\s*Type imports[\s\S]*?\/\/\s*Export imports[\s\S]*?from\s+'\.\/export';\s*\n\n?/m, '');
standalone += mainCode.trim();

// Replace export default with global window assignment for browser compatibility
standalone = standalone.replace(
  /export default ParticleSpineExporter;?$/m,
  `// Make component globally available for standalone.html
if (typeof window !== 'undefined') {
  window.ParticleSpineExporter = ParticleSpineExporter;
}`
);

// Write output file
console.log(`💾 Writing ${outputFile}...\n`);
fs.writeFileSync(outputFile, standalone);

// Get file stats
const stats = fs.statSync(outputFile);
const lines = standalone.split('\n').length;
const size = (stats.size / 1024).toFixed(2);

console.log('✅ Build complete!\n');
console.log(`📄 Output: ${outputFile}`);
console.log(`📏 Lines: ${lines}`);
console.log(`💾 Size: ${size} KB`);
console.log('\n🎉 Standalone v97 is ready to use!\n');
