const fs = require('fs');
const path = require('path');

const filePath = path.join('node_modules', 'expo', 'src', 'async-require', 'hmrUtils.native.ts');
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('DevLoadingView')) {
    const fixedContent = content.replace(
      /const DevLoadingView = require\('react-native\/Libraries\/Utilities\/DevLoadingView'\)\.default;/,
      "let DevLoadingView = null;\ntry {\n  DevLoadingView = require('react-native/Libraries/Utilities/DevLoadingView').default;\n} catch (e) {\n  console.warn('DevLoadingView not available');\n}"
    );
    fs.writeFileSync(filePath, fixedContent);
    console.log('✓ Fixed hmrUtils.native.ts');
  } else {
    console.log('File already fixed or pattern not found');
  }
} else {
  console.log('File not found:', filePath);
}