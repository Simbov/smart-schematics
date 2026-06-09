import { describe, it, expect, beforeEach, vi } from 'vitest'
import useSchematicStore from './schematicStore'

// Save-safety regression suite. The reported data-loss bug: creating a New
// Project left the global currentFilePath pointing at the previously-open
// project's file, so the next autosave overwrote 2 days of work with a blank
// project. The fix gives every project its OWN filePath and makes
// currentFilePath a mirror of the active project's path.

function installMockLocalStorage() {
  const map = new Map()
  vi.stubGlobal('localStorage', {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, val) => { map.set(key, String(val)) },
    removeItem: key => { map.delete(key) },
    clear: () => map.clear(),
  })
}

const store = () => useSchematicStore.getState()
const setState = patch => useSchematicStore.setState(patch)

// Pretend the active project was loaded from disk by stamping a filePath on it.
function bindActiveProjectTo(path) {
  const { projects, activeProjectId } = store()
  setState({
    projects: projects.map(p => (p.id === activeProjectId ? { ...p, filePath: path } : p)),
    currentFilePath: path,
  })
}

describe('save safety — per-project file paths', () => {
  beforeEach(() => {
    installMockLocalStorage()
    // Reset the singleton store so projects don't accumulate across tests.
    setState({ projects: [], drawings: [], activeProjectId: null, activeDrawingId: null, currentFilePath: null })
    store().newProject('Project A')
  })

  it('newProject clears currentFilePath so it cannot overwrite the prior file', () => {
    bindActiveProjectTo('/disk/ProjectA.scpro')
    expect(store().currentFilePath).toBe('/disk/ProjectA.scpro')

    // The dangerous action: make a brand-new project.
    store().newProject('Project B')

    // The new project must NOT inherit A's file path.
    expect(store().currentFilePath).toBeNull()
    const active = store().projects.find(p => p.id === store().activeProjectId)
    expect(active.name).toBe('Project B')
    expect(active.filePath).toBeNull()
  })

  it('the prior project keeps its own filePath after a new project is made', () => {
    bindActiveProjectTo('/disk/ProjectA.scpro')
    const aId = store().activeProjectId
    store().newProject('Project B')

    const a = store().projects.find(p => p.id === aId)
    expect(a.filePath).toBe('/disk/ProjectA.scpro')
  })

  it('setActiveProject mirrors the activated project’s own filePath', () => {
    bindActiveProjectTo('/disk/ProjectA.scpro')
    const aId = store().activeProjectId
    store().newProject('Project B') // currentFilePath now null

    store().setActiveProject(aId)
    expect(store().currentFilePath).toBe('/disk/ProjectA.scpro')
  })

  it('switching to an unsaved project clears currentFilePath', () => {
    bindActiveProjectTo('/disk/ProjectA.scpro')
    const aId = store().activeProjectId
    store().newProject('Project B') // unsaved (filePath null)
    const bId = store().activeProjectId

    store().setActiveProject(aId)
    expect(store().currentFilePath).toBe('/disk/ProjectA.scpro')
    store().setActiveProject(bId)
    expect(store().currentFilePath).toBeNull()
  })

  it('_buildProjectSnapshot never serializes the runtime filePath into the file', () => {
    bindActiveProjectTo('/disk/ProjectA.scpro')
    const snap = store()._buildProjectSnapshot()
    expect(snap).toBeTruthy()
    expect('filePath' in snap).toBe(false)
    expect(snap.version).toBe(4)
  })

  it('deleteProject points currentFilePath at the surviving project', () => {
    bindActiveProjectTo('/disk/ProjectA.scpro')
    const aId = store().activeProjectId
    store().newProject('Project B')
    bindActiveProjectTo('/disk/ProjectB.scpro')
    const bId = store().activeProjectId

    store().deleteProject(bId)
    // Active falls back to a remaining project; its path drives currentFilePath.
    const active = store().projects.find(p => p.id === store().activeProjectId)
    expect(active.id).toBe(aId)
    expect(store().currentFilePath).toBe('/disk/ProjectA.scpro')
  })
})
