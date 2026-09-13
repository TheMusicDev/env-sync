#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import { check, printReport } from './check'
import { create, printCreate } from './create'
import { write, printWrite } from './write'

const checkCmd = defineCommand({
    meta: { name: 'check', description: 'Dry-run drift report. Exit 1 on errors.' },
    args: { root: { type: 'positional' as const, description: 'monorepo root (default: cwd)', required: false } },
    run({ args }) {
        return runCheck(args.root as string | undefined)
    },
})

async function runCheck(rootArg?: string) {
    const root = rootArg ?? process.cwd()
    const r = await check(root)
    printReport(r)
    if (!r.ok) process.exit(1)
}

const writeCmd = defineCommand({
    meta: { name: 'write', description: 'Regenerate per-app .env from root .env + mapping headers' },
    args: { root: { type: 'positional' as const, description: 'monorepo root (default: cwd)', required: false } },
    run({ args }) {
        return runWrite(args.root as string | undefined)
    },
})

async function runWrite(rootArg?: string) {
    const root = rootArg ?? process.cwd()
    const r = await write(root)
    printWrite(r)
    if (!r.ok) process.exit(1)
}

const createCmd = defineCommand({
    meta: { name: 'create', description: 'Scaffold root .env/.env.example from app mapping headers' },
    args: { root: { type: 'positional' as const, description: 'monorepo root (default: cwd)', required: false } },
    run({ args }) {
        return runCreate(args.root as string | undefined)
    },
})

async function runCreate(rootArg?: string) {
    const root = rootArg ?? process.cwd()
    const r = await create(root)
    printCreate(r)
    if (!r.ok) process.exit(1)
}

runMain(
    defineCommand({
        meta: {
            name: 'env-sync',
            version: '0.1.0',
            description: 'Sync monorepo root .env into per-app .env files (mapping headers in .env.example)',
        },
        subCommands: { check: checkCmd, write: writeCmd, create: createCmd },
    }),
)