// Import the TypeScript handler directly so Vercel bundles its source and
// dependencies into this function instead of resolving a generated CJS file
// from the deployment filesystem.
import handler from "../server/handler";

export default handler;
