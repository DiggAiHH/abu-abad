#!/usr/bin/env node
/**
 * UI Component Test Matrix Generator
 * 
 * PURPOSE: Scannt alle UI-Komponenten und erstellt strukturierte Prüfliste
 * PREVENTS: Fehler A (Keine strukturierte Test-Coverage)
 * 
 * ALGORITHM:
 * 1. Parse TSX/JSX files
 * 2. Extract interactive elements (button, input, form, a, etc.)
 * 3. Generate Test-ID recommendations
 * 4. Create Checklist with Test-Cases
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import globPkg from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DEFENSIVE: Config mit Defaults
const config = {
  srcPath: path.join(__dirname, '../apps/frontend/src'),
  outputPath: path.join(__dirname, '../TEST_CHECKLIST.md'),
  interactiveElements: [
    'button', 'input', 'select', 'textarea', 
    'a', 'form', 'checkbox', 'radio'
  ]
};

/**
 * Extract Interactive Elements from TSX File
 * PREVENTS: Missing Test Coverage (findet alle klickbaren Elemente)
 */
function extractElements(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const elements = [];
  
  // REGEX: Find JSX Elements
  const elementRegex = /<(button|input|select|textarea|form|a)\s+([^>]*?)>/gi;
  let match;
  
  while ((match = elementRegex.exec(content)) !== null) {
    const tag = match[1];
    const attributes = match[2];
    
    // Extract Attributes
    const typeMatch = attributes.match(/type=["']([^"']+)["']/);
    const testIdMatch = attributes.match(/data-testid=["']([^"']+)["']/);
    const onClickMatch = attributes.match(/onClick=/);
    const onSubmitMatch = attributes.match(/onSubmit=/);
    
    const element = {
      tag,
      type: typeMatch ? typeMatch[1] : null,
      testId: testIdMatch ? testIdMatch[1] : null,
      hasAction: !!(onClickMatch || onSubmitMatch),
      file: path.relative(config.srcPath, filePath),
      line: content.substring(0, match.index).split('\n').length
    };
    
    elements.push(element);
  }
  
  return elements;
}

/**
 * Generate Test-ID Recommendation
 * DEFENSIVE: Consistent naming convention
 */
function generateTestId(element, pageContext) {
  if (element.testId) return element.testId;
  
  const page = pageContext.replace(/\.tsx?$/, '').toLowerCase();
  const action = element.type || element.tag;
  
  return `${page}-${action}`.replace(/[^a-z0-9-]/g, '-');
}

/**
 * Generate Test Case Recommendations
 * PREVENTS: Incomplete Test Coverage
 */
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
        description: 'Verify button disabled state when appropriate',
        priority: 'MEDIUM'
      });
      cases.push({
        id: 'LOADING',
        description: 'Verify loading state during async action',
        priority: element.hasAction ? 'HIGH' : 'LOW'
      });
      break;
      
    case 'input':
      cases.push({
        id: 'FILL',
        description: `Fill ${element.type || 'text'} input with valid data`,
        priority: 'HIGH'
      });
      cases.push({
        id: 'VALIDATE',
        description: 'Test validation (empty, invalid format)',
        priority: 'HIGH'
      });
      cases.push({
        id: 'EDGE',
        description: 'Edge cases: Unicode, special chars, max length',
        priority: 'MEDIUM'
      });
      break;
      
    case 'form':
      cases.push({
        id: 'SUBMIT',
        description: 'Submit form with valid data',
        priority: 'HIGH'
      });
      cases.push({
        id: 'VALIDATION',
        description: 'Test all field validations',
        priority: 'HIGH'
      });
      cases.push({
        id: 'ERROR',
        description: 'Handle server errors gracefully',
        priority: 'HIGH'
      });
      break;
      
    case 'a':
      cases.push({
        id: 'NAVIGATE',
        description: 'Click link and verify navigation',
        priority: 'MEDIUM'
      });
      break;
      
    case 'select':
      cases.push({
        id: 'SELECT',
        description: 'Select each option and verify',
        priority: 'MEDIUM'
      });
      break;
  }
  
  return cases;
}

/**
 * Scan All TSX Files
 */
async function scanProject() {
  const pattern = path.join(config.srcPath, '**/*.tsx');
  const files = globPkg.sync(pattern, { nodir: true });
  const allElements = [];
  
  if (!Array.isArray(files)) {
    throw new Error('glob did not return array');
  }
  files.forEach(filePath => {
    const elements = extractElements(filePath);
    const relativePath = path.relative(config.srcPath, filePath);
    
    elements.forEach(el => {
      el.recommendedTestId = generateTestId(el, relativePath);
      el.testCases = generateTestCases(el);
      allElements.push(el);
    });
  });
  
  return allElements;
}

