import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { findExamples, relPath } from './lib'

export type CreateResult = {
    ok: boolean
    errors: string[]
    created: string[]
    skipped: string[]
}

/** Scaffold root .env + .env.example from the union of all app mapping
 * headers (root names). Never overwrites existing root files. */
export async function create(root: string): Promise<CreateResult> {
    const errors: string[] = []
    const created: string[] = []
    const skipped: string[] = []

    const examples = await findExamples(root)
    if (examples.length === 0) {
        errors.push('no .env.example files found — nothing to scaffold from')
        return { ok: false, errors, created, skipped }
    }

    // union of root var names, first-seen order
    const rootVars = new Set<string>()
    for (const ex of examples) {
        for (const m of ex.header) rootVars.add(m.rootVar)
        if (ex.header.length === 0) {
            console.log(`ℹ ${relPath(root, ex.path)}: no mapping header — nothing to contribute`)
        }
    }
    if (rootVars.size === 0) {
        errors.push('all .env.example files lack a mapping header — nothing to scaffold from')
        return { ok: false, errors, created, skipped }
    }

    const content = [...rootVars].map((k) => `${k}=`).join('\n') + '\n'

    for (const [file, label] of [
        ['.env', 'root .env'],
        ['.env.example', 'root .env.example'],
    ] as const) {
        const p = join(root, file)
        if (existsSync(p)) {
            skipped.push(`${label} already exists at ${p} — left untouched`)
            continue
        }
        await writeFile(p, content, 'utf8')
        created.push(p)
    }

    return { ok: true, errors, created, skipped }
}

export function printCreate(r: CreateResult): void {
    for (const e of r.errors) console.log(`✗ ${e}`)
    for (const c of r.created) console.log(`✓ created ${c}`)
    for (const s of r.skipped) console.log(`ℹ ${s}`)
}