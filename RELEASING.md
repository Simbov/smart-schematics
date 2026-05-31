# Releasing

Releases are one command. The whole flow:

1. **While developing**, add user-facing notes under `## [Unreleased]` in
   [CHANGELOG.md](CHANGELOG.md) as you make changes.
2. **To ship**, from the `smart-schematics/` directory run one of:

   ```sh
   npm run release -- patch     # 0.0.3 -> 0.0.4
   npm run release -- minor     # 0.0.3 -> 0.1.0
   npm run release -- major     # 0.0.3 -> 1.0.0
   npm run release -- 1.2.3     # explicit version
   ```

That script (`scripts/release.mjs`) will:

- verify you're on a clean, up-to-date `main`;
- run the test suite (aborts on failure);
- stamp the `[Unreleased]` notes with the new version + today's date and open a
  fresh `[Unreleased]` block;
- bump the version in `package.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml`, and `Cargo.lock`;
- commit, tag `vX.Y.Z`, and push `main` + the tag.

Pushing the tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml),
which builds signed macOS + Windows installers, generates `latest.json`, and —
once **both** builds finish — auto-publishes the GitHub Release. The `[version]`
CHANGELOG section becomes the release notes and the in-app "update available"
text. Installed apps pick it up on next launch (or via **File → Check for
Updates…**).

## One-time setup (already done)

- Repo secret `TAURI_SIGNING_PRIVATE_KEY` holds the updater signing key.
- The signing key is backed up at `~/.tauri/smart-schematics-updater.key` — **do
  not lose it**; it's the only key that can sign updates for existing installs.
