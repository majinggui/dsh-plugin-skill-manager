/**
 * GitHub skill import: resolve a repository link to its `SKILL.md` documents.
 *
 * The import reads the repository's git tree through the public REST API and
 * downloads each matching document from `raw.githubusercontent.com`, so a
 * repository without a local checkout can still be learned. Only documents
 * named `SKILL.md` are considered, matching the directory-bundle convention
 * the harness discovers.
 *
 * @module dsh-plugin-skill-manager/github
 */
const GITHUB_API = 'https://api.github.com';
const GITHUB_RAW = 'https://raw.githubusercontent.com';
const SEGMENT = /^[A-Za-z0-9._-]+$/;
/** Failure of one GitHub import, reported to the browser as a failed request. */
export class GitHubImportError extends Error {
}
/**
 * Parse a GitHub repository link.
 * @param url - `https://github.com/<owner>/<repo>` with an optional `/tree/<ref>[/<path>]` suffix.
 * @returns the resolved owner, repository, ref, and subdirectory, or `undefined` for an unsupported link.
 */
export function parseGitHubUrl(url) {
    let parsed;
    try {
        parsed = new URL(url.trim());
    }
    catch {
        return undefined;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
        return undefined;
    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com')
        return undefined;
    const segments = parsed.pathname.split('/').filter(segment => segment.length > 0);
    const owner = segments[0];
    const repository = segments[1];
    if (owner === undefined || repository === undefined)
        return undefined;
    if (!SEGMENT.test(owner))
        return undefined;
    const repo = repository.endsWith('.git') ? repository.slice(0, -4) : repository;
    if (!SEGMENT.test(repo))
        return undefined;
    if (segments.length === 2)
        return { owner, repo };
    if (segments[2] !== 'tree')
        return undefined;
    const ref = segments[3];
    if (ref === undefined || ref.length === 0)
        return undefined;
    const path = segments.slice(4).join('/');
    return { owner, repo, ref, ...path.length > 0 ? { path } : {} };
}
/**
 * Download every `SKILL.md` document one repository exposes.
 * @param source - parsed repository link.
 * @param config - size limits and timeout.
 * @param signal - caller cancellation.
 * @returns the downloaded documents and the entries that were skipped.
 * @throws GitHubImportError when the repository, ref, or download cannot be read.
 */
export async function fetchGitHubDocuments(source, config, signal) {
    const lifetime = withTimeout(signal, config.timeoutMs);
    const ref = source.ref ?? await readDefaultBranch(source, lifetime);
    const tree = await readTree(source, ref, lifetime);
    const prefix = source.path === undefined ? '' : `${source.path.replace(/^\/+|\/+$/g, '')}/`;
    const skills = tree.filter(entry => entry.type === 'blob'
        && (entry.path === 'SKILL.md' || entry.path.endsWith('/SKILL.md'))
        && entry.path.startsWith(prefix));
    const documents = [];
    const skipped = [];
    for (const entry of skills) {
        if (documents.length >= config.maxFiles) {
            skipped.push({ name: entry.path, reason: 'limit' });
            continue;
        }
        const content = await readRawDocument(source, ref, entry.path, lifetime);
        if (Buffer.byteLength(content, 'utf8') > config.maxDocumentBytes) {
            skipped.push({ name: entry.path, reason: 'too-large' });
            continue;
        }
        documents.push({ filename: entry.path, content });
    }
    return { documents, skipped };
}
async function readDefaultBranch(source, signal) {
    const repository = await readJson(`${GITHUB_API}/repos/${source.owner}/${source.repo}`, signal);
    const branch = stringField(repository, 'default_branch');
    if (branch === undefined)
        throw new GitHubImportError('GitHub repository has no default branch');
    return branch;
}
async function readTree(source, ref, signal) {
    const url = `${GITHUB_API}/repos/${source.owner}/${source.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
    const payload = await readJson(url, signal);
    const tree = payload['tree'];
    if (!Array.isArray(tree))
        throw new GitHubImportError(`GitHub ref "${ref}" has no readable tree`);
    const entries = [];
    for (const entry of tree) {
        if (entry === null || typeof entry !== 'object')
            continue;
        const path = entry.path;
        const type = entry.type;
        if (typeof path === 'string' && typeof type === 'string')
            entries.push({ path, type });
    }
    return entries;
}
async function readRawDocument(source, ref, path, signal) {
    const encoded = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const url = `${GITHUB_RAW}/${source.owner}/${source.repo}/${encodeURIComponent(ref)}/${encoded}`;
    const response = await fetchWithin(url, signal);
    if (!response.ok) {
        throw new GitHubImportError(`GitHub document "${path}" could not be downloaded (${response.status.toString()})`);
    }
    return await response.text();
}
async function readJson(url, signal) {
    const response = await fetchWithin(url, signal);
    if (!response.ok) {
        throw new GitHubImportError(response.status === 404
            ? 'GitHub repository or ref was not found'
            : `GitHub request failed with status ${response.status.toString()}`);
    }
    let parsed;
    try {
        parsed = await response.json();
    }
    catch (error) {
        throw new GitHubImportError(`GitHub response was not JSON: ${String(error)}`);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new GitHubImportError('GitHub response was not a JSON object');
    }
    return parsed;
}
async function fetchWithin(url, signal) {
    try {
        return await fetch(url, {
            signal,
            headers: {
                accept: 'application/vnd.github+json',
                'user-agent': 'dsh-plugin-skill-manager',
                'x-github-api-version': '2022-11-28',
            },
        });
    }
    catch (error) {
        throw new GitHubImportError(`GitHub request failed: ${String(error)}`);
    }
}
/** Combine caller cancellation with the import deadline. */
function withTimeout(signal, timeoutMs) {
    const timeout = AbortSignal.timeout(timeoutMs);
    return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}
function stringField(value, key) {
    const field = value[key];
    return typeof field === 'string' && field.length > 0 ? field : undefined;
}
//# sourceMappingURL=github.js.map