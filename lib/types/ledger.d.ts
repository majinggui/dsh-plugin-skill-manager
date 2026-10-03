/**
 * Disable ledger: the durable record of every skill this plugin turned off,
 * including the frontmatter values it replaced so enabling restores them.
 *
 * @module dsh-plugin-skill-manager/ledger
 */
/** One disabled skill as recorded when it was turned off. */
export interface DisabledRecord {
    /** Kebab-case skill name. */
    readonly name: string;
    /** Discovery source of the entry that was disabled. */
    readonly source: string;
    /** Document path observed when the entry was disabled. */
    readonly path: string;
    /** ISO timestamp of the change. */
    readonly disabledAt: string;
    /**
     * The invocation keys exactly as they stood before this plugin wrote the
     * disabled state: `null` records that the key was absent.
     */
    readonly previous: {
        readonly 'disable-model-invocation': string | number | boolean | null;
        readonly 'user-invocable': string | number | boolean | null;
    };
}
/**
 * In-memory view of the disable ledger with whole-file persistence.
 *
 * The file is read once at construction. A missing file is the normal empty
 * state; an unreadable or malformed file is reported and treated as empty
 * rather than blocking plugin activation, and the next write replaces it.
 */
export declare class SkillLedger {
    private readonly file;
    private readonly warn;
    private readonly records;
    /**
     * @param file - absolute path of the JSON state file.
     * @param warn - sink for a state file that could not be used.
     */
    constructor(file: string, warn: (message: string) => void);
    /** Absolute path of the backing state file. */
    get path(): string;
    /** Read the state file into memory, replacing any previously loaded records. */
    load(): void;
    /**
     * Whether one skill name is currently available to catalogs.
     * @param name - kebab-case skill name.
     * @returns false while the name is recorded as disabled.
     */
    isEnabled(name: string): boolean;
    /**
     * The record for one disabled name.
     * @param name - kebab-case skill name.
     * @returns the stored record, or `undefined` when the name is enabled.
     */
    record(name: string): DisabledRecord | undefined;
    /** Every disabled record, for display alongside the scanned catalog. */
    disabled(): readonly DisabledRecord[];
    /**
     * Record one skill as disabled.
     * @param record - the entry observed at disable time.
     */
    disable(record: DisabledRecord): void;
    /**
     * Drop one skill's disabled record.
     * @param name - kebab-case skill name.
     */
    enable(name: string): void;
    /** Write the complete ledger, replacing the previous file atomically. */
    persist(): Promise<void>;
}
//# sourceMappingURL=ledger.d.ts.map