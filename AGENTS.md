# Component platform

This repository builds browser components and local OutSystems adapter artifacts.
Start with [authoring](docs/authoring.md), [release gates](docs/releasing.md), and
the durable contracts in [openspec/specs](openspec/specs). A new component belongs
under `components/<id>`; use `npm run scaffold -- <id>` and generated bindings.
Fixtures are explicit opt-ins under `tests/fixtures`, never production releases.

Use the repository skills for component authoring, certification, and native
integration. Keep implementation changes within the requested component unless
the requested platform change requires shared code. Format and regenerate types
before running selected validation. Preserve failures and reviewed baselines;
do not lower thresholds or invent evidence to make qualification pass.

Registered payloads are immutable. New authoring/profile/adapter format changes
require a new component version. Local verification proves only its recorded
browser targets. Tenant work follows [the integration protocol](docs/native-integration.md)
and requires a separate user request. Never save OAuth or Mentor session secrets.
