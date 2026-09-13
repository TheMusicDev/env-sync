import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { findExamples, loadRootEnv, parseEnv, relPath } from './lib'

export type WriteResult = {
    ok: boolean
    errors: string[]
    written: { path: string; added: string[]; updated: string[]; preservedExtras: string[] }[]
}

/** Regenerate each app .env: header vars get root values (overwritten),
 * body vars keep their existing local value or fall back to the template,
 * undeclared extras are preserved and reported. */
export async function write(root: string): Promise<WriteResult> {
    const errors: string[] = []
    const written: WriteResult['written'] = []

    const rootEnv = await loadRootEnv(root)
    if (!rootEnv) {
        return {
            ok: false,
            errors: [`root .env not found at ${join(root, '.env')} — run env-sync create or add it manually`],
            written,
        }
    }

    const examples = await findExamples(root)
    for (const ex of examples) {
        // validate first — abort per file on missing root var, never half-write
        const seen = new Set<string>()
        let bad = false
        for (const m of ex.header) {
            if (seen.has(m.appVar)) {
                errors.push(`${relPath(root, ex.path)}: duplicate mapping for ${m.appVar}`)
                bad = true
            }
            seen.add(m.appVar)
            if (!rootEnv.has(m.rootVar)) {
                errors.push(`${relPath(root, ex.path)}: header var ${m.rootVar} missing in root .env`)
                bad = true
            }
        }
        if (bad) continue

        const envPath = join(ex.dir, '.env')
        const existing = existsSync(envPath)
            ? parseEnv(await Bun.file(envPath).text())
            : new Map<string, string>()

        const out: string[] = []
        if (ex.header.length > 0) out.push('# synced by env-sync from root .env — mapping in .env.example header')
        const added: string[] = []
        const updated: string[] = []
        for (const m of ex.header) {
            const v = rootEnv.get(m.rootVar)!
            if (!existing.has(m.appVar)) added.push(m.appVar)
            else if (existing.get(m.appVar) !== v) updated.push(m.appVar)
            out.push(`${m.appVar}=${v}`)
        }
        for (const [k, template] of ex.body) {
            if (seen.has(k)) continue // header var already written
            // local var: keep current machine value, else template
            const v = existing.has(k) ? existing.get(k)! : template
            if (!existing.has(k)) added.push(k)
            out.push(`${k}=${v}`)
        }
        const preservedExtras: string[] = []
        for (const [k, v] of existing) {
            if (seen.has(k) || ex.body.has(k)) continue
            if (preservedExtras.length === 0) {
                out.push('')
                out.push('# undeclared keys below — add them to .env.example to manage them here')
            }
            preservedExtras.push(k)
            out.push(`${k}=${v}`)
        }

        await Bun.write(envPath, out.join('\n') + '\n')
        written.push({ path: relPath(root, envPath), added, updated, preservedExtras })
    }

    return { ok: errors.length === 0, errors, written }
}

export function printWrite(r: WriteResult): void {
    for (const e of r.errors) console.log(`✗ ${e}`)
    for (const w of r.written) {
        const parts: string[] = []
        if (w.added.length) parts.push(`+${w.added.join(',')}`)
        if (w.updated.length) parts.push(`~${w.updated.join(',')}`)
        if (w.preservedExtras.length) parts.push(`kept: ${w.preservedExtras.join(',')}`)
        console.log(`✓ ${w.path}${parts.length ? ` (${parts.join('; ')})` : ''}`)
    }
    console.log(r.ok ? `done — ${r.written.length} file(s)` : `${r.errors.length} error(s)`)
}