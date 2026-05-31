// In-app auto-update via tauri-plugin-updater. Like tauriFs.js, every Tauri
// call is lazily imported and guarded by isRunningInTauri() so the app stays
// runnable in a plain browser (npm run dev without Tauri).

import { isRunningInTauri } from './tauriFs'

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
    const notes = update.body ? `\n\n${update.body}` : ''
    const ok = await ask(
      `Smart Schematics ${update.version} is available ` +
        `(you have ${update.currentVersion}).${notes}\n\nDownload and install now?`,
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
