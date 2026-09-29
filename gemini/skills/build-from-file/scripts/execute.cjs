#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let activeChildProcess = null;

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n[${new Date().toISOString()}] Executing: ${command} ${args.join(' ')}\n`);
    
    activeChildProcess = spawn(command, args, { stdio: 'inherit', ...options });
    
    activeChildProcess.on('close', (code) => {
      activeChildProcess = null;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command '${command} ${args.join(' ')}' failed with exit code ${code}`));
      }
    });
    
    activeChildProcess.on('error', (err) => {
      activeChildProcess = null;
      reject(new Error(`Spawn error for command '${command}': ${err.message}`));
    });
  });
}

// Handle process signals for graceful termination
function handleSignal(signal) {
  process.stdout.write(`\n[${new Date().toISOString()}] Received ${signal}, shutting down gracefully...\n`);
  if (activeChildProcess) {
    activeChildProcess.kill(signal);
  }
  process.exit(1);
}

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

async function executeScript(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const dir = path.dirname(filePath);
  const file = path.basename(filePath);

  switch (ext) {
    case '.sh':
      await runCommand('bash', [file], { cwd: dir });
      break;
    case '.py':
      // Try python3 first, then python
      try {
        await runCommand('python3', [file], { cwd: dir });
      } catch (e) {
        await runCommand('python', [file], { cwd: dir });
      }
      break;
    case '.js':
    case '.cjs':
    case '.mjs':
      await runCommand('node', [file], { cwd: dir });
      break;
    case '.rb':
      await runCommand('ruby', [file], { cwd: dir });
      break;
    case '.pl':
      await runCommand('perl', [file], { cwd: dir });
      break;
    case '.ts':
      await runCommand('npx', ['ts-node', file], { cwd: dir });
      break;
    default:
      // Check if file is executable (only on Unix-like systems)
      try {
        const stats = fs.statSync(filePath);
        const isExecutable = !!(stats.mode & parseInt('0001', 8));
        if (isExecutable) {
          await runCommand(`./${file}`, [], { cwd: dir });
        } else {
          throw new Error(`Unsupported script extension '${ext}' and file is not executable.`);
        }
      } catch (err) {
        throw new Error(`Unsupported script type or file is not executable: ${err.message}`);
      }
  }
}

async function executeBuildConfig(filePath) {
  const fileName = path.basename(filePath);
  const dir = path.dirname(filePath);

  switch (fileName) {
    case 'Makefile':
      await runCommand('make', [], { cwd: dir });
      break;
    case 'package.json':
      const pkgContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (pkgContent.scripts && pkgContent.scripts.build) {
        await runCommand('npm', ['run', 'build'], { cwd: dir });
      } else if (pkgContent.scripts && pkgContent.scripts.start) {
        await runCommand('npm', ['start'], { cwd: dir });
      } else if (pkgContent.scripts) {
        const scriptNames = Object.keys(pkgContent.scripts);
        process.stdout.write(`Success: Found package.json but no 'build' or 'start' scripts. Available scripts: ${scriptNames.join(', ')}\n`);
      } else {
        throw new Error(`No scripts found in package.json.`);
      }
      break;
    case 'Cargo.toml':
      await runCommand('cargo', ['build'], { cwd: dir });
      break;
    case 'go.mod':
      await runCommand('go', ['build'], { cwd: dir });
      break;
    case 'Dockerfile':
      await runCommand('docker', ['build', '-t', 'app-image', '.'], { cwd: dir });
      break;
    case 'CMakeLists.txt':
      await runCommand('cmake', ['.'], { cwd: dir });
      await runCommand('make', [], { cwd: dir });
      break;
    default:
      throw new Error(`Unsupported build configuration file: ${fileName}`);
  }
}

async function executeInstructionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Check for bash/sh/shell/cmd/powershell code blocks in markdown
  const codeBlockRegex = /```(?:bash|sh|shell|cmd|powershell)\s*([\s\S]*?)```/g;
  let match;
  const commands = [];
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const block = match[1].trim();
    if (block) {
      commands.push(...block.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')));
    }
  }

  if (commands.length > 0) {
    process.stdout.write(`Found ${commands.length} commands to execute in instruction file.\n`);
    const dir = path.dirname(filePath);
    for (const cmdLine of commands) {
      await runCommand('bash', ['-c', cmdLine], { cwd: dir });
    }
  } else {
    // No code blocks, treat as plain text listing of commands (one per line) if they look like commands
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    process.stdout.write(`No clear executable shell blocks found in the instruction file.\n`);
    process.stdout.write(`--- CONTENT START ---\n${content}\n--- CONTENT END ---\n`);
    process.stdout.write(`Please read and execute the instructions above.\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write("Failure: Missing file path argument. Usage: execute.cjs <file-path>\n");
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`Failure: File does not exist at path: ${filePath}\n`);
    process.exit(1);
  }

  try {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // 1. Check for specific build configuration filenames
    const buildConfigs = ['Makefile', 'package.json', 'Cargo.toml', 'go.mod', 'Dockerfile', 'CMakeLists.txt'];
    if (buildConfigs.includes(fileName)) {
      await executeBuildConfig(filePath);
      process.stdout.write(`\n[${new Date().toISOString()}] Success: Build configuration executed successfully.\n`);
      return;
    }

    // 2. Check for Instruction Files (.md, .txt)
    if (ext === '.md' || ext === '.txt') {
      await executeInstructionFile(filePath);
      process.stdout.write(`\n[${new Date().toISOString()}] Success: Instruction file execution completed.\n`);
      return;
    }

    // 3. Otherwise treat as a script
    await executeScript(filePath);
    process.stdout.write(`\n[${new Date().toISOString()}] Success: Script executed successfully.\n`);
  } catch (err) {
    process.stderr.write(`\n[${new Date().toISOString()}] Failure: ${err.message}\n`);
    if (err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write(`\n[${new Date().toISOString()}] Unhandled Fatal Error: ${err.message}\n`);
  process.exit(1);
});
