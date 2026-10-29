import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { frontendRoot } from "./lib/legal-integrity.mjs";
import { checkCrossRepoIntegrity } from "./lib/legal-cross-repo.mjs";
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--backend-root"))
  throw new Error(
    "Use no arguments or --backend-root <backend-checkout-directory>",
  );
const backendRoot = args.length
  ? pathToFileURL(resolve(args[1]) + "/")
  : new URL("../pet-platform-backend/", frontendRoot);
const result = await checkCrossRepoIntegrity(frontendRoot, backendRoot);
console.log(
  `Backend/frontend legal content, registry and SHA-256 contract match; activation=${result.activation}. Publication approval remains separate.`,
);
