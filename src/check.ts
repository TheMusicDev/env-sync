import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { findExamples, loadRootEnv, relPath, type ExampleFile } from './lib'

export type CheckResult = {
    ok: boolean
    errors: string[]
    warnings: string[]
    info: string[]
}

export async function check(root: string): Promise<CheckResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const info: string[] = []

    const rootEnv = await loadRootEnv(root)
    if (!rootEnv) {
        errors.push(`root .env not found at ${join(root, '.env')} — run env-sync create or add it manually`)
    }
    if (!existsSync(join(root, '.env.example'))) {
        info.push('root .env.example missing — run env-sync create to scaffold it')
    }

    const examples = await findExamples(root)
    if (examples.length === 0) info.push('no .env.example files found in apps/packages')

    const usedRootVars = new Set<string>()

    for (const ex of examples) {
        const seen = new Set<string>()
        for (const m of ex.header) {
            if (seen.has(m.appVar)) errors.push(`${relPath(root, ex.path)}: duplicate mapping for ${m.appVar}`)
            seen.add(m.appVar)
            usedRootVars.add(m.rootVar)
            if (rootEnv && !rootEnv.has(m.rootVar)) {
                errors.push(
                    `${relPath(root, ex.path)}: header var ${m.rootVar} missing in root .env`,
                )
            }
            if (!ex.body.has(m.appVar)) {
                warnings.push(
                    `${relPath(root, ex.path)}: ${m.appVar} in mapping but not declared in body`,
                )
            }
        }
        if (ex.header.length === 0) {
            info.push(`${relPath(root, ex.path)}: no mapping header — fully local`)
        }

        const envPath = join(ex.dir, '.env')
        if (existsSync(envPath)) {
            const current = await Bun.file(envPath).text()
            const currentKeys = parseKeys(current)
            for (const k of currentKeys) {
                if (!ex.body.has(k) && !seen.has(k)) {
                    warnings.push(
                        `${relPath(root, envPath)}: ${k} not declared in .env.example (hand-added?)`,
                    )
                }
            }
        } else {
            info.push(`${relPath(root, envPath)}: missing — run env-sync write`)
        }
    }

    if (rootEnv) {
        for (const k of rootEnv.keys()) {
            if (!usedRootVars.has(k)) info.push(`root .env: ${k} unused by any app mapping`)
        }
    }

    return { ok: errors.length === 0, errors, warnings, info }
}

function parseKeys(text: string): string[] {
    const keys: string[] = []
    for (const line of text.split('\n')) {
        const t = line.trim()
        if (t === '' || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq !== -1) keys.push(t.slice(0, eq).trim())
    }
    return keys
}

export function printReport(r: CheckResult): void {
    for (const e of r.errors) console.log(`✗ ${e}`)
    for (const w of r.warnings) console.log(`⚠ ${w}`)
    for (const i of r.info) console.log(`ℹ ${i}`)
    if (r.ok) {
        console.log(
            r.warnings.length === 0
                ? '✓ env contract OK'
                : '✓ no errors — see warnings above',
        )
    } else {
        console.log(`${r.errors.length} error(s) — run env-sync write after fixing`)
    }
}