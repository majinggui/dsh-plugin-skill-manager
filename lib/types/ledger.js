/**
 * Disable ledger: the durable record of every skill this plugin turned off,
 * including the frontmatter values it replaced so enabling restores them.
 *
 * @module dsh-plugin-skill-manager/ledger
 */
import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
/** Current on-disk ledger format. */
const LEDGER_VERSION = 1;
/**
 * In-memory view of the disable ledger with whole-file persistence.
 *
 * The file is read once at construction. A missing file is the normal empty
 * state; an unreadable or malformed file is reported and treated as empty
 * rather than blocking plugin activation, and the next write replaces it.
 */
export class SkillLedger {
    file;
    warn;
    records = new Map();
    /**
     * @param file - absolute path of the JSON state file.
     * @param warn - sink for a state file that could not be used.
     */
    constructor(file, warn) {
        this.file = file;
        this.warn = warn;
    }
    /** Absolute path of the backing state file. */
    get path() {
        return this.file;
    }
    /** Read the state file into memory, replacing any previously loaded records. */
    load() {
        this.records.clear();
        let raw;
        try {
            raw = readFileSync(this.file, 'utf8');
        }
        catch (error) {
            if (!isAbsentPathError(error))
                this.warn(`skill-manager: state file ${this.file} could not be read: ${String(error)}`);
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch (error) {
            this.warn(`skill-manager: state file ${this.file} is not valid JSON: ${String(error)}`);
            return;
        }
        for (const record of readRecords(parsed))
            this.records.set(record.name, record);
    }
    /**
     * Whether one skill name is currently available to catalogs.
     * @param name - kebab-case skill name.
     * @returns false while the name is recorded as disabled.
     */
    isEnabled(name) {
        return !this.records.has(name);
    }
    /**
     * The record for one disabled name.
     * @param name - kebab-case skill name.
     * @returns the stored record, or `undefined` when the name is enabled.
     */
    record(name) {
        return this.records.get(name);
    }
    /** Every disabled record, for display alongside the scanned catalog. */
    disabled() {
        return [...this.records.values()];
    }
    /**
     * Record one skill as disabled.
     * @param record - the entry observed at disable time.
     */
    disable(record) {
        this.records.set(record.name, record);
    }
    /**
     * Drop one skill's disabled record.
     * @param name - kebab-case skill name.
     */
    enable(name) {
        this.records.delete(name);
    }
    /** Write the complete ledger, replacing the previous file atomically. */
    async persist() {
        const payload = {
            version: LEDGER_VERSION,
            disabled: [...this.records.values()].sort((left, right) => left.name.localeCompare(right.name)),
        };
        await mkdir(dirname(this.file), { recursive: true });
        const temporary = `${this.file}.tmp-${process.pid.toString()}`;
        await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8' });
        await rename(temporary, this.file);
    }
}
function readRecords(parsed) {
    if (parsed === null || typeof parsed !== 'object')
        return [];
    const disabled = parsed.disabled;
    if (!Array.isArray(disabled))
        return [];
    const records = [];
    for (const entry of disabled) {
        const record = readRecord(entry);
        if (record !== undefined)
            records.push(record);
    }
    return records;
}
function readRecord(entry) {
    if (entry === null || typeof entry !== 'object')
        return undefined;
    const candidate = entry;
    if (typeof candidate.name !== 'string' || candidate.name.length === 0)
        return undefined;
    const previous = candidate.previous !== null && typeof candidate.previous === 'object'
        ? candidate.previous
        : {};
    return {
        name: candidate.name,
        source: typeof candidate.source === 'string' ? candidate.source : 'custom',
        path: typeof candidate.path === 'string' ? candidate.path : '',
        disabledAt: typeof candidate.disabledAt === 'string' ? candidate.disabledAt : '',
        previous: {
            'disable-model-invocation': scalarOrNull(previous['disable-model-invocation']),
            'user-invocable': scalarOrNull(previous['user-invocable']),
        },
    };
}
function scalarOrNull(value) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
}
function isAbsentPathError(error) {
    return typeof error === 'object' && error !== null && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}
//# sourceMappingURL=ledger.js.map