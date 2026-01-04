#!/usr/bin/env node
/**
 * Simplified Test Checklist Generator
 * DEFENSIVE: No external dependencies (glob), pure Node.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  srcPath: path.join(__dirname, '../apps/frontend/src'),
  outputPath: path.join(__dirname, '../TEST_CHECKLIST.md')
};

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function extractElements(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const elements = [];
  
  const elementRegex = /<(button|input|select|textarea|form|a)\s+([^>]*?)>/gi;
  let match;
  
  while ((match = elementRegex.exec(content)) !== null) {
    const tag = match[1];
    const attributes = match[2];
    
    const typeMatch = attributes.match(/type=["']([^"']+)["']/);
    const testIdMatch = attributes.match(/data-testid=["']([^"']+)["']/);
    const onClickMatch = attributes.match(/onClick=/);
    const onSubmitMatch = attributes.match(/onSubmit=/);
    
    elements.push({
      tag,
      type: typeMatch ? typeMatch[1] : null,
      testId: testIdMatch ? testIdMatch[1] : null,
      hasAction: !!(onClickMatch || onSubmitMatch),
      file: path.relative(config.srcPath, filePath),
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  return elements;
}

function generateTestCases(element) {
  const cases = [];
  
  switch (element.tag) {
    case 'button':
      cases.push({
        id: 'CLICK',
        description: 'Click button and verify action',
        priority: element.hasAction ? 'HIGH' : 'MEDIUM'
      });
      cases.push({
        id: 'DISABLED',
        description: 'Verify disabled state',
        priority: 'MEDIUM'
      });
      break;
      
    case 'input':
      cases.push({
        id: 'FILL',
        description: `Fill ${element.type || 'text'} input`,
        priority: 'HIGH'
      });
      cases.push({
        id: 'VALIDATE',
        description: 'Test validation',
        priority: 'HIGH'
      });
      break;
      
    case 'form':
      cases.push({
        id: 'SUBMIT',
        description: 'Submit form',
        priority: 'HIGH'
      });
      break;
      
    case 'a':
      cases.push({
        id: 'NAVIGATE',
        description: 'Click link',
        priority: 'MEDIUM'
      });
      break;
  }
  
  return cases;
}

function generateChecklist(elements) {
  let md = `# 🧪 Abu-Abbad Test Coverage Checklist\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Total Elements:** ${elements.length}\n\n`;
  md += `---\n\n`;

  const byPage = {};
  elements.forEach(el => {
    const page = el.file.split('/')[0] || 'components';
    if (!byPage[page]) byPage[page] = [];
    byPage[page].push(el);
  });

  Object.keys(byPage).sort().forEach(page => {
    md += `\n## 📄 ${page}\n\n`;
    
    byPage[page].forEach((el, idx) => {
      md += `### Element ${idx + 1}: \`<${el.tag}>\` ${el.type ? `(type="${el.type}")` : ''}\n\n`;
      md += `- **File:** \`${el.file}:${el.line}\`\n`;
      md += `- **Test-ID:** ${el.testId ? `✅ \`${el.testId}\`` : '⚠️ Missing'}\n`;
      md += `- **Has Action:** ${el.hasAction ? '✅' : '❌'}\n\n`;
      
      md += `**Test Cases:**\n\n`;
      el.testCases.forEach(tc => {
        md += `- [ ] **${tc.id}** (${tc.priority}): ${tc.description}\n`;
      });
      
      md += `\n**Status:**\n`;
      md += `- [ ] Test-ID added\n`;
      md += `- [ ] E2E Test created\n`;
      md += `- [ ] Test passed\n\n`;
      md += `---\n\n`;
    });
  });

  const withTestId = elements.filter(el => el.testId).length;
  const totalCases = elements.reduce((sum, el) => sum + el.testCases.length, 0);

  md += `\n## 📊 Statistics\n\n`;
  md += `- Total Elements: ${elements.length}\n`;
  md += `- With Test-ID: ${withTestId} (${Math.round(withTestId/elements.length*100)}%)\n`;
  md += `- Total Test Cases: ${totalCases}\n`;

  return md;
}

try {
  console.log('🔍 Scanning Components...');
  const files = walkDir(config.srcPath);
  console.log(`✅ Found ${files.length} TSX files`);
  
  const allElements = [];
  files.forEach(file => {
    const elements = extractElements(file);
    elements.forEach(el => {
      el.testCases = generateTestCases(el);
      allElements.push(el);
    });
  });
  
  console.log(`✅ Found ${allElements.length} interactive elements`);
  
  const checklist = generateChecklist(allElements);
  fs.writeFileSync(config.outputPath, checklist);
  
  console.log(`✅ Checklist: ${config.outputPath}`);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
