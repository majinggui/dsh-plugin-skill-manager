/**
 * Disable ledger: the durable record of every skill this plugin turned off,
 * including the frontmatter values it replaced so enabling restores them.
 *
 * @module dsh-plugin-skill-manager/ledger
 */

import { readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** One disabled skill as recorded when it was turned off. */
export interface DisabledRecord {
  /** Kebab-case skill name. */
  readonly name: string
  /** Discovery source of the entry that was disabled. */
  readonly source: string
  /** Document path observed when the entry was disabled. */
  readonly path: string
  /** ISO timestamp of the change. */
  readonly disabledAt: string
  /**
   * The invocation keys exactly as they stood before this plugin wrote the
   * disabled state: `null` records that the key was absent.
   */
  readonly previous: {
    readonly 'disable-model-invocation': string | number | boolean | null
    readonly 'user-invocable': string | number | boolean | null
  }
}

/** Current on-disk ledger format. */
const LEDGER_VERSION = 1

interface LedgerFile {
  readonly version: number
  readonly disabled: readonly DisabledRecord[]
}

/**
 * In-memory view of the disable ledger with whole-file persistence.
 *
 * The file is read once at construction. A missing file is the normal empty
 * state; an unreadable or malformed file is reported and treated as empty
 * rather than blocking plugin activation, and the next write replaces it.
 */
export class SkillLedger {
  private readonly records = new Map<string, DisabledRecord>()

  /**
   * @param file - absolute path of the JSON state file.
   * @param warn - sink for a state file that could not be used.
   */
  constructor(
    private readonly file: string,
    private readonly warn: (message: string) => void,
  ) {}

  /** Absolute path of the backing state file. */
  get path(): string {
    return this.file
  }

  /** Read the state file into memory, replacing any previously loaded records. */
  load(): void {
    this.records.clear()
    let raw: string
    try {
      raw = readFileSync(this.file, 'utf8')
    } catch (error) {
      if (!isAbsentPathError(error)) this.warn(`skill-manager: state file ${this.file} could not be read: ${String(error)}`)
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      this.warn(`skill-manager: state file ${this.file} is not valid JSON: ${String(error)}`)
      return
    }
    for (const record of readRecords(parsed)) this.records.set(record.name, record)
  }

  /**
   * Whether one skill name is currently available to catalogs.
   * @param name - kebab-case skill name.
   * @returns false while the name is recorded as disabled.
   */
  isEnabled(name: string): boolean {
    return !this.records.has(name)
  }

  /**
   * The record for one disabled name.
   * @param name - kebab-case skill name.
   * @returns the stored record, or `undefined` when the name is enabled.
   */
  record(name: string): DisabledRecord | undefined {
    return this.records.get(name)
  }

  /** Every disabled record, for display alongside the scanned catalog. */
  disabled(): readonly DisabledRecord[] {
    return [...this.records.values()]
  }

  /**
   * Record one skill as disabled.
   * @param record - the entry observed at disable time.
   */
  disable(record: DisabledRecord): void {
    this.records.set(record.name, record)
  }

  /**
   * Drop one skill's disabled record.
   * @param name - kebab-case skill name.
   */
  enable(name: string): void {
    this.records.delete(name)
  }

  /** Write the complete ledger, replacing the previous file atomically. */
  async persist(): Promise<void> {
    const payload: LedgerFile = {
      version: LEDGER_VERSION,
      disabled: [...this.records.values()].sort((left, right) => left.name.localeCompare(right.name)),
    }
    await mkdir(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.tmp-${process.pid.toString()}`
    await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8' })
    await rename(temporary, this.file)
  }
}

function readRecords(parsed: unknown): readonly DisabledRecord[] {
  if (parsed === null || typeof parsed !== 'object') return []
  const disabled = (parsed as { disabled?: unknown }).disabled
  if (!Array.isArray(disabled)) return []
  const records: DisabledRecord[] = []
  for (const entry of disabled) {
    const record = readRecord(entry)
    if (record !== undefined) records.push(record)
  }
  return records
}

function readRecord(entry: unknown): DisabledRecord | undefined {
  if (entry === null || typeof entry !== 'object') return undefined
  const candidate = entry as Partial<Record<keyof DisabledRecord, unknown>>
  if (typeof candidate.name !== 'string' || candidate.name.length === 0) return undefined
  const previous = candidate.previous !== null && typeof candidate.previous === 'object'
    ? candidate.previous as Partial<DisabledRecord['previous']>
    : {}
  return {
    name: candidate.name,
    source: typeof candidate.source === 'string' ? candidate.source : 'custom',
    path: typeof candidate.path === 'string' ? candidate.path : '',
    disabledAt: typeof candidate.disabledAt === 'string' ? candidate.disabledAt : '',
    previous: {
      'disable-model-invocation': scalarOrNull(previous['disable-model-invocation']),
      'user-invocable': scalarOrNull(previous['user-invocable']),
    },
  }
}

function scalarOrNull(value: unknown): string | number | boolean | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null
}

function isAbsentPathError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}
