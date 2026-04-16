const fs = require('fs');
const path = require('path');

// Color mappings: old -> new
const colorMap = {
  // Cyan to Orange (Primary)
  'cyan-400': 'orange-500',
  'cyan-500': 'orange-600',
  'cyan-600': 'orange-700',
  'cyan-300': 'orange-400',
  
  // Keep purple as secondary
  // purple stays as is
  
  // Blue to Purple (for gradients)
  'blue-500': 'purple-500',
  'blue-600': 'purple-600',
  
  // Slate backgrounds stay but darker
  'slate-900': 'slate-950',
  'slate-800': 'slate-900',
  'slate-700': 'slate-800',
};

function updateColors(content) {
  let updated = content;
  
  // Replace color classes
  for (const [oldColor, newColor] of Object.entries(colorMap)) {
    // Match patterns like: text-cyan-400, bg-cyan-500, border-cyan-400, etc.
    const regex = new RegExp(`(text-|bg-|border-|from-|to-|via-|shadow-|ring-|divide-|decoration-|placeholder-|outline-|fill-|stroke-)${oldColor}`, 'g');
    updated = updated.replace(regex, `$1${newColor}`);
  }
  
  // Replace rgba colors in boxShadow and other inline styles
  updated = updated.replace(/rgba\(6,\s*182,\s*212/g, 'rgba(217, 119, 6'); // cyan to orange
  updated = updated.replace(/rgba\(6,182,212/g, 'rgba(217,119,6');
  
  return updated;
}

function processFile(filePath) {
  console.log(`Processing: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = updateColors(content);
  
  if (content !== updated) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
    return true;
  }
  return false;
}

function main() {
  console.log('🎨 Updating theme colors...\n');
  
  const filesToUpdate = [
    'app/page.tsx',
    'components/FileUpload.tsx',
    'components/SettingsModal.tsx',
    'components/ErrorBoundary.tsx',
    'components/VisualizationView.tsx',
  ];
  
  let updatedCount = 0;
  
  for (const file of filesToUpdate) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      if (processFile(filePath)) {
        updatedCount++;
      }
    } else {
      console.log(`⚠️  File not found: ${file}`);
    }
  }
  
  console.log(`\n✅ Theme update complete! Updated ${updatedCount} files.`);
  console.log('\nColor changes:');
  console.log('  • Cyan → Orange (Primary)');
  console.log('  • Blue → Purple (Gradients)');
  console.log('  • Darker backgrounds');
}

main();
