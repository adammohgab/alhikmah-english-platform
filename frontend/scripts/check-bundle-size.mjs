import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distAssetsDir = path.resolve(__dirname, "../dist/assets");

// Budgets in kilobytes (gzipped)
const BUDGETS = {
  // Initial total JavaScript gzipped budget (before heavy 3D / audio)
  MAX_TOTAL_JS_GZIP_KB: 300,
  // Individual JS file budget
  MAX_SINGLE_JS_GZIP_KB: 250,
  // Total CSS gzipped budget
  MAX_TOTAL_CSS_GZIP_KB: 50,
};

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function checkBundleBudgets() {
  if (!fs.existsSync(distAssetsDir)) {
    console.error(`Dist assets directory not found at: ${distAssetsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(distAssetsDir);
  let totalJsGzip = 0;
  let totalCssGzip = 0;
  let hasViolation = false;

  console.log("\n--- Bundle Size & Budget Verification ---");

  for (const file of files) {
    const filePath = path.join(distAssetsDir, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const content = fs.readFileSync(filePath);
    const gzipped = zlib.gzipSync(content);
    const sizeGzipKb = gzipped.length / 1024;

    if (file.endsWith(".js")) {
      totalJsGzip += gzipped.length;
      console.log(
        `JS:  ${file} -> Raw: ${formatSize(stat.size)} | Gzip: ${formatSize(gzipped.length)}`,
      );
      if (sizeGzipKb > BUDGETS.MAX_SINGLE_JS_GZIP_KB) {
        console.error(`❌ EXCEEDS SINGLE JS BUDGET (${BUDGETS.MAX_SINGLE_JS_GZIP_KB} KB): ${file}`);
        hasViolation = true;
      }
    } else if (file.endsWith(".css")) {
      totalCssGzip += gzipped.length;
      console.log(
        `CSS: ${file} -> Raw: ${formatSize(stat.size)} | Gzip: ${formatSize(gzipped.length)}`,
      );
    }
  }

  const totalJsGzipKb = totalJsGzip / 1024;
  const totalCssGzipKb = totalCssGzip / 1024;

  console.log("-----------------------------------------");
  console.log(
    `Total JS (gzip):  ${totalJsGzipKb.toFixed(2)} KB / Budget: ${BUDGETS.MAX_TOTAL_JS_GZIP_KB} KB`,
  );
  console.log(
    `Total CSS (gzip): ${totalCssGzipKb.toFixed(2)} KB / Budget: ${BUDGETS.MAX_TOTAL_CSS_GZIP_KB} KB`,
  );

  if (totalJsGzipKb > BUDGETS.MAX_TOTAL_JS_GZIP_KB) {
    console.error(
      `❌ TOTAL JS EXCEEDS BUDGET: ${totalJsGzipKb.toFixed(2)} KB > ${BUDGETS.MAX_TOTAL_JS_GZIP_KB} KB`,
    );
    hasViolation = true;
  }

  if (totalCssGzipKb > BUDGETS.MAX_TOTAL_CSS_GZIP_KB) {
    console.error(
      `❌ TOTAL CSS EXCEEDS BUDGET: ${totalCssGzipKb.toFixed(2)} KB > ${BUDGETS.MAX_TOTAL_CSS_GZIP_KB} KB`,
    );
    hasViolation = true;
  }

  if (hasViolation) {
    process.exit(1);
  }

  console.log("✅ All bundle outputs are within performance budget thresholds!\n");
}

checkBundleBudgets();
