# Pinning and the lockfile

Every consumer pins exactly what it runs. `toolkit.lock` (YAML) in a project, or the same entries in
the personal layer's data file, conforming to the `toolkit-lock` contract:

```yaml
lock_version: 1
entries:
  - name: harness             # exactly one harness; other L3 entries are skill libraries
    layer: L3
    kind: harness
    source: https://example.org/you/harness
    ref: v0.3.0               # the tag or branch the commit was resolved from
    commit: <40-hex full commit id>
    tree: <40-hex git tree id of the pinned content>
    version: 0.3.0
    autoUpdate: minor         # off | patch | minor | major
  - name: portable-skills     # a third-party skill library pinned beside the harness
    layer: L3
    kind: skill-library
    source: https://example.org/vendor/portable-skills
    ref: main
    commit: <40-hex>
    tree: <40-hex>
    version: 0.0.0+<short commit>   # untagged: semver build metadata carries the commit
    autoUpdate: "off"
  - name: vendor-skills
    layer: L4
    kind: domain-pack
    source: https://example.org/you/mirror-vendor-skills
    mirrored: https://example.org/vendor/skills
    ref: main
    commit: <40-hex>
    tree: <40-hex>
    version: 0.4.2
    autoUpdate: "off"         # always off for a mirrored third party
```

- **commit and tree.** The commit says what was reviewed; the tree id detects a rewritten tag or a
  force-pushed mirror. Get them with `git rev-parse <ref>^{commit}` and
  `git rev-parse <commit>:<path>` (or `<commit>^{tree}` without a `path`).
- **Mirror third parties** into a repository you control at a pinned commit; never consume them live.
  Their `autoUpdate` is `"off"`.
- **Bumps are pull requests.** A bump changes `ref`, `commit`, `tree` and `version` together and runs
  the eval suite (routing and scenarios) before a human merges it. A changelog line marked breaking
  needs a human read of what the consumer must change.
- **Drift fails CI.** If `harness lock --check` (or `node tools/lock.mjs`) is available, run it: the
  lock must match what is installed.
- **User scope follows the pin.** The personal layer installs skills from the same pinned commit and
  copies them where an engine does not read the shared skills directory.
