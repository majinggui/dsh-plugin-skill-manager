/**
 * Skill manager settings page: the scanned user-level skill catalog with its
 * source and precedence, per-name enablement, SKILL.md editing, and document
 * or GitHub installation.
 *
 * The page owns only viewing state; every read and write crosses the injected
 * request callbacks, and the Host owns discovery, the enablement ledger, path
 * confinement, and installations.
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Button, Checkbox, Input, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  SkillCatalog,
  SkillDocumentValue,
  SkillEntry,
  SkillFailure,
  SkillGitHubRequest,
  SkillInstallRequest,
  SkillInstallValue,
  SkillSkippedDocument,
  SkillToggleRequest,
  SkillUploadDocument,
  SkillWriteRequest,
} from '../protocol.ts'
import type { SkillManagerLocaleKey } from './locales.ts'
import { css } from './styles.ts'

/** The result of one request, as the page's injected callbacks report it. */
export type SkillOutcome<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: SkillFailure }

/** Registration-side request face the page drives. */
export interface SkillManagerInjected {
  /** Read the current managed catalog. */
  list: () => Promise<SkillOutcome<SkillCatalog>>
  /** Turn one skill name on or off; resolves with the refreshed catalog. */
  setEnabled: (request: SkillToggleRequest) => Promise<SkillOutcome<SkillCatalog>>
  /** Read one skill document for the editor. */
  read: (path: string) => Promise<SkillOutcome<SkillDocumentValue>>
  /** Replace one skill document. */
  write: (request: SkillWriteRequest) => Promise<SkillOutcome<SkillDocumentValue>>
  /** Install documents the browser read from the user's disk. */
  install: (request: SkillInstallRequest) => Promise<SkillOutcome<SkillInstallValue>>
  /** Install every `SKILL.md` one GitHub repository exposes. */
  importGitHub: (request: SkillGitHubRequest) => Promise<SkillOutcome<SkillInstallValue>>
}

/**
 * Props the renderer binds for the skills settings section. The page reads the
 * locale seat and its own request face only.
 */
export type SkillManagerSectionProps =
  PropsLocale<'skills'>
  & InjectFace<SkillManagerInjected>

type Translate = SkillManagerSectionProps['t']

type View =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly catalog: SkillCatalog }

interface Editor {
  readonly path: string
  readonly name: string
  content: string
  readonly version: string
  /** Stable failure code, or a Host diagnostic for an unexpected failure. */
  error?: string
}

interface Notice {
  readonly tone: 'ok' | 'error'
  readonly text: string
}

/** Localized root label for each discovery source the Host reports. */
const SOURCE_KEYS: Readonly<Record<string, SkillManagerLocaleKey>> = {
  'user-dsh': 'sourceUserDsh',
  'user-agents': 'sourceUserAgents',
}

/** Locale key naming each skip reason the Host can report. */
const SKIP_REASON_KEYS: Readonly<Record<SkillSkippedDocument['reason'], SkillManagerLocaleKey>> = {
  exists: 'skippedExists',
  invalid: 'skippedInvalid',
  'too-large': 'skippedTooLarge',
  limit: 'skippedLimit',
}

/** Render the skills management page. */
export function SkillManagerSection(props: SkillManagerSectionProps) {
  const { t, list, setEnabled, read, write, install, importGitHub } = props
  const [view, setView] = useState<View>({ status: 'loading' })
  const [notice, setNotice] = useState<Notice>()
  const [editor, setEditor] = useState<Editor>()
  const [busy, setBusy] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [url, setUrl] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (outcome) => { if (current) setView(toView(outcome)) },
    )
    return () => { current = false }
  }, [list])

  const refresh = (): void => {
    void list().then((outcome) => { setView(toView(outcome)) })
  }

  const toggle = (skill: SkillEntry, next: boolean): void => {
    setNotice(undefined)
    if (skill.state === 'missing' || skill.state === 'invalid') {
      setNotice({ tone: 'error', text: 'the entry has no usable document to switch' })
      return
    }
    void setEnabled({ name: skill.name, enabled: next }).then((outcome) => {
      if (outcome.ok) {
        setView({ status: 'ready', catalog: outcome.value })
        return
      }
      setNotice({ tone: 'error', text: outcome.error.message })
    })
  }

  const openEditor = (skill: SkillEntry): void => {
    setNotice(undefined)
    void read(skill.path).then((outcome) => {
      if (outcome.ok) {
        setEditor({
          path: outcome.value.path,
          name: skill.name,
          content: outcome.value.content,
          version: outcome.value.version,
        })
        return
      }
      setNotice({ tone: 'error', text: outcome.error.message })
    })
  }

  const saveEditor = (open: Editor): void => {
    setBusy(true)
    void write({ path: open.path, content: open.content, version: open.version }).then((outcome) => {
      setBusy(false)
      if (outcome.ok) {
        setEditor(undefined)
        setNotice({ tone: 'ok', text: `${t('editor')} · ${open.name} · ${t('save')}` })
        refresh()
        return
      }
      setEditor((previous) => previous === undefined ? previous : { ...previous, error: outcome.error.code })
    })
  }

  const installed = (value: SkillInstallValue): void => {
    setView({ status: 'ready', catalog: value.catalog })
    setNotice({ tone: 'ok', text: describeInstall(value, t) })
  }

  const onFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = [...(event.target.files ?? [])]
    // Clear the input so picking the same file again still fires a change.
    event.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setNotice(undefined)
    void (async () => {
      const documents: SkillUploadDocument[] = []
      for (const file of files) documents.push({ filename: file.name, content: await file.text() })
      return await install({ documents, overwrite })
    })().then((outcome) => {
      setBusy(false)
      if (outcome.ok) installed(outcome.value)
      else setNotice({ tone: 'error', text: outcome.error.message })
    })
  }

  const runGitHub = (): void => {
    setBusy(true)
    setNotice(undefined)
    void importGitHub({ url: url.trim(), overwrite }).then((outcome) => {
      setBusy(false)
      if (outcome.ok) installed(outcome.value)
      else setNotice({ tone: 'error', text: outcome.error.message })
    })
  }

  return (
    <div className={css.section}>
      <h2 className={css.heading}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      {view.status === 'loading' && <p className={css.status}>{t('loading')}</p>}
      {view.status === 'error' && (
        <div className={css.failure}>
          <span>{t('error')}: {view.message}</span>
          <Button size="sm" variant="outline" onClick={() => { setView({ status: 'loading' }); refresh() }}>
            {t('retry')}
          </Button>
        </div>
      )}
      {view.status === 'ready' && (
        <>
          <div className={css.roots}>
            <span className={css.rootsLabel}>{t('roots')}</span>
            {view.catalog.roots.map(root => (
              <span key={root.path} className={css.root} title={root.path}>
                <Tag tone="neutral">{sourceLabel(root.source, t)}</Tag>
                <code className={css.rank}>{root.rank}</code>
              </span>
            ))}
          </div>
          <p className={css.hint} title={view.catalog.installRoot}>{t('installRoot')}: {view.catalog.installRoot}</p>
          <div className={css.actions}>
            <input
              ref={fileInput}
              className={css.fileInput}
              type="file"
              accept=".md,text/markdown"
              multiple
              onChange={onFiles}
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { fileInput.current?.click() }}>
              {t('upload')}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={refresh}>{t('refresh')}</Button>
            <Checkbox checked={overwrite} onChange={setOverwrite} label={t('overwrite')} disabled={busy} />
          </div>
          <p className={css.hint}>{t('uploadHint')}</p>
          <div className={css.github}>
            <Input
              value={url}
              aria-label={t('github')}
              placeholder={t('githubPlaceholder')}
              disabled={busy}
              onChange={(event) => { setUrl(event.target.value) }}
            />
            <Button size="sm" variant="outline" disabled={busy || url.trim().length === 0} onClick={runGitHub}>
              {t('githubAction')}
            </Button>
          </div>
          <p className={css.hint}>{t('toggleNote')}</p>
          {notice !== undefined && (
            <p className={`${css.notice} ${notice.tone === 'ok' ? css.noticeOk : css.noticeError}`}>{notice.text}</p>
          )}
          {view.catalog.skills.length === 0
            ? <p className={css.status}>{t('empty')}</p>
            : (
              <ul className={css.list}>
                {view.catalog.skills.map(skill => (
                  <li key={`${skill.name}:${skill.path}`} className={css.row} data-state={skill.state}>
                    <div className={css.rowMain}>
                      <div className={css.rowTitle}>
                        <code className={css.name}>{skill.name}</code>
                        {skill.state === 'invalid' && <Tag tone="warning">{t('stateInvalid')}</Tag>}
                        {skill.state === 'missing' && <Tag tone="danger">{t('stateMissing')}</Tag>}
                      </div>
                      <p className={css.description}>{skill.description.length > 0 ? skill.description : skill.error}</p>
                      <div className={css.meta}>
                        <Tag tone="neutral">{sourceLabel(skill.source, t)}</Tag>
                        <span className={css.priority}>{t('priority')} {skill.rank}</span>
                        <span className={css.path} title={skill.path}>{skill.path}</span>
                      </div>
                      {skill.duplicate && <p className={css.duplicate}>{t('duplicate')}</p>}
                      {editor !== undefined && editor.path === skill.path && (
                        <div className={css.editor}>
                          <div className={css.editorHeader}>
                            <span>{t('editor')}</span>
                            <code className={css.name}>{skill.name}</code>
                            <span className={css.path} title={skill.path}>{skill.path}</span>
                            <Button size="sm" variant="ghost" onClick={() => { setEditor(undefined) }}>{t('close')}</Button>
                          </div>
                          <textarea
                            className={css.textarea}
                            value={editor.content}
                            spellCheck={false}
                            aria-label={`${t('editor')} ${skill.name}`}
                            onChange={(event) => { setEditor({ ...editor, content: event.target.value }) }}
                          />
                          {editor.error !== undefined && (
                            <p className={css.inlineFailure}>
                              {editor.error === 'conflict' ? t('conflict') : editor.error}
                            </p>
                          )}
                          <div className={css.editorActions}>
                            <Button size="sm" variant="primary" disabled={busy} onClick={() => { saveEditor(editor) }}>
                              {busy ? t('saving') : t('save')}
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditor(undefined) }}>
                              {t('cancel')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={css.rowActions}>
                      <span className={css.state} data-enabled={skill.enabled ? 'true' : undefined}>
                        {skill.enabled ? t('enabled') : t('disabled')}
                      </span>
                      <Switch
                        checked={skill.enabled}
                        label={`${skill.enabled ? t('toggleOff') : t('toggleOn')}: ${skill.name}`}
                        disabled={busy || skill.state === 'invalid'}
                        onChange={(next) => { toggle(skill, next) }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || skill.state === 'missing'}
                        onClick={() => { openEditor(skill) }}
                      >
                        {t('edit')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
    </div>
  )
}

function toView(outcome: SkillOutcome<SkillCatalog>): View {
  return outcome.ok
    ? { status: 'ready', catalog: outcome.value }
    : { status: 'error', message: outcome.error.message }
}

function sourceLabel(source: string, t: Translate): string {
  const key = SOURCE_KEYS[source]
  return key === undefined ? source : t(key)
}

/** One-line outcome of an installation, in the active language. */
function describeInstall(value: SkillInstallValue, t: Translate): string {
  const parts: string[] = []
  if (value.installed.length > 0) parts.push(`${t('installed')}: ${value.installed.join(', ')}`)
  const counts = new Map<SkillSkippedDocument['reason'], number>()
  for (const skipped of value.skipped) counts.set(skipped.reason, (counts.get(skipped.reason) ?? 0) + 1)
  for (const [reason, count] of counts) parts.push(`${t(SKIP_REASON_KEYS[reason])}: ${count.toString()}`)
  return parts.length === 0 ? t('empty') : parts.join(' · ')
}
