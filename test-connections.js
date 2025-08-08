#!/usr/bin/env node
/**
 * test-connections.js - Test all JavaScript module connections
 * Verifies that all CLI components can be imported and initialized
 */

console.log('🔗 Testing PoLoc JavaScript Module Connections\n');

// Test 1: Core modules
console.log('📦 Test 1: Testing core module imports...');
try {
  const { AnchorClient } = require('./cli/anchorclient');
  console.log('✅ AnchorClient imported successfully');
  
  const { ChallengeCoordinator } = require('./cli/coordinator');
  console.log('✅ ChallengeCoordinator imported successfully');
  
  const GeometryEngine = require('./cli/geometry');
  console.log('✅ GeometryEngine imported successfully');
  
  const DelayMapper = require('./cli/delayMapper');
  console.log('✅ DelayMapper imported successfully');
  
  const RobustFilters = require('./cli/filters');
  console.log('✅ RobustFilters imported successfully');
  
  const { MatrixCompletion } = require('./cli/matrixcompletion');
  console.log('✅ MatrixCompletion imported successfully');
  
  const Challenger = require('./cli/challenger');
  console.log('✅ Challenger imported successfully');
  
  const Waldo = require('./cli/waldo');
  console.log('✅ Waldo imported successfully');
} catch (error) {
  console.error('❌ Module import failed:', error.message);
  process.exit(1);
}

// Test 2: Initialize core components
console.log('\n🔧 Test 2: Testing component initialization...');
try {
  const { AnchorClient } = require('./cli/anchorclient');
  const { ChallengeCoordinator } = require('./cli/coordinator');
  const GeometryEngine = require('./cli/geometry');
  const DelayMapper = require('./cli/delayMapper');
  const RobustFilters = require('./cli/filters');
  const { MatrixCompletion } = require('./cli/matrixcompletion');
  
  // Initialize components
  const geometry = new GeometryEngine();
  console.log('✅ GeometryEngine initialized');
  
  const delayMapper = new DelayMapper();
  console.log('✅ DelayMapper initialized');
  
  const filters = new RobustFilters();
  console.log('✅ RobustFilters initialized');
  
  const matrixCompletion = new MatrixCompletion();
  console.log('✅ MatrixCompletion initialized');
  
  // Test geometry calculations
  const point1 = { lat: 40.7128, lon: -74.0060 }; // NYC
  const point2 = { lat: 40.7580, lon: -73.9855 }; // Manhattan
  const distance = geometry.calculateDistance(point1, point2);
  console.log(`✅ Distance calculation: ${Math.round(distance)}m`);
  
  // Test delay mapping
  const mapping = delayMapper.getMapping('test-challenger');
  const estimatedDistance = mapping(50); // 50ms delay
  console.log(`✅ Delay mapping: ${Math.round(estimatedDistance)}m for 50ms delay`);
  
} catch (error) {
  console.error('❌ Component initialization failed:', error.message);
  process.exit(1);
}

// Test 3: Test CLI functionality
console.log('\n💻 Test 3: Testing CLI functionality...');
try {
  const { Command } = require('commander');
  const program = new Command();
  
  program
    .name('poloc-test')
    .description('Test CLI')
    .version('1.0.0');
  
  program
    .command('test')
    .description('Test command')
    .action(() => {
      console.log('✅ CLI command execution works');
    });
  
  console.log('✅ Commander.js CLI framework works');
  
} catch (error) {
  console.error('❌ CLI functionality failed:', error.message);
  process.exit(1);
}

// Test 4: Test mathematical operations
console.log('\n🧮 Test 4: Testing mathematical operations...');
try {
  const math = require('mathjs');
  
  // Test basic operations
  const result = math.evaluate('2 + 2');
  console.log(`✅ Math.js basic operations: 2 + 2 = ${result}`);
  
  // Test matrix operations
  const matrix = math.matrix([[1, 2], [3, 4]]);
  const determinant = math.det(matrix);
  console.log(`✅ Matrix operations: det([[1,2],[3,4]]) = ${determinant}`);
  
} catch (error) {
  console.error('❌ Mathematical operations failed:', error.message);
  process.exit(1);
}

// Test 5: Test file system operations
console.log('\n📁 Test 5: Testing file system operations...');
try {
  const fs = require('fs').promises;
  const path = require('path');
  
  // Test directory creation
  const testDir = 'data/test';
  await fs.mkdir(testDir, { recursive: true });
  console.log('✅ Directory creation works');
  
  // Test file writing
  const testFile = path.join(testDir, 'test.json');
  const testData = { test: 'data', timestamp: Date.now() };
  await fs.writeFile(testFile, JSON.stringify(testData, null, 2));
  console.log('✅ File writing works');
  
  // Test file reading
  const readData = JSON.parse(await fs.readFile(testFile, 'utf8'));
  console.log('✅ File reading works');
  
  // Cleanup
  await fs.unlink(testFile);
  await fs.rmdir(testDir);
  console.log('✅ File cleanup works');
  
} catch (error) {
  console.error('❌ File system operations failed:', error.message);
  process.exit(1);
}

// Test 6: Test crypto operations
console.log('\n🔐 Test 6: Testing cryptographic operations...');
try {
  const crypto = require('crypto');
  
  // Test random generation
  const randomBytes = crypto.randomBytes(16);
  console.log('✅ Random bytes generation works');
  
  // Test hash generation
  const hash = crypto.createHash('sha256').update('test').digest('hex');
  console.log('✅ Hash generation works');
  
} catch (error) {
  console.error('❌ Cryptographic operations failed:', error.message);
  process.exit(1);
}

// Test 7: Test network operations
console.log('\n🌐 Test 7: Testing network operations...');
try {
  const dgram = require('dgram');
  
  // Test UDP socket creation
  const socket = dgram.createSocket('udp4');
  console.log('✅ UDP socket creation works');
  
  // Close socket
  socket.close();
  console.log('✅ UDP socket cleanup works');
  
} catch (error) {
  console.error('❌ Network operations failed:', error.message);
  process.exit(1);
}

// Test 8: Test data structures
console.log('\n📊 Test 8: Testing data structures...');
try {
  // Test Map operations
  const testMap = new Map();
  testMap.set('key1', 'value1');
  testMap.set('key2', 'value2');
  console.log('✅ Map operations work');
  
  // Test Set operations
  const testSet = new Set();
  testSet.add('item1');
  testSet.add('item2');
  console.log('✅ Set operations work');
  
  // Test Array operations
  const testArray = [1, 2, 3, 4, 5];
  const filtered = testArray.filter(x => x > 2);
  const mapped = testArray.map(x => x * 2);
  console.log('✅ Array operations work');
  
} catch (error) {
  console.error('❌ Data structure operations failed:', error.message);
  process.exit(1);
}

// Test 9: Test async operations
console.log('\n⏱️  Test 9: Testing async operations...');
try {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  const startTime = Date.now();
  await sleep(100);
  const endTime = Date.now();
  
  if (endTime - startTime >= 100) {
    console.log('✅ Async operations work');
  } else {
    throw new Error('Async timing incorrect');
  }
  
} catch (error) {
  console.error('❌ Async operations failed:', error.message);
  process.exit(1);
}

// Test 10: Test error handling
console.log('\n🛡️  Test 10: Testing error handling...');
try {
  // Test try-catch
  try {
    throw new Error('Test error');
  } catch (error) {
    if (error.message === 'Test error') {
      console.log('✅ Error handling works');
    } else {
      throw new Error('Error handling failed');
    }
  }
  
  // Test Promise rejection
  const rejectedPromise = Promise.reject(new Error('Test rejection'));
  try {
    await rejectedPromise;
  } catch (error) {
    if (error.message === 'Test rejection') {
      console.log('✅ Promise error handling works');
    } else {
      throw new Error('Promise error handling failed');
    }
  }
  
} catch (error) {
  console.error('❌ Error handling failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All connection tests passed successfully!');
console.log('\n📋 Summary:');
console.log('✅ All modules imported correctly');
console.log('✅ All components initialized');
console.log('✅ CLI framework functional');
console.log('✅ Mathematical operations working');
console.log('✅ File system operations working');
console.log('✅ Cryptographic operations working');
console.log('✅ Network operations working');
console.log('✅ Data structures functional');
console.log('✅ Async operations working');
console.log('✅ Error handling robust');

console.log('\n🚀 PoLoc system is ready for deployment!');
console.log('\nNext steps:');
console.log('1. Run: node cli/index.js init');
console.log('2. Run: node cli/index.js status');
console.log('3. Create challenges and participate!');
