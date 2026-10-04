# Contributing

Use the exact toolchain and clean-install commands in the README. Keep source changes in the package that owns the behavior. Do not edit generated `dist/` files.

1. Propose contract changes in OpenSpec before implementing a new capability.
2. Declare the manifest, JSON Schemas, SDK behavior, theme tokens, and required capabilities together.
3. Keep ODC/O11 source shared. A target override needs a documented capability difference and a test.
4. Add behavior and failure tests with the implementation, including instance isolation and cleanup.
5. Run `npm run format`, then `npm run verify`.
6. Inspect visual changes before accepting new reference images. Do not update baselines merely to silence a regression.

The policy file is versioned. Changes to budgets, browsers, accessibility, visual tolerances, or release evidence need review. Unsupported JSON Schema keywords fail validation; extend the validator and conformance tests before using them.

Runtime data is serialized and untrusted. Render host strings as text, keep application authorization/business logic in OutSystems, and declare external dependencies before use. Managed resources must be released through the SDK context even when a component's own cleanup fails.

The local release catalog is append-only. A released version cannot receive new bytes. Changes to existing properties, commands, events, schemas, theme tokens, targets, or behavior guarantees need compatibility review and the appropriate semantic version increment.

Real OutSystems verification records the environment, asset, platform version, application lane, suite version, exact file hashes, and smoke-test results. Keep credentials and session tokens outside this repository. No local browser test can stand in for that evidence.
