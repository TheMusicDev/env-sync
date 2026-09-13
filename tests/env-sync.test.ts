import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseExample, parseEnv } from '../src/lib'
import { check } from '../src/check'
import { write } from '../src/write'
import { create } from '../src/create'

const tmp = mkdtempSync(join(import.meta.dir, '.tmp-'))
const root = join(tmp, 'mono')
const api = join(root, 'apps/api')
const workers = join(root, 'apps/workers')

function setup() {
    mkdirSync(join(api, 'subdir'), { recursive: true })
    mkdirSync(workers, { recursive: true })
    mkdirSync(join(root, 'node_modules'), { recursive: true })
    writeFileSync(join(root, '.env'), 'API_PORT=3000\nDATABASE_URL=mysql://root:pw@localhost/db\nHATCHET_TOKEN=tok\nUNUSED_ROOT=1\n')
    writeFileSync(
        join(api, '.env.example'),
        [
            '# apps/api config',
            '# .env.mapping',
            '# API_PORT',
            '# DATABASE_URL',
            '',
            'API_PORT=',
            'DATABASE_URL=',
            'LOG_LEVEL=debug',
        ].join('\n'),
    )
    writeFileSync(join(api, '.env'), 'API_PORT=old\nLOG_LEVEL=debug\nEXTRA_KEY=x\n')
    writeFileSync(
        join(workers, '.env.example'),
        ['# .env.mapping', '# HATCHET_TOKEN', '', 'HATCHET_TOKEN=', 'WORKER_CONCURRENCY=4'].join('\n'),
    )
    writeFileSync(join(root, 'node_modules', '.env.example'), '# .env.mapping\n# SHOULD_NOT_APPEAR\n')
    writeFileSync(join(root, '.env.example'), 'API_PORT=\n')
}
setup()
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

describe('parseExample', () => {
    test('header + body split', () => {
        const { header, body } = parseExample(
            '# .env.mapping\n# API_PORT\n# PORT=API_PORT\n\nAPI_PORT=\nLOG_LEVEL=debug\n',
        )
        expect(header).toEqual([
            { appVar: 'API_PORT', rootVar: 'API_PORT' },
            { appVar: 'PORT', rootVar: 'API_PORT' },
        ])
        expect(body.get('API_PORT')).toBe('')
        expect(body.get('LOG_LEVEL')).toBe('debug')
    })
    test('no marker → empty header, full body', () => {
        const { header, body } = parseExample('A=1\n# comment\nB=2\n')
        expect(header).toEqual([])
        expect(body.size).toBe(2)
    })
})

describe('parseEnv', () => {
    test('quotes + comments', () => {
        const m = parseEnv('# c\nA=1\nB="two words"\nC=\'x\'\nD=\n')
        expect(m.get('A')).toBe('1')
        expect(m.get('B')).toBe('two words')
        expect(m.get('C')).toBe('x')
        expect(m.get('D')).toBe('')
        expect(m.has('# c')).toBe(false)
    })
})

describe('check', () => {
    test('valid fixture: no errors, finds hand-added + unused root vars', async () => {
        const r = await check(root)
        expect(r.ok).toBe(true)
        expect(r.warnings.some((w) => w.includes('EXTRA_KEY'))).toBe(true)
        expect(r.info.some((i) => i.includes('UNUSED_ROOT'))).toBe(true)
        expect(r.errors).toEqual([])
    })

    test('header var missing in root → error', async () => {
        const bak = readFileSync(join(root, '.env'), 'utf8')
        writeFileSync(join(root, '.env'), 'API_PORT=3000\n')
        const r = await check(root)
        expect(r.ok).toBe(false)
        expect(r.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true)
        expect(r.errors.some((e) => e.includes('HATCHET_TOKEN'))).toBe(true)
        writeFileSync(join(root, '.env'), bak)
    })
})

describe('write', () => {
    test('syncs header vars, preserves local + extras', async () => {
        const r = await write(root)
        expect(r.ok).toBe(true)
        expect(r.errors).toEqual([])
        const apiEnv = readFileSync(join(api, '.env'), 'utf8')
        expect(apiEnv).toContain('API_PORT=3000')
        expect(apiEnv).toContain('DATABASE_URL=mysql://root:pw@localhost/db')
        expect(apiEnv).toContain('LOG_LEVEL=debug') // local value kept
        expect(apiEnv).toContain('EXTRA_KEY=x') // undeclared kept
        const wEnv = readFileSync(join(workers, '.env'), 'utf8')
        expect(wEnv).toContain('HATCHET_TOKEN=tok')
        expect(wEnv).toContain('WORKER_CONCURRENCY=4')
        // node_modules excluded
        expect(r.written.some((w) => w.path.includes('node_modules'))).toBe(false)
        const res = r.written.find((w) => w.path.includes('apps/api'))!
        expect(res.updated).toContain('API_PORT')
        expect(res.added).toContain('DATABASE_URL')
        expect(res.preservedExtras).toContain('EXTRA_KEY')
    })

    test('write aborts file when header var missing in root', async () => {
        const bak = readFileSync(join(root, '.env'), 'utf8')
        writeFileSync(join(root, '.env'), 'API_PORT=3000\n')
        const before = readFileSync(join(workers, '.env'), 'utf8')
        const r = await write(root)
        expect(r.ok).toBe(false)
        expect(readFileSync(join(workers, '.env'), 'utf8')).toBe(before) // untouched
        writeFileSync(join(root, '.env'), bak)
    })
})

describe('create', () => {
    test('scaffolds union of headers, skips existing', async () => {
        const r = await create(root)
        expect(r.ok).toBe(true)
        expect(r.created.length).toBe(0) // both exist already
        expect(r.skipped.length).toBe(2)
        rmSync(join(root, '.env.example'))
        rmSync(join(root, '.env'))
        const r2 = await create(root)
        expect(r2.created.length).toBe(2)
        const text = readFileSync(join(root, '.env.example'), 'utf8')
        for (const k of ['API_PORT=', 'DATABASE_URL=', 'HATCHET_TOKEN=']) {
            expect(text).toContain(k)
        }
        expect(text).not.toContain('LOG_LEVEL') // local vars never enter root
        expect(text).not.toContain('UNUSED_ROOT')
    })
})