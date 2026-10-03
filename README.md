# dsh-plugin-skill-manager

English | [中文](README.zh.md)

Skill management for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web client: a **Skills** page in Settings that lists every skill the deployment can load from its user-level roots, shows the source and precedence that decide a duplicated name, switches one skill off, opens `SKILL.md` for editing, and installs skills from uploaded documents or a GitHub repository link.

The page is built from the client's own design system — `@deepseek-ai/dsh-client-ui-primitives` and the shared `--dsw-*` tokens — and registers into the official `settings.section` slot, so it sits in the Settings dialog exactly like a shipped section.

## Install

```sh
# from npm (once published)
dsh plugin --profile web add dsh-plugin-skill-manager@latest

# from this repository
git clone https://github.com/majinggui/dsh-plugin-skill-manager
cd dsh-plugin-skill-manager && pnpm install && pnpm build
dsh plugin --profile web add link:$(pwd)
```

Then restart the profile (`dsh web`, `pnpm run dev:web`, or the desktop app) and open **Settings → Skills**.

The package declares one bundle patch (`cordis.patch.yml`) that inserts the single plugin row mounting both halves: the host half owns one authenticated JSON route, and the browser half registers the Settings page.

## What the page offers

| Action | Effect |
|---|---|
| Catalog | Every `SKILL.md` and flat `.md` document under the scanned roots, with its source, rank, absolute path, and enablement |
| Scan the shared agents directory | Switches `~/.agents/skills` in or out of the scan; off by default, and the choice is remembered |
| Enable / disable | Switches one name off or back on (see how below) |
| Edit `SKILL.md` | Reads the document into an inline editor and saves it against the version it was read from |
| Upload skill documents | Reads `.md` files and/or skill archives (`.zip`) in the browser and installs them under the install root |
| Import from GitHub | Reads a repository link and installs every `SKILL.md` it exposes |
| Replace existing skills | Passes `overwrite` to an installation, which otherwise skips a name that already exists |

Documents that cannot be parsed are listed with their parse error instead of disappearing, and a name that two roots define is explained inline because its switch applies to the whole name.

### Skill archives

A `.zip` upload installs every directory that holds a `SKILL.md` as one skill and keeps the files beside it (scripts, references, assets). The single top-level directory Finder and GitHub's "Download ZIP" wrap archives in is stripped first, and an archive with no `SKILL.md` falls back to its root-level Markdown documents.

````text
bundle.zip
└── pdf-helper/
    ├── SKILL.md          →  ~/.dsh/skills/pdf-helper/SKILL.md  (normalized frontmatter)
    └── scripts/fill.sh   →  ~/.dsh/skills/pdf-helper/scripts/fill.sh
````

Entry paths are normalized and refused when absolute or containing `..`, so extraction cannot escape the install root; encrypted, ZIP64, and unsupported-compression archives are refused with a readable reason.

### How enablement works

A standalone plugin has no catalog filter, so disabling writes the two invocation keys the harness already understands into the document's frontmatter:

```yaml
disable-model-invocation: true
user-invocable: false
```

That removes the skill from the model catalog, the `skill` tool, and the `/` menu. The plugin records the values it replaced in its state file (`<dshHome>/skill-manager.json`), so enabling restores exactly what the document had before — including removing a key the document never carried. Disabling a document that has no frontmatter is refused rather than guessed at.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `dshHome` | `$DSH_HOME` or `~/.dsh` | Harness config root; its `skills` child is scanned and imported into |
| `agentsHome` | `$DSH_AGENTS_HOME` or `~/.agents` | Shared agent config root, the one the page's scan switch controls |
| `includeAgentsRoot` | `false` | Whether that root is scanned before the user changes the switch; the switch's stored choice wins after that |
| `extraRoots` | `[]` | Additional managed roots, each with `path`, `source`, and `rank` |
| `stateFile` | `<dshHome>/skill-manager.json` | Enablement ledger |
| `installRoot` | `<dshHome>/skills` | Directory that uploads and GitHub imports write into |
| `githubMaxFiles` | `20` | Largest number of documents one GitHub import installs |
| `githubMaxDocumentBytes` | `524288` | Largest accepted GitHub document |
| `githubTimeoutMs` | `30000` | Deadline for one GitHub import |
| `uploadMaxDocuments` | `20` | Largest number of documents and archives one upload installs |
| `uploadMaxDocumentBytes` | `524288` | Largest accepted upload document, and the base entry bound for an archive member |
| `zipMaxBytes` | `8388608` | Largest archive one upload may carry, before extraction |
| `zipMaxUncompressedBytes` | `33554432` | Largest uncompressed size one archive may reach |
| `zipMaxMembers` | `500` | Largest number of files one archive may hold |

Set them where the plugin row is declared:

```yaml
- insert:
    - id: skill-manager
      name: dsh-plugin-skill-manager
      config:
        extraRoots:
          - path: ~/team-skills
            source: team
            rank: 300
```

### Which roots are scanned

Only `$DSH_HOME/skills` and any configured `extraRoots` are scanned by default. The shared agents directory (`$DSH_AGENTS_HOME/skills`, rank 500) is **not** scanned until the switch on the page turns it on; turning it off again drops its documents from the catalog on the next read. The choice is stored beside the disable records in the state file, so it survives a restart and overrides `includeAgentsRoot`.

Path confinement is wider than the scan on purpose: reads and writes stay confined to every *configured* root, so a skill that was switched off while the agents directory was being scanned can still be switched back on after the scan is turned off.

## Safety

- Every read and write is confined to a configured root; a path outside them is refused with `outside-roots`.
- A write carries the content hash it was read from and is refused with `conflict` when the document changed in between.
- Every write goes through a temporary sibling and a rename, so a failed write cannot leave a half-written `SKILL.md`.
- Installs never replace an existing skill unless the request asks to.
- GitHub import reads only files named `SKILL.md`, through the public API, under the configured file, size, and time bounds.

## Development

```sh
pnpm install
pnpm build        # tsc -b && tsdown: lib/index.js (host) and lib/client.js (browser)
pnpm typecheck
```

`lib/` is committed so `dsh plugin add github:<owner>/<repo>` works without a build step; rebuild after changing `src/`.

Source layout:

| Path | Role |
|---|---|
| `src/index.ts` | Host plugin: configuration and the one route registration |
| `src/manager.ts` | Root resolution, catalog projection, enablement, installation |
| `src/catalog.ts` | Root scanning and tolerant frontmatter parsing |
| `src/documents.ts` | Document normalization, atomic writes, invocation-key editing |
| `src/github.ts` | Repository link parsing and bounded download |
| `src/http.ts` | Request decoding and response encoding |
| `src/protocol.ts` | Wire vocabulary shared by both halves |
| `src/client/` | The Settings page, its client, its copy, and its stylesheet |

## Limitations

- Enablement edits `SKILL.md` (see above); a deployment that must not touch skill files cannot use this page.
- Enablement is per name, not per document: two roots defining one name cannot be switched separately.
- The catalog is a snapshot: a skill added elsewhere appears after the next refresh.
- A project-level skill is outside this page; only the user-level and configured roots are scanned.
- Upload archives are read with the stored and deflate methods only; an encrypted or ZIP64 archive is refused rather than guessed at.

## License

MIT
