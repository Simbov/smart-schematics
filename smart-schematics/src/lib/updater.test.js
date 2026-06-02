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

import { checkForUpdates, buildUpdatePrompt, MAX_NOTE_LINES, MAX_NOTE_CHARS } from './updater'

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

describe('buildUpdatePrompt', () => {
  it('keeps a short changelog verbatim and ends with the action question', () => {
    const msg = buildUpdatePrompt('0.1.0', '0.0.3', '### Added\n- One thing')
    expect(msg).toContain('Smart Schematics 0.1.0 is available (you have 0.0.3).')
    expect(msg).toContain('### Added\n- One thing')
    expect(msg).not.toContain('see the full changelog')
    expect(msg.trimEnd().endsWith('Download and install now?')).toBe(true)
  })

  it('truncates a changelog with too many lines and appends the marker', () => {
    const body = Array.from({ length: MAX_NOTE_LINES + 20 }, (_, i) => `line ${i}`).join('\n')
    const msg = buildUpdatePrompt('0.1.0', '0.0.3', body)
    const notesPart = msg.split('\n\n')[1]
    // body lines kept are capped, plus the ellipsis marker line
    expect(notesPart.split('\n').length).toBeLessThanOrEqual(MAX_NOTE_LINES + 1)
    expect(msg).toContain('see the full changelog on the releases page')
    expect(msg.trimEnd().endsWith('Download and install now?')).toBe(true)
  })

  it('truncates a changelog with too many characters', () => {
    const msg = buildUpdatePrompt('0.1.0', '0.0.3', 'x'.repeat(MAX_NOTE_CHARS + 200))
    expect(msg).toContain('see the full changelog')
    // notes block must not exceed the char cap (plus the marker)
    const notesPart = msg.split('\n\n')[1]
    expect(notesPart.length).toBeLessThan(MAX_NOTE_CHARS + 80)
  })

  it('omits the notes block entirely when there is no body', () => {
    const msg = buildUpdatePrompt('0.1.0', '0.0.3', '')
    expect(msg).toBe(
      'Smart Schematics 0.1.0 is available (you have 0.0.3).\n\nDownload and install now?',
    )
  })
})
