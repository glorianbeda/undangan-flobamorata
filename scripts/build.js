/**
 * Build script - Generates version hash for cache busting
 * Run with: npm run build
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const VERSION_FILE = path.join(PUBLIC_DIR, "version.json");

// Generate a hash based on the current timestamp and file contents
function generateVersionHash() {
  const files = ["style.css", "script.js", "index.html"];
  let content = Date.now().toString();

  files.forEach((file) => {
    const filePath = path.join(PUBLIC_DIR, file);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      content += fileContent;
    }
  });

  return crypto.createHash("md5").update(content).digest("hex").substring(0, 8);
}

// Main build process
function build() {
  console.log("🔨 Building...");

  const version = generateVersionHash();
  const buildInfo = {
    version: version,
    buildTime: new Date().toISOString(),
    timestamp: Date.now(),
  };

  // Write version file
  fs.writeFileSync(VERSION_FILE, JSON.stringify(buildInfo, null, 2));

  console.log(`✅ Build completed!`);
  console.log(`   Version: ${version}`);
  console.log(`   Build time: ${buildInfo.buildTime}`);
  console.log(`   Version file: ${VERSION_FILE}`);
}

build();