/**
 * Generate Markdown Checklist
 * DEFENSIVE: Strukturiert mit Checkboxen für manuelle Abarbeitung
 */
function generateChecklist(elements) {
  let markdown = `# 🧪 Abu-Abbad Test Coverage Checklist

**Generated:** ${new Date().toISOString()}
**Total Interactive Elements:** ${elements.length}
**Coverage Status:** [ ] 0% | [ ] 25% | [ ] 50% | [ ] 75% | [ ] 100%

---

## 📋 Test Coverage Matrix

`;

  // Group by Page
  const byPage = {};
  elements.forEach(el => {
    const page = el.file.split('/')[0] || 'components';
    if (!byPage[page]) byPage[page] = [];
    byPage[page].push(el);
  });

  Object.keys(byPage).sort().forEach(page => {
    markdown += `\n### 📄 ${page}\n\n`;
    
    byPage[page].forEach((el, idx) => {
      markdown += `#### Element ${idx + 1}: \`${el.tag}\` ${el.type ? `(type="${el.type}")` : ''}\n\n`;
      markdown += `- **File:** \`${el.file}:${el.line}\`\n`;
      markdown += `- **Test-ID:** ${el.testId ? `✅ \`${el.testId}\`` : `⚠️ Missing - Recommended: \`${el.recommendedTestId}\``}\n`;
      markdown += `- **Has Action:** ${el.hasAction ? '✅' : '❌'}\n\n`;
      
      markdown += `**Test Cases:**\n\n`;
      el.testCases.forEach(tc => {
        markdown += `- [ ] **${tc.id}** (Priority: ${tc.priority}): ${tc.description}\n`;
      });
      
      markdown += `\n**Implementation Status:**\n`;
      markdown += `- [ ] Test-ID added to component\n`;
      markdown += `- [ ] Page Object created\n`;
      markdown += `- [ ] E2E Test implemented\n`;
      markdown += `- [ ] Test passed locally\n`;
      markdown += `- [ ] Test passed in CI/CD\n\n`;
      markdown += `---\n\n`;
    });
  });

  // Summary Statistics
  const withTestId = elements.filter(el => el.testId).length;
  const withAction = elements.filter(el => el.hasAction).length;
  const totalTestCases = elements.reduce((sum, el) => sum + el.testCases.length, 0);

  markdown += `\n## 📊 Statistics\n\n`;
  markdown += `| Metric | Count | Coverage |\n`;
  markdown += `|--------|-------|----------|\n`;
  markdown += `| Total Elements | ${elements.length} | - |\n`;
  markdown += `| With Test-ID | ${withTestId} | ${Math.round(withTestId/elements.length*100)}% |\n`;
  markdown += `| With Actions | ${withAction} | - |\n`;
  markdown += `| Total Test Cases | ${totalTestCases} | - |\n\n`;

  markdown += `\n## 🎯 Priority Matrix\n\n`;
  const priorities = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  elements.forEach(el => {
    el.testCases.forEach(tc => {
      priorities[tc.priority]++;
    });
  });

  markdown += `- 🔴 **HIGH Priority:** ${priorities.HIGH} test cases\n`;
  markdown += `- 🟡 **MEDIUM Priority:** ${priorities.MEDIUM} test cases\n`;
  markdown += `- 🟢 **LOW Priority:** ${priorities.LOW} test cases\n\n`;

  markdown += `\n## 📝 Missing Test-IDs\n\n`;
  const missing = elements.filter(el => !el.testId);
  if (missing.length > 0) {
    markdown += `The following elements need \`data-testid\` attributes:\n\n`;
    missing.forEach(el => {
      markdown += `- \`${el.file}:${el.line}\` - Add: \`data-testid="${el.recommendedTestId}"\`\n`;
    });
  } else {
    markdown += `✅ All interactive elements have Test-IDs!\n`;
  }

  return markdown;
}

/**
 * Main Execution
 */
async function main() {
  console.log('🔍 Scanning Frontend Components...');
  const elements = await scanProject();
  
  console.log(`✅ Found ${elements.length} interactive elements`);
  
  const checklist = generateChecklist(elements);
  fs.writeFileSync(config.outputPath, checklist);
  
  console.log(`✅ Checklist generated: ${config.outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Total Elements: ${elements.length}`);
  console.log(`   - With Test-ID: ${elements.filter(e => e.testId).length}`);
  console.log(`   - Total Test Cases: ${elements.reduce((s, e) => s + e.testCases.length, 0)}`);
}

// DEFENSIVE: Error Handling
try {
  await main();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
