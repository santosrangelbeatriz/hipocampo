import { cpSync, copyFileSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.dirname(scriptsDirectory)
const publicRoot = path.join(projectRoot, 'public')
const outputRoot = path.join(projectRoot, 'dist')

rmSync(outputRoot, { force: true, recursive: true })
mkdirSync(outputRoot, { recursive: true })
copyFileSync(path.join(projectRoot, 'index.html'), path.join(outputRoot, 'index.html'))
cpSync(publicRoot, outputRoot, { recursive: true })

console.log('Build estático criado em ' + outputRoot)
