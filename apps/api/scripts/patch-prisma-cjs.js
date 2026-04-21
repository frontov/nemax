const fs = require("node:fs");
const path = require("node:path");

const clientPath = path.join(__dirname, "..", "src", "generated", "prisma", "client.ts");

if (!fs.existsSync(clientPath)) {
  process.exit(0);
}

const source = fs.readFileSync(clientPath, "utf8");
const patched = source
  .replace(/\nimport \{ fileURLToPath \} from 'node:url'/g, "")
  .replace(/\nglobalThis\['__dirname'\] = path\.dirname\(fileURLToPath\(import\.meta\.url\)\)/g, "\nglobalThis['__dirname'] = __dirname");

if (patched !== source) {
  fs.writeFileSync(clientPath, patched);
  console.log("Patched Prisma client for CommonJS runtime.");
}
