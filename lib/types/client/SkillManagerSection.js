import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Skill manager settings page: the scanned user-level skill catalog with its
 * source and precedence, per-name enablement, SKILL.md editing, and document
 * or GitHub installation.
 *
 * The page owns only viewing state; every read and write crosses the injected
 * request callbacks, and the Host owns discovery, the enablement ledger, path
 * confinement, and installations.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Input, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives';
import { css } from "./styles.js";
/** Localized root label for each discovery source the Host reports. */
const SOURCE_KEYS = {
    'user-dsh': 'sourceUserDsh',
    'user-agents': 'sourceUserAgents',
};
/** Locale key naming each skip reason the Host can report. */
const SKIP_REASON_KEYS = {
    exists: 'skippedExists',
    invalid: 'skippedInvalid',
    'too-large': 'skippedTooLarge',
    limit: 'skippedLimit',
};
/** Render the skills management page. */
export function SkillManagerSection(props) {
    const { t, list, setEnabled, setAgentsRoot, read, write, install, importGitHub } = props;
    const [view, setView] = useState({ status: 'loading' });
    const [notice, setNotice] = useState();
    const [editor, setEditor] = useState();
    const [busy, setBusy] = useState(false);
    const [overwrite, setOverwrite] = useState(false);
    const [url, setUrl] = useState('');
    const fileInput = useRef(null);
    useEffect(() => {
        let current = true;
        void Promise.resolve().then(() => list()).then((outcome) => { if (current)
            setView(toView(outcome)); });
        return () => { current = false; };
    }, [list]);
    const refresh = () => {
        void list().then((outcome) => { setView(toView(outcome)); });
    };
    const toggle = (skill, next) => {
        setNotice(undefined);
        if (skill.state === 'missing' || skill.state === 'invalid') {
            setNotice({ tone: 'error', text: 'the entry has no usable document to switch' });
            return;
        }
        void setEnabled({ name: skill.name, enabled: next }).then((outcome) => {
            if (outcome.ok) {
                setView({ status: 'ready', catalog: outcome.value });
                return;
            }
            setNotice({ tone: 'error', text: outcome.error.message });
        });
    };
    const toggleAgentsRoot = (next) => {
        setNotice(undefined);
        void setAgentsRoot(next).then((outcome) => {
            if (outcome.ok)
                setView({ status: 'ready', catalog: outcome.value });
            else
                setNotice({ tone: 'error', text: outcome.error.message });
        });
    };
    const openEditor = (skill) => {
        setNotice(undefined);
        void read(skill.path).then((outcome) => {
            if (outcome.ok) {
                setEditor({
                    path: outcome.value.path,
                    name: skill.name,
                    content: outcome.value.content,
                    version: outcome.value.version,
                });
                return;
            }
            setNotice({ tone: 'error', text: outcome.error.message });
        });
    };
    const saveEditor = (open) => {
        setBusy(true);
        void write({ path: open.path, content: open.content, version: open.version }).then((outcome) => {
            setBusy(false);
            if (outcome.ok) {
                setEditor(undefined);
                setNotice({ tone: 'ok', text: `${t('editor')} · ${open.name} · ${t('save')}` });
                refresh();
                return;
            }
            setEditor((previous) => previous === undefined ? previous : { ...previous, error: outcome.error.code });
        });
    };
    const installed = (value) => {
        setView({ status: 'ready', catalog: value.catalog });
        setNotice({ tone: 'ok', text: describeInstall(value, t) });
    };
    const onFiles = (event) => {
        const files = [...(event.target.files ?? [])];
        // Clear the input so picking the same file again still fires a change.
        event.target.value = '';
        if (files.length === 0)
            return;
        const limits = view.status === 'ready' ? view.catalog.uploadLimits : undefined;
        for (const file of files) {
            const limit = file.name.toLowerCase().endsWith('.zip') ? limits?.maxArchiveBytes : limits?.maxDocumentBytes;
            if (limit !== undefined && file.size > limit) {
                setNotice({
                    tone: 'error',
                    text: `${file.name} — ${t('tooLarge')}: ${formatBytes(file.size)} > ${formatBytes(limit)}`,
                });
                return;
            }
        }
        setBusy(true);
        setNotice(undefined);
        void (async () => {
            const documents = [];
            const bundles = [];
            for (const file of files) {
                if (file.name.toLowerCase().endsWith('.zip')) {
                    bundles.push({ filename: file.name, data: await encodeBase64(file) });
                    continue;
                }
                documents.push({ filename: file.name, content: await file.text() });
            }
            return await install({ documents, bundles, overwrite });
        })().then((outcome) => {
            setBusy(false);
            if (outcome.ok)
                installed(outcome.value);
            else
                setNotice({ tone: 'error', text: outcome.error.message });
        });
    };
    const runGitHub = () => {
        setBusy(true);
        setNotice(undefined);
        void importGitHub({ url: url.trim(), overwrite }).then((outcome) => {
            setBusy(false);
            if (outcome.ok)
                installed(outcome.value);
            else
                setNotice({ tone: 'error', text: outcome.error.message });
        });
    };
    return (_jsxs("div", { className: css.section, children: [_jsx("h2", { className: css.heading, children: t('title') }), _jsx("p", { className: css.intro, children: t('intro') }), view.status === 'loading' && _jsx("p", { className: css.status, children: t('loading') }), view.status === 'error' && (_jsxs("div", { className: css.failure, children: [_jsxs("span", { children: [t('error'), ": ", view.message] }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => { setView({ status: 'loading' }); refresh(); }, children: t('retry') })] })), view.status === 'ready' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.roots, children: [_jsx("span", { className: css.rootsLabel, children: t('roots') }), view.catalog.roots.map(root => (_jsxs("span", { className: css.root, title: root.path, children: [_jsx(Tag, { tone: "neutral", children: sourceLabel(root.source, t) }), _jsx("code", { className: css.rank, children: root.rank })] }, root.path)))] }), _jsxs("p", { className: css.hint, title: view.catalog.installRoot, children: [t('installRoot'), ": ", view.catalog.installRoot] }), _jsxs("div", { className: css.agentsRoot, title: view.catalog.agentsRootPath, children: [_jsx(Switch, { checked: view.catalog.agentsRootEnabled, label: `${t('scanAgentsRoot')}: ${view.catalog.agentsRootPath}`, disabled: busy, onChange: toggleAgentsRoot }), _jsx("span", { className: css.agentsRootLabel, children: t('scanAgentsRoot') }), _jsx("code", { className: css.path, children: view.catalog.agentsRootPath })] }), _jsxs("div", { className: css.actions, children: [_jsx("input", { ref: fileInput, className: css.fileInput, type: "file", accept: ".md,text/markdown,.zip,application/zip", multiple: true, onChange: onFiles }), _jsx(Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => { fileInput.current?.click(); }, children: t('upload') }), _jsx(Button, { size: "sm", variant: "ghost", disabled: busy, onClick: refresh, children: t('refresh') }), _jsx(Checkbox, { checked: overwrite, onChange: setOverwrite, label: t('overwrite'), disabled: busy })] }), _jsx("p", { className: css.hint, children: t('uploadHint') }), _jsxs("div", { className: css.github, children: [_jsx(Input, { value: url, "aria-label": t('github'), placeholder: t('githubPlaceholder'), disabled: busy, onChange: (event) => { setUrl(event.target.value); } }), _jsx(Button, { size: "sm", variant: "outline", disabled: busy || url.trim().length === 0, onClick: runGitHub, children: t('githubAction') })] }), _jsx("p", { className: css.hint, children: t('toggleNote') }), notice !== undefined && (_jsx("p", { className: `${css.notice} ${notice.tone === 'ok' ? css.noticeOk : css.noticeError}`, children: notice.text })), view.catalog.skills.length === 0
                        ? _jsx("p", { className: css.status, children: t('empty') })
                        : (_jsx("ul", { className: css.list, children: view.catalog.skills.map(skill => (_jsxs("li", { className: css.row, "data-state": skill.state, children: [_jsxs("div", { className: css.rowMain, children: [_jsxs("div", { className: css.rowTitle, children: [_jsx("code", { className: css.name, children: skill.name }), skill.state === 'invalid' && _jsx(Tag, { tone: "warning", children: t('stateInvalid') }), skill.state === 'missing' && _jsx(Tag, { tone: "danger", children: t('stateMissing') })] }), _jsx("p", { className: css.description, children: skill.description.length > 0 ? skill.description : skill.error }), _jsxs("div", { className: css.meta, children: [_jsx(Tag, { tone: "neutral", children: sourceLabel(skill.source, t) }), _jsxs("span", { className: css.priority, children: [t('priority'), " ", skill.rank] }), _jsx("span", { className: css.path, title: skill.path, children: skill.path })] }), skill.duplicate && _jsx("p", { className: css.duplicate, children: t('duplicate') }), editor !== undefined && editor.path === skill.path && (_jsxs("div", { className: css.editor, children: [_jsxs("div", { className: css.editorHeader, children: [_jsx("span", { children: t('editor') }), _jsx("code", { className: css.name, children: skill.name }), _jsx("span", { className: css.path, title: skill.path, children: skill.path }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { setEditor(undefined); }, children: t('close') })] }), _jsx("textarea", { className: css.textarea, value: editor.content, spellCheck: false, "aria-label": `${t('editor')} ${skill.name}`, onChange: (event) => { setEditor({ ...editor, content: event.target.value }); } }), editor.error !== undefined && (_jsx("p", { className: css.inlineFailure, children: editor.error === 'conflict' ? t('conflict') : editor.error })), _jsxs("div", { className: css.editorActions, children: [_jsx(Button, { size: "sm", variant: "primary", disabled: busy, onClick: () => { saveEditor(editor); }, children: busy ? t('saving') : t('save') }), _jsx(Button, { size: "sm", variant: "ghost", disabled: busy, onClick: () => { setEditor(undefined); }, children: t('cancel') })] })] }))] }), _jsxs("div", { className: css.rowActions, children: [_jsx("span", { className: css.state, "data-enabled": skill.enabled ? 'true' : undefined, children: skill.enabled ? t('enabled') : t('disabled') }), _jsx(Switch, { checked: skill.enabled, label: `${skill.enabled ? t('toggleOff') : t('toggleOn')}: ${skill.name}`, disabled: busy || skill.state === 'invalid', onChange: (next) => { toggle(skill, next); } }), _jsx(Button, { size: "sm", variant: "ghost", disabled: busy || skill.state === 'missing', onClick: () => { openEditor(skill); }, children: t('edit') })] })] }, `${skill.name}:${skill.path}`))) }))] }))] }));
}
/** Render a byte count for a size complaint. */
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes.toString()} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
/**
 * Base64-encode one archive, chunked so a large bundle never overflows the
 * argument limit of `String.fromCharCode`.
 */
async function encodeBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
    }
    return btoa(binary);
}
function toView(outcome) {
    return outcome.ok
        ? { status: 'ready', catalog: outcome.value }
        : { status: 'error', message: outcome.error.message };
}
function sourceLabel(source, t) {
    const key = SOURCE_KEYS[source];
    return key === undefined ? source : t(key);
}
/** One-line outcome of an installation, in the active language. */
function describeInstall(value, t) {
    const parts = [];
    if (value.installed.length > 0)
        parts.push(`${t('installed')}: ${value.installed.join(', ')}`);
    const counts = new Map();
    for (const skipped of value.skipped)
        counts.set(skipped.reason, (counts.get(skipped.reason) ?? 0) + 1);
    for (const [reason, count] of counts)
        parts.push(`${t(SKIP_REASON_KEYS[reason])}: ${count.toString()}`);
    return parts.length === 0 ? t('empty') : parts.join(' · ');
}
//# sourceMappingURL=SkillManagerSection.js.map