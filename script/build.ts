import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// Vercel sets this env var automatically during its builds
const isVercel = process.env.VERCEL === "1";

// Packages to bundle into the Replit server build to reduce syscalls
// and improve cold start times on the always-on Replit server.
const replitAllowlist = [
  "connect-pg-simple",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-session",
  "memorystore",
  "nanoid",
  "passport",
  "passport-local",
  "pg",
  "ws",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];

  const baseBuildConfig = {
    platform: "node" as const,
    bundle: true,
    format: "cjs" as const,
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    logLevel: "info" as const,
  };

  if (isVercel) {
    // Vercel compiles api/index.ts and its TypeScript imports as a native
    // Node.js function; no generated CJS sibling is required at runtime.
    console.log("Vercel will compile the api/index.ts function directly.");
  } else {
    // Replit build: bundle allowlisted deps into a single file for faster cold starts
    console.log("building replit server...");
    const replitExternals = allDeps.filter((dep) => !replitAllowlist.includes(dep));
    await esbuild({
      ...baseBuildConfig,
      entryPoints: ["server/index.ts"],
      outfile: "dist/index.cjs",
      external: replitExternals,
    });

  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
