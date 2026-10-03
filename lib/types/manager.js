/**
 * Skill manager core: root resolution, catalog projection, enablement,
 * document editing, and installation. Every filesystem decision lives here;
 * the HTTP route only decodes a request and encodes the outcome.
 *
 * @module dsh-plugin-skill-manager/manager
 */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { isInside, readDocument, scanRoots, USER_AGENTS_SKILL_RANK, USER_DSH_SKILL_RANK, } from "./catalog.js";
import { planArchive } from "./bundles.js";
import { disabledInvocation, installBundle, installSkill, prepareSkillDocument, previousInvocation, restoredInvocation, withInvocation, writeTextAtomic, } from "./documents.js";
import { fetchGitHubDocuments, GitHubImportError, parseGitHubUrl } from "./github.js";
import { readZip, ZipError } from "./zip.js";
import { SkillLedger } from "./ledger.js";
const DEFAULT_GITHUB_MAX_FILES = 20;
const DEFAULT_GITHUB_MAX_DOCUMENT_BYTES = 512 * 1024;
const DEFAULT_GITHUB_TIMEOUT_MS = 30_000;
const DEFAULT_UPLOAD_MAX_DOCUMENTS = 20;
const DEFAULT_UPLOAD_MAX_DOCUMENT_BYTES = 512 * 1024;
const DEFAULT_ZIP_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_ZIP_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const DEFAULT_ZIP_MAX_MEMBERS = 2000;
const DEFAULT_ZIP_MAX_ENTRY_BYTES = 64 * 1024 * 1024;
/** One failed operation, carrying the stable code the page branches on. */
export class SkillManagerError extends Error {
    code;
    /**
     * @param code - stable failure code.
     * @param message - human diagnostic.
     */
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'SkillManagerError';
    }
}
/** Owner of the managed skill catalog and its one write path. */
export class SkillManager {
    /** Every configured root, including the shared agents root while its scan is off. */
    configuredRoots;
    agentsRoot;
    scanAgentsRootDefault;
    installRoot;
    ledger;
    github;
    uploadMaxDocuments;
    uploadMaxDocumentBytes;
    zipMaxBytes;
    zipLimits;
    /**
     * @param ctx - host context used only for logging.
     * @param config - managed roots, state file, and import bounds.
     */
    constructor(ctx, config = {}) {
        const dshHome = resolveDshHome(config.dshHome);
        const agentsHome = resolve(config.agentsHome ?? process.env.DSH_AGENTS_HOME ?? join(homedir(), '.agents'));
        this.agentsRoot = { path: join(agentsHome, 'skills'), source: 'user-agents', rank: USER_AGENTS_SKILL_RANK };
        this.configuredRoots = [
            { path: join(dshHome, 'skills'), source: 'user-dsh', rank: USER_DSH_SKILL_RANK },
            this.agentsRoot,
            ...(config.extraRoots ?? []).map(root => ({ path: resolve(root.path), source: root.source, rank: root.rank })),
        ];
        this.scanAgentsRootDefault = config.includeAgentsRoot ?? false;
        this.installRoot = resolve(config.installRoot ?? join(dshHome, 'skills'));
        this.ledger = new SkillLedger(resolve(config.stateFile ?? join(dshHome, 'skill-manager.json')), message => { ctx.logger.warn(message); });
        this.ledger.load();
        this.github = {
            maxFiles: positive('githubMaxFiles', config.githubMaxFiles, DEFAULT_GITHUB_MAX_FILES),
            maxDocumentBytes: positive('githubMaxDocumentBytes', config.githubMaxDocumentBytes, DEFAULT_GITHUB_MAX_DOCUMENT_BYTES),
            timeoutMs: positive('githubTimeoutMs', config.githubTimeoutMs, DEFAULT_GITHUB_TIMEOUT_MS),
        };
        this.uploadMaxDocuments = positive('uploadMaxDocuments', config.uploadMaxDocuments, DEFAULT_UPLOAD_MAX_DOCUMENTS);
        this.uploadMaxDocumentBytes = positive('uploadMaxDocumentBytes', config.uploadMaxDocumentBytes, DEFAULT_UPLOAD_MAX_DOCUMENT_BYTES);
        this.zipMaxBytes = positive('zipMaxBytes', config.zipMaxBytes, DEFAULT_ZIP_MAX_BYTES);
        this.zipLimits = {
            maxMembers: positive('zipMaxMembers', config.zipMaxMembers, DEFAULT_ZIP_MAX_MEMBERS),
            maxEntryBytes: positive('zipMaxEntryBytes', config.zipMaxEntryBytes, DEFAULT_ZIP_MAX_ENTRY_BYTES),
            maxTotalBytes: positive('zipMaxUncompressedBytes', config.zipMaxUncompressedBytes, DEFAULT_ZIP_MAX_UNCOMPRESSED_BYTES),
        };
    }
    /**
     * Largest JSON request body this manager's bounds can produce: the archive
     * cap plus base64 expansion and framing.
     */
    get maxRequestBodyBytes() {
        return Math.ceil(this.zipMaxBytes * 4 / 3) + 1024 * 1024;
    }
    /**
     * Report the managed catalog.
     * @param signal - caller cancellation.
     * @returns the current management view.
     */
    async catalog(signal) {
        const scanned = await scanRoots(this.scannedRoots(), signal);
        const present = new Set();
        const duplicates = new Set();
        for (const skill of scanned) {
            if (present.has(skill.name))
                duplicates.add(skill.name);
            else
                present.add(skill.name);
        }
        const skills = scanned
            .map(skill => toEntry(skill, this.ledger.isEnabled(skill.name), duplicates.has(skill.name)))
            .concat(this.ledger.disabled()
            .filter(record => !present.has(record.name))
            .map(orphanEntry))
            .sort(compareEntries);
        return {
            roots: this.scannedRoots()
                .map(root => ({ path: root.path, source: root.source, rank: root.rank }))
                .sort(compareRoots),
            skills,
            installRoot: this.installRoot,
            statePath: this.ledger.path,
            agentsRootEnabled: this.scansAgentsRoot(),
            agentsRootPath: this.agentsRoot.path,
            uploadLimits: {
                maxDocumentBytes: this.uploadMaxDocumentBytes,
                maxArchiveBytes: this.zipMaxBytes,
            },
        };
    }
    /**
     * Turn one skill on or off by writing the harness's invocation keys.
     * @param request - the skill name and the state it should reach.
     * @param signal - caller cancellation.
     * @returns the refreshed catalog.
     * @throws SkillManagerError `not-found` when the name has no document and no record.
     */
    async setEnabled(request, signal) {
        signal?.throwIfAborted();
        const scanned = await this.findSkill(request.name, signal);
        if (request.enabled) {
            const record = this.ledger.record(request.name);
            if (record !== undefined) {
                const path = this.assertManagedPath(record.path);
                const current = await readDocument(path, signal);
                if (current !== undefined) {
                    await writeTextAtomic(path, withInvocation(current.content, restoredInvocation(record.previous)));
                }
                this.ledger.enable(request.name);
                await this.ledger.persist();
            }
            return await this.catalog(signal);
        }
        if (scanned === undefined) {
            throw new SkillManagerError('not-found', `no managed root defines skill "${request.name}"`);
        }
        const path = this.assertManagedPath(scanned.path);
        const current = await readDocument(path, signal);
        if (current === undefined) {
            throw new SkillManagerError('not-found', `no skill document exists at "${path}"`);
        }
        const previous = previousInvocation(current.content);
        if (previous === undefined) {
            throw new SkillManagerError('invalid', `"${path}" has no frontmatter block to switch invocation keys in`);
        }
        await writeTextAtomic(path, withInvocation(current.content, disabledInvocation()));
        this.ledger.disable({
            name: scanned.name,
            source: scanned.source,
            path,
            disabledAt: new Date().toISOString(),
            previous,
        });
        await this.ledger.persist();
        signal?.throwIfAborted();
        return await this.catalog(signal);
    }
    /**
     * Choose whether the shared agents root is scanned, and persist the choice.
     * @param enabled - whether the root's documents join the catalog.
     * @param signal - caller cancellation.
     * @returns the refreshed catalog.
     */
    async setAgentsRoot(enabled, signal) {
        signal?.throwIfAborted();
        this.ledger.setScanAgentsRoot(enabled);
        await this.ledger.persist();
        signal?.throwIfAborted();
        return await this.catalog(signal);
    }
    /**
     * Read one skill document for the editor.
     * @param path - absolute document path inside a managed root.
     * @param signal - caller cancellation.
     * @returns the document text and its freshness token.
     */
    async read(path, signal) {
        const resolved = this.assertManagedPath(path);
        const document = await readDocument(resolved, signal);
        if (document === undefined)
            throw new SkillManagerError('not-found', `no skill document exists at "${resolved}"`);
        return { path: resolved, content: document.content, version: document.version };
    }
    /**
     * Replace one skill document.
     * @param request - path, replacement text, and the version it was read from.
     * @param signal - caller cancellation.
     * @returns the stored document and its new freshness token.
     */
    async write(request, signal) {
        const resolved = this.assertManagedPath(request.path);
        const current = await readDocument(resolved, signal);
        if (current === undefined)
            throw new SkillManagerError('not-found', `no skill document exists at "${resolved}"`);
        if (current.version !== request.version) {
            throw new SkillManagerError('conflict', `"${resolved}" changed after it was read`);
        }
        await writeTextAtomic(resolved, request.content);
        signal?.throwIfAborted();
        return await this.read(resolved, signal);
    }
    /**
     * Install documents the browser read from the user's disk.
     * @param request - documents and whether an existing skill directory may be replaced.
     * @param signal - caller cancellation.
     * @returns installed names, skipped documents, and the refreshed catalog.
     */
    async install(request, signal) {
        signal?.throwIfAborted();
        const bundles = request.bundles ?? [];
        if (request.documents.length + bundles.length > this.uploadMaxDocuments) {
            throw new SkillManagerError('rejected', `at most ${this.uploadMaxDocuments.toString()} documents or archives may be installed at once`);
        }
        const skipped = [];
        const installed = [];
        await this.installPrepared(prepareAll(request.documents, skipped, this.uploadMaxDocumentBytes), request.overwrite, installed, skipped, signal);
        for (const bundle of bundles) {
            signal?.throwIfAborted();
            const archive = decodeBase64(bundle.data);
            if (archive.byteLength > this.zipMaxBytes) {
                throw new SkillManagerError('rejected', `"${bundle.filename}" exceeds ${this.zipMaxBytes.toString()} bytes`);
            }
            let entries;
            try {
                entries = readZip(archive, this.zipLimits);
            }
            catch (error) {
                throw new SkillManagerError('invalid', error instanceof ZipError ? error.message : String(error));
            }
            const plan = planArchive(entries);
            for (const failure of plan.invalid)
                skipped.push({ name: failure.name, reason: 'invalid' });
            await this.installPrepared(prepareAll(plan.documents, skipped, this.uploadMaxDocumentBytes), request.overwrite, installed, skipped, signal);
            for (const entry of plan.bundles) {
                signal?.throwIfAborted();
                const result = await installBundle(this.installRoot, entry.skill, entry.files, request.overwrite);
                if (result === 'installed')
                    installed.push(entry.skill.name);
                else
                    skipped.push({ name: entry.skill.name, reason: 'exists' });
            }
        }
        signal?.throwIfAborted();
        return { installed, skipped, catalog: await this.catalog(signal) };
    }
    /**
     * Install every `SKILL.md` one GitHub repository exposes.
     * @param request - repository link and whether existing skill directories may be replaced.
     * @param signal - caller cancellation.
     * @returns installed names, skipped documents, and the refreshed catalog.
     */
    async importGitHub(request, signal) {
        signal?.throwIfAborted();
        const source = parseGitHubUrl(request.url);
        if (source === undefined) {
            throw new SkillManagerError('github', 'the link is not a GitHub repository or /tree/<ref> URL');
        }
        const target = request.ref === undefined || request.ref.length === 0 ? source : { ...source, ref: request.ref };
        let fetched;
        try {
            fetched = await fetchGitHubDocuments(target, this.github, signal);
        }
        catch (error) {
            throw new SkillManagerError('github', error instanceof GitHubImportError ? error.message : String(error));
        }
        signal?.throwIfAborted();
        const skipped = fetched.skipped.map(entry => ({
            name: entry.name,
            reason: entry.reason,
        }));
        const installed = [];
        await this.installPrepared(prepareAll(fetched.documents, skipped, Number.POSITIVE_INFINITY), request.overwrite, installed, skipped, signal);
        signal?.throwIfAborted();
        return { installed, skipped, catalog: await this.catalog(signal) };
    }
    /** Write every prepared skill, appending outcomes to the caller's lists. */
    async installPrepared(prepared, overwrite, installed, skipped, signal) {
        for (const skill of prepared) {
            signal?.throwIfAborted();
            const result = await installSkill(this.installRoot, skill, overwrite);
            if (result === 'installed')
                installed.push(skill.name);
            else
                skipped.push({ name: skill.name, reason: 'exists' });
        }
    }
    async findSkill(name, signal) {
        const scanned = await scanRoots(this.scannedRoots(), signal);
        return scanned.find(skill => skill.name === name);
    }
    /** The roots discovery reads: the shared agents root only while its scan is on. */
    scannedRoots() {
        return this.scansAgentsRoot()
            ? this.configuredRoots
            : this.configuredRoots.filter(root => root !== this.agentsRoot);
    }
    /** The effective scan choice: the persisted switch, else the deployment default. */
    scansAgentsRoot() {
        return this.ledger.scannedAgentsRoot ?? this.scanAgentsRootDefault;
    }
    /** Resolve one client path and refuse anything outside every managed root. */
    assertManagedPath(path) {
        const resolved = resolve(path);
        if (!this.configuredRoots.some(root => isInside(root.path, resolved))) {
            throw new SkillManagerError('outside-roots', `"${resolved}" is outside every managed skill root`);
        }
        return resolved;
    }
}
/** Resolve the harness home without depending on a harness package. */
function resolveDshHome(configured) {
    if (configured !== undefined && configured.length > 0)
        return resolve(expandHome(configured));
    const fromEnv = process.env.DSH_HOME;
    if (fromEnv !== undefined && fromEnv.trim().length > 0)
        return resolve(expandHome(fromEnv));
    return join(homedir(), '.dsh');
}
function expandHome(path) {
    if (path === '~')
        return homedir();
    if (path.startsWith('~/') || path.startsWith('~\\'))
        return join(homedir(), path.slice(2));
    return path;
}
function decodeBase64(value) {
    return new Uint8Array(Buffer.from(value, 'base64'));
}
function prepareAll(documents, skipped, maxBytes) {
    const prepared = [];
    for (const document of documents) {
        if (Buffer.byteLength(document.content, 'utf8') > maxBytes) {
            skipped.push({ name: document.filename, reason: 'invalid' });
            continue;
        }
        const outcome = prepareSkillDocument(document);
        if (outcome.kind === 'invalid') {
            skipped.push({ name: outcome.name, reason: outcome.reason });
            continue;
        }
        prepared.push(outcome.skill);
    }
    return prepared;
}
function toEntry(skill, enabled, duplicate) {
    return {
        name: skill.name,
        description: skill.description,
        source: skill.source,
        rank: skill.rank,
        root: skill.root,
        path: skill.path,
        enabled,
        modelInvocable: skill.invocation.modelInvocable,
        userInvocable: skill.invocation.userInvocable,
        state: skill.state,
        ...skill.error === undefined ? {} : { error: skill.error },
        duplicate,
    };
}
/** A disabled name whose document disappeared from every managed root. */
function orphanEntry(record) {
    return {
        name: record.name,
        description: '',
        source: record.source,
        rank: 0,
        root: '',
        path: record.path,
        enabled: false,
        modelInvocable: false,
        userInvocable: false,
        state: 'missing',
        error: 'the disabled entry is no longer present in any managed root',
        duplicate: false,
    };
}
function compareEntries(left, right) {
    return missingRank(left) - missingRank(right)
        || left.rank - right.rank
        || left.name.localeCompare(right.name)
        || left.path.localeCompare(right.path);
}
function missingRank(entry) {
    return entry.state === 'missing' ? 1 : 0;
}
function compareRoots(left, right) {
    return left.rank - right.rank || left.path.localeCompare(right.path);
}
function positive(field, value, fallback) {
    const resolved = value ?? fallback;
    if (!Number.isInteger(resolved) || resolved < 1) {
        throw new TypeError(`skill-manager: ${field} must be a positive integer`);
    }
    return resolved;
}
//# sourceMappingURL=manager.js.map