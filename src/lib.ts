// ponytail: hand-rolled parsers — .env format is tiny, not worth a dependency
import { readdir } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'

export const MAPPING_MARKER = '# .env.mapping'

export type Mapping = { appVar: string; rootVar: string }

export type ExampleFile = {
    dir: string
    path: string
    header: Mapping[]
    body: Map<string, string> // declared vars (template values), file order
}

/** Parse a .env.example: mapping header (consecutive comment lines after the
 * marker, ended by blank line) + body KEY=VALUE entries. */
export function parseExample(text: string): Pick<ExampleFile, 'header' | 'body'> {
    const lines = text.split('\n')
    const header: Mapping[] = []
    let i = 0
    while (i < lines.length && lines[i].trim() !== MAPPING_MARKER) i++
    if (i < lines.length) {
        i++ // past marker
        while (i < lines.length) {
            const line = lines[i].trim()
            if (line === '' || !line.startsWith('#')) break // blank/non-comment ends header
            const entry = line.slice(1).trim()
            if (entry === '') break
            const eq = entry.indexOf('=')
            if (eq === -1) {
                header.push({ appVar: entry, rootVar: entry })
            } else {
                const appVar = entry.slice(0, eq).trim()
                const rootVar = entry.slice(eq + 1).trim() || appVar
                header.push({ appVar, rootVar })
            }
            i++
        }
    }
    const body = new Map<string, string>()
    for (const line of lines) {
        const t = line.trim()
        if (t === '' || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        body.set(t.slice(0, eq).trim(), t.slice(eq + 1))
    }
    return { header, body }
}

/** Parse a real .env into key→value (quotes stripped, comments ignored). */
export function parseEnv(text: string): Map<string, string> {
    const out = new Map<string, string>()
    for (const line of text.split('\n')) {
        const t = line.trim()
        if (t === '' || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        let v = t.slice(eq + 1).trim()
        if (
            (v.startsWith('"') && v.endsWith('"') && v.length > 1) ||
            (v.startsWith("'") && v.endsWith("'") && v.length > 1)
        ) {
            v = v.slice(1, -1)
        }
        out.set(t.slice(0, eq).trim(), v)
    }
    return out
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.turbo'])

/** Find every .env.example under root, excluding the root's own aggregate files. */
export async function findExamples(root: string): Promise<ExampleFile[]> {
    const entries = await readdir(root, { recursive: true, withFileTypes: true })
    const out: ExampleFile[] = []
    for (const e of entries) {
        if (!e.isFile() || e.name !== '.env.example') continue
        // ponytail: bun returns absolute parentPath, node returns it relative — handle both
        const parent = e.parentPath ?? ''
        const dir = isAbsolute(parent) ? parent : join(root, parent)
        if (dir === root) continue // root's own aggregate example
        if (relative(root, dir).split(sep).some((s) => SKIP_DIRS.has(s))) continue
        const path = join(dir, e.name)
        const text = await Bun.file(path).text()
        out.push({
            dir,
            path,
            ...parseExample(text),
        })
    }
    return out.sort((a, b) => (a.path < b.path ? -1 : 1))
}

/** Load the root .env at repo root. */
export async function loadRootEnv(root: string): Promise<Map<string, string> | null> {
    const path = join(root, '.env')
    const f = Bun.file(path)
    if (!(await f.exists())) return null
    return parseEnv(await f.text())
}

export function relPath(root: string, p: string): string {
    return relative(root, p)
}