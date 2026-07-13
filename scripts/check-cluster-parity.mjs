import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.resolve(root, '..', 'dashui');
const editorPath = path.join(root, 'editor.html');
const appRendererPath = path.join(appRoot, 'app', 'src', 'main', 'assets', 'cluster', 'cluster.html');
const vendoredRendererPath = path.join(root, 'assets', 'cluster-renderer-0.8.74.html');
const appGradlePath = path.join(appRoot, 'app', 'build.gradle.kts');
const manifestPath = path.join(root, 'assets', 'cluster-compatibility.json');

for (const required of [editorPath, appRendererPath, vendoredRendererPath, appGradlePath, manifestPath]) {
  if (!fs.existsSync(required)) {
    console.error(`Missing required parity input: ${required}`);
    process.exit(2);
  }
}

const editor = fs.readFileSync(editorPath, 'utf8');
const app = fs.readFileSync(appRendererPath, 'utf8');
const vendoredRenderer = fs.readFileSync(vendoredRendererPath, 'utf8');
const gradle = fs.readFileSync(appGradlePath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`Could not find ${name}`);
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]);
}

function compare(label, expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = [...expectedSet].filter((key) => !actualSet.has(key));
  const extra = [...actualSet].filter((key) => !expectedSet.has(key));
  if (missing.length || extra.length) {
    console.error(`${label} mismatch`);
    if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`  extra: ${extra.join(', ')}`);
    return false;
  }
  return true;
}

const appPositional = extractStringArray(app, 'POSITIONAL_KEYS_LIST');
const appBroadcast = extractStringArray(app, 'BROADCAST_KEYS_LIST');
const editorPositional = extractStringArray(editor, 'POSITIONAL_KEYS_LIST');
const editorBroadcast = extractStringArray(editor, 'BROADCAST_KEYS_LIST');

const versionName = gradle.match(/versionName\s*=\s*"([^"]+)"/)?.[1];
const versionCode = Number(gradle.match(/versionCode\s*=\s*(\d+)/)?.[1]);

let ok = true;
const normalizedAppRenderer = app.replaceAll('\r\n', '\n').replaceAll('\u2014', ',').trim();
const normalizedVendoredRenderer = vendoredRenderer
  .replaceAll('\r\n', '\n')
  .replace("const WS_URL = null;", "const WS_URL = 'ws://127.0.0.1:__PORT__/ws';")
  .replace('const INITIAL_FRAME = null;', 'const INITIAL_FRAME = __INITIAL_FRAME__;')
  .replace('  if (WS_URL) connectWs();', '  connectWs();')
  .replace('\n<link rel="stylesheet" href="cluster-fonts.css" />', '')
  .replace('\n<script src="cluster-preview-bridge.js"></script>', '')
  .trim();
if (normalizedAppRenderer !== normalizedVendoredRenderer) {
  console.error('Vendored website renderer differs from the DashUI 0.8.74 app renderer');
  ok = false;
}
ok = compare('app positional fields vs manifest', manifest.positionalFields, appPositional) && ok;
ok = compare('app broadcast fields vs manifest', manifest.broadcastFields, appBroadcast) && ok;
ok = compare('editor positional fields vs app', appPositional, editorPositional) && ok;
ok = compare('editor broadcast fields vs app', appBroadcast, editorBroadcast) && ok;

if (versionName !== manifest.targetApp.versionName || versionCode !== manifest.targetApp.versionCode) {
  console.error(`Target version mismatch: manifest=${manifest.targetApp.versionName}/${manifest.targetApp.versionCode}, app=${versionName}/${versionCode}`);
  ok = false;
}

if (!editor.includes('DASHUI_PHONE_GLOBAL_KEYS') || !editor.includes('validatePhoneConfig')) {
  console.error('Editor phone-export contract hooks are missing');
  ok = false;
}

if (!ok) process.exit(1);
console.log(`DashUI cluster parity OK for ${versionName} (${versionCode})`);
console.log(`${appPositional.length} positional fields, ${appBroadcast.length} broadcast fields, ${manifest.globalFields.length} global fields`);
