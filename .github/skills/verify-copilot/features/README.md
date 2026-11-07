# Copilot verification map

Use isolated Pi configuration and safe model metadata only. Read the [shared driver and evidence contract](../../verification/README.md).

- [Cached models](cached-models.md): fresh cached catalog, limits, and model selection. The baseline uses synthetic data and no authentication.
- [Fallback](fallback.md): missing, expired, malformed, or unusable catalogs retain a usable curated catalog.
- [Live models](live-models.md): authenticated account discovery, policy filtering, and real inference.

Record cache or live entry point separately. Cache projection is not proof of authentication or a usable remote endpoint. Do not capture real credential, cache, or model-store file contents. Creation-time runtime proof is blocked; all entries remain unverified until run.
