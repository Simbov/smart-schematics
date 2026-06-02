// In-app auto-update via tauri-plugin-updater. Like tauriFs.js, every Tauri
// call is lazily imported and guarded by isRunningInTauri() so the app stays
// runnable in a plain browser (npm run dev without Tauri).

import { isRunningInTauri } from './tauriFs'

// The update prompt is shown in a NATIVE OS dialog (Tauri `ask`), which does not
// scroll and grows with its text — so a long changelog pushes the Update/Later
// buttons off-screen. Cap the notes embedded in the prompt to a few short lines
// so the buttons are always reachable; the full notes live on the releases page
// and in CHANGELOG.md.
export const MAX_NOTE_LINES = 8
export const MAX_NOTE_CHARS = 480

export function buildUpdatePrompt(version, currentVersion, body) {
  const header =
    `Smart Schematics ${version} is available (you have ${currentVersion}).`

  let notes = (body || '').trim()
  let truncated = false
  if (notes) {
    const lines = notes.split('\n')
    if (lines.length > MAX_NOTE_LINES) {
      notes = lines.slice(0, MAX_NOTE_LINES).join('\n')
      truncated = true
    }
    if (notes.length > MAX_NOTE_CHARS) {
      notes = notes.slice(0, MAX_NOTE_CHARS).trimEnd()
      truncated = true
    }
    if (truncated) notes += '\n…  (see the full changelog on the releases page)'
  }

  const notesBlock = notes ? `\n\n${notes}` : ''
  return `${header}${notesBlock}\n\nDownload and install now?`
}

// Checks the GitHub Releases endpoint for a newer signed build. When one is
// found the user is asked to confirm; on confirm we download, install, and
// relaunch. Pass { silent: false } for a user-initiated check so that "no
// update" and errors surface a dialog instead of staying quiet.
export async function checkForUpdates({ silent = true } = {}) {
  if (!isRunningInTauri()) return

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()

    if (!update) {
      if (!silent) {
        const { message } = await import('@tauri-apps/plugin-dialog')
        await message("You're running the latest version.", {
          title: 'Smart Schematics',
          kind: 'info',
        })
      }
      return
    }

    const { ask } = await import('@tauri-apps/plugin-dialog')
    const ok = await ask(
      buildUpdatePrompt(update.version, update.currentVersion, update.body),
      {
        title: 'Update available',
        kind: 'info',
        okLabel: 'Update',
        cancelLabel: 'Later',
      },
    )
    if (!ok) return

    await update.downloadAndInstall()

    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch (err) {
    console.error('Update check failed:', err)
    if (!silent) {
      const { message } = await import('@tauri-apps/plugin-dialog')
      await message(`Could not check for updates.\n\n${err}`, {
        title: 'Update',
        kind: 'error',
      })
    }
  }
}
