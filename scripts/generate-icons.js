const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  console.log('🎨 Generating app icons from icon.png...');
  
  const inputPath = path.join(__dirname, '../public/icon.png');
  const publicDir = path.join(__dirname, '../public');
  
  if (!fs.existsSync(inputPath)) {
    console.error('❌ Error: public/icon.png not found!');
    console.log('Please add your logo as public/icon.png first.');
    process.exit(1);
  }
  
  try {
    // Generate .ico file (Windows)
    console.log('📦 Generating icon.ico for Windows...');
    await sharp(inputPath)
      .resize(256, 256)
      .toFile(path.join(publicDir, 'icon-256.png'));
    
    // For .ico, we need multiple sizes
    const sizes = [16, 32, 48, 64, 128, 256];
    const icoImages = [];
    
    for (const size of sizes) {
      const buffer = await sharp(inputPath)
        .resize(size, size)
        .png()
        .toBuffer();
      icoImages.push(buffer);
    }
    
    console.log('✅ icon.ico generated (use online converter for final .ico)');
    console.log('   Visit: https://convertio.co/png-ico/ to convert icon-256.png');
    
    // Generate .icns file (macOS) - requires iconutil on Mac
    if (process.platform === 'darwin') {
      console.log('📦 Generating icon.icns for macOS...');
      const iconsetDir = path.join(publicDir, 'icon.iconset');
      
      if (!fs.existsSync(iconsetDir)) {
        fs.mkdirSync(iconsetDir);
      }
      
      const macSizes = [
        { size: 16, name: 'icon_16x16.png' },
        { size: 32, name: 'icon_16x16@2x.png' },
        { size: 32, name: 'icon_32x32.png' },
        { size: 64, name: 'icon_32x32@2x.png' },
        { size: 128, name: 'icon_128x128.png' },
        { size: 256, name: 'icon_128x128@2x.png' },
        { size: 256, name: 'icon_256x256.png' },
        { size: 512, name: 'icon_256x256@2x.png' },
        { size: 512, name: 'icon_512x512.png' },
        { size: 1024, name: 'icon_512x512@2x.png' },
      ];
      
      for (const { size, name } of macSizes) {
        await sharp(inputPath)
          .resize(size, size)
          .png()
          .toFile(path.join(iconsetDir, name));
      }
      
      // Convert iconset to icns using iconutil
      const { execSync } = require('child_process');
      try {
        execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(publicDir, 'icon.icns')}"`);
        console.log('✅ icon.icns generated for macOS');
        
        // Clean up iconset directory
        fs.rmSync(iconsetDir, { recursive: true });
      } catch (error) {
        console.log('⚠️  iconutil not available. icon.icns not generated.');
        console.log('   Run this script on macOS to generate .icns file.');
      }
    } else {
      console.log('ℹ️  Skipping .icns generation (requires macOS)');
      console.log('   Run this script on macOS to generate icon.icns');
    }
    
    console.log('\n✅ Icon generation complete!');
    console.log('\nGenerated files:');
    console.log('  ✓ public/icon.png (source)');
    console.log('  ✓ public/icon-256.png (for .ico conversion)');
    if (process.platform === 'darwin') {
      console.log('  ✓ public/icon.icns (macOS)');
    }
    console.log('\nNext steps:');
    console.log('  1. Convert icon-256.png to icon.ico at: https://convertio.co/png-ico/');
    console.log('  2. Replace public/icon.ico with the converted file');
    console.log('  3. Run: npm run build');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
