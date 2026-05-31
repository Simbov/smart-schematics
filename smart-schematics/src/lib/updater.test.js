import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock fns so the vi.mock factories below can reference them.
const h = vi.hoisted(() => ({
  check: vi.fn(),
  ask: vi.fn(),
  message: vi.fn(),
  relaunch: vi.fn(),
}))

// Pretend we're inside Tauri so the bridge calls run.
vi.mock('./tauriFs', () => ({ isRunningInTauri: () => true }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: h.check }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: h.ask, message: h.message }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: h.relaunch }))

import { checkForUpdates } from './updater'

beforeEach(() => {
  h.check.mockReset()
  h.ask.mockReset()
  h.message.mockReset()
  h.relaunch.mockReset()
})

describe('checkForUpdates', () => {
  it('stays quiet when already up to date and silent', async () => {
    h.check.mockResolvedValue(null)
    await checkForUpdates({ silent: true })
    expect(h.ask).not.toHaveBeenCalled()
    expect(h.message).not.toHaveBeenCalled()
  })

  it('reports "latest version" when up to date and not silent', async () => {
    h.check.mockResolvedValue(null)
    await checkForUpdates({ silent: false })
    expect(h.message).toHaveBeenCalledTimes(1)
    expect(h.message.mock.calls[0][1]).toMatchObject({ kind: 'info' })
  })

  it('downloads, installs and relaunches when the user confirms', async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined)
    h.check.mockResolvedValue({
      version: '0.0.3',
      currentVersion: '0.0.2',
      body: 'Bug fixes',
      downloadAndInstall,
    })
    h.ask.mockResolvedValue(true)

    await checkForUpdates({ silent: true })

    expect(h.ask).toHaveBeenCalledTimes(1)
    expect(downloadAndInstall).toHaveBeenCalledTimes(1)
    expect(h.relaunch).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the user declines the update', async () => {
    const downloadAndInstall = vi.fn()
    h.check.mockResolvedValue({
      version: '0.0.3',
      currentVersion: '0.0.2',
      downloadAndInstall,
    })
    h.ask.mockResolvedValue(false)

    await checkForUpdates({ silent: true })

    expect(downloadAndInstall).not.toHaveBeenCalled()
    expect(h.relaunch).not.toHaveBeenCalled()
  })

  it('surfaces an error dialog on failure when not silent', async () => {
    h.check.mockRejectedValue(new Error('network down'))
    await checkForUpdates({ silent: false })
    expect(h.message).toHaveBeenCalledTimes(1)
    expect(h.message.mock.calls[0][1]).toMatchObject({ kind: 'error' })
  })

  it('swallows errors silently on the startup check', async () => {
    h.check.mockRejectedValue(new Error('network down'))
    await checkForUpdates({ silent: true })
    expect(h.message).not.toHaveBeenCalled()
  })
})
