import { describe, it, expect, vi } from 'vitest'
import { readTextFileWithRetry } from './tauriFs'

describe('readTextFileWithRetry', () => {
  it('returns the content on the first successful read', async () => {
    const read = vi.fn().mockResolvedValue('{"ok":true}')
    const out = await readTextFileWithRetry('/x.scpro', { read, delayMs: 0 })
    expect(out).toBe('{"ok":true}')
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('retries on transient failure then succeeds (OneDrive placeholder hydrating)', async () => {
    const read = vi.fn()
      .mockRejectedValueOnce(new Error('not materialized'))
      .mockRejectedValueOnce(new Error('not materialized'))
      .mockResolvedValue('done')
    const out = await readTextFileWithRetry('/x.scpro', { tries: 4, delayMs: 0, read })
    expect(out).toBe('done')
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('throws the last error after exhausting all tries', async () => {
    const read = vi.fn().mockRejectedValue(new Error('gone'))
    await expect(
      readTextFileWithRetry('/x.scpro', { tries: 3, delayMs: 0, read }),
    ).rejects.toThrow('gone')
    expect(read).toHaveBeenCalledTimes(3)
  })
})
