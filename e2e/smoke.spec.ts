import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

// A throwaway workspace whose agents run the plain shell, so the test needs no Claude account.
const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash'
let workspace: string
let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  workspace = mkdtempSync(join(tmpdir(), 'vandelay-e2e-'))
  mkdirSync(join(workspace, '.vandelay'))
  const agent = (id: string, name: string, extra = {}): object => ({ id, name, command: shell, args: [], cwd: '', color: '#3fd0ff', ...extra })
  writeFileSync(
    join(workspace, '.vandelay', 'agents.json'),
    JSON.stringify([agent('art', 'Art Vandelay', { orchestrator: true }), agent('kramer', 'Kramer'), agent('elaine', 'Elaine')])
  )
  app = await electron.launch({
    args: ['.'],
    env: { ...process.env, VANDELAY_WORKSPACE: workspace, VANDELAY_NO_UPDATES: '1' } as Record<string, string>
  })
  page = await app.firstWindow()
  // Skip the boot sequence, then close the first-run setup check.
  await page.waitForSelector('.boot, .app')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Got it' }).click()
})

test.afterAll(async () => {
  await app?.close()
  rmSync(workspace, { recursive: true, force: true })
})

test('shows the team', async () => {
  await expect(page).toHaveTitle(/Vandelay Agents/)
  await expect(page.locator('.unit')).toHaveCount(3)
  await expect(page.locator('.unit').first()).toContainText('Art Vandelay')
})

test('briefs everyone and logs the traffic', async () => {
  await page.locator('.composer select').selectOption({ label: 'To: Everyone' })
  await page.locator('#composer-input').fill('Stand-up in five')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.locator('.log li')).toHaveCount(3)
  await expect(page.locator('.log')).toContainText('Stand-up in five')
})

test('opens settings', async () => {
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()
})
