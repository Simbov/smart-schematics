import { describe, it, expect, beforeEach } from 'vitest'
import { buildTree, findNode, isDescendant, canMove } from './fileTree'
import useSchematicStore from '../store/schematicStore'

describe('fileTree.buildTree', () => {
  it('nests folders to arbitrary depth and attaches drawings', () => {
    const project = {
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: 'b', name: 'B', parentId: 'a' },
        { id: 'c', name: 'C', parentId: 'b' },
      ],
    }
    const drawings = [
      { id: 'd1', name: 'deep', folderId: 'c' },
      { id: 'd2', name: 'mid', folderId: 'b' },
    ]
    const tree = buildTree(project, drawings)
    expect(tree).toHaveLength(1)
    const a = tree[0]
    expect(a).toMatchObject({ type: 'folder', id: 'a' })
    const b = a.children.find(n => n.id === 'b')
    expect(b.type).toBe('folder')
    const c = b.children.find(n => n.id === 'c')
    expect(c.type).toBe('folder')
    // deep drawing sits inside c, mid inside b
    expect(c.children.map(n => n.id)).toContain('d1')
    expect(b.children.map(n => n.id)).toContain('d2')
  })

  it('places drawings with folderId null at the root', () => {
    const project = { folders: [{ id: 'a', name: 'A', parentId: null }] }
    const drawings = [
      { id: 'root1', name: 'Root Drawing', folderId: null },
      { id: 'root2', name: 'Another', folderId: undefined },
      { id: 'inA', name: 'In A', folderId: 'a' },
    ]
    const tree = buildTree(project, drawings)
    const rootDrawingIds = tree.filter(n => n.type === 'drawing').map(n => n.id)
    expect(rootDrawingIds).toEqual(expect.arrayContaining(['root1', 'root2']))
    expect(rootDrawingIds).not.toContain('inA')
  })

  it('treats dangling/cyclic folder references as root', () => {
    const project = {
      folders: [
        { id: 'x', name: 'X', parentId: 'missing' }, // dangling parent
        { id: 'y', name: 'Y', parentId: 'z' },        // cycle y<->z
        { id: 'z', name: 'Z', parentId: 'y' },
      ],
    }
    const tree = buildTree(project, [])
    // all three end up as roots rather than vanishing
    expect(tree.map(n => n.id).sort()).toEqual(['x', 'y', 'z'])
  })

  it('sorts folders before drawings', () => {
    const project = { folders: [{ id: 'zf', name: 'Zeta', parentId: null }] }
    const drawings = [
      { id: 'a', name: 'apple', folderId: null },
    ]
    const tree = buildTree(project, drawings)
    expect(tree[0].type).toBe('folder') // folder first despite name "Zeta"
    expect(tree[1].id).toBe('a')
  })

  it('keeps the user order within each group — NOT alphabetical (manual ordering)', () => {
    const project = { folders: [
      { id: 'f2', name: 'Beta', parentId: null },
      { id: 'f1', name: 'Alpha', parentId: null },
    ] }
    const drawings = [
      { id: 'd2', name: 'zebra', folderId: null },
      { id: 'd1', name: 'apple', folderId: null },
    ]
    const tree = buildTree(project, drawings)
    // Folders keep project.folders order; drawings keep the given (drawingIds) order.
    expect(tree.map(n => n.id)).toEqual(['f2', 'f1', 'd2', 'd1'])
  })

  it('handles an empty/absent project safely', () => {
    expect(buildTree(null, [])).toEqual([])
    expect(buildTree({}, [{ id: 'd', name: 'd', folderId: null }])).toHaveLength(1)
  })
})

describe('fileTree.canMove + helpers', () => {
  const project = {
    folders: [
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: 'a' },
    ],
  }
  const drawings = [{ id: 'd1', name: 'd1', folderId: 'a' }]
  const tree = buildTree(project, drawings)

  it('findNode locates nested nodes', () => {
    expect(findNode(tree, 'b').id).toBe('b')
    expect(findNode(tree, 'd1').type).toBe('drawing')
    expect(findNode(tree, 'nope')).toBeNull()
  })

  it('isDescendant detects ancestry', () => {
    expect(isDescendant(tree, 'a', 'b')).toBe(true)
    expect(isDescendant(tree, 'a', 'd1')).toBe(true)
    expect(isDescendant(tree, 'b', 'a')).toBe(false)
  })

  it('rejects dropping a node onto itself', () => {
    expect(canMove(tree, 'a', 'a')).toBe(false)
  })

  it('rejects dropping a folder into its own descendant', () => {
    expect(canMove(tree, 'a', 'b')).toBe(false)
  })

  it('rejects dropping into a drawing node', () => {
    expect(canMove(tree, 'a', 'd1')).toBe(false)
  })

  it('allows valid moves and drop-to-root', () => {
    expect(canMove(tree, 'b', null)).toBe(true) // b -> root
    expect(canMove(tree, 'd1', 'b')).toBe(true) // drawing into subfolder
  })
})

// Store-level checks that the tree relies on (moveDrawingToFolder updating
// folderId; deleting a folder re-parents children to root). Drives the store via
// getState/setState per project conventions.
describe('fileTree store integration', () => {
  beforeEach(() => {
    const store = useSchematicStore.getState()
    store.newProject('Tree Test')
  })

  it('moveDrawingToFolder updates the drawing folderId and the tree shape', () => {
    const store = useSchematicStore.getState()
    const fid = store.addFolder('Folder 1', null)
    const drawingId = useSchematicStore.getState().activeDrawingId
    useSchematicStore.getState().moveDrawingToFolder(drawingId, fid)

    const { drawings, projects, activeProjectId } = useSchematicStore.getState()
    const moved = drawings.find(d => d.id === drawingId)
    expect(moved.folderId).toBe(fid)

    const project = projects.find(p => p.id === activeProjectId)
    const projectDrawings = project.drawingIds.map(id => drawings.find(d => d.id === id))
    const tree = buildTree(project, projectDrawings)
    const folderNode = findNode(tree, fid)
    expect(folderNode.children.map(n => n.id)).toContain(drawingId)
  })

  it('deleteFolder re-parents its drawings (and descendant folders) to root', () => {
    const store = useSchematicStore.getState()
    const parent = store.addFolder('Parent', null)
    const child = useSchematicStore.getState().addFolder('Child', parent)
    const drawingId = useSchematicStore.getState().activeDrawingId
    useSchematicStore.getState().moveDrawingToFolder(drawingId, child)

    useSchematicStore.getState().deleteFolder(parent)

    const { drawings, projects, activeProjectId } = useSchematicStore.getState()
    const project = projects.find(p => p.id === activeProjectId)
    // both folders gone
    expect(project.folders.find(f => f.id === parent)).toBeUndefined()
    expect(project.folders.find(f => f.id === child)).toBeUndefined()
    // drawing re-parented to root
    const moved = drawings.find(d => d.id === drawingId)
    expect(moved.folderId).toBeNull()

    const projectDrawings = project.drawingIds.map(id => drawings.find(d => d.id === id))
    const tree = buildTree(project, projectDrawings)
    expect(tree.map(n => n.id)).toContain(drawingId)
  })

  it('moveFolder re-parents and rejects cycles', () => {
    const store = useSchematicStore.getState()
    const a = store.addFolder('A', null)
    const b = useSchematicStore.getState().addFolder('B', null)
    // move b into a
    useSchematicStore.getState().moveFolder(b, a)
    let project = useSchematicStore.getState().projects.find(p => p.id === useSchematicStore.getState().activeProjectId)
    expect(project.folders.find(f => f.id === b).parentId).toBe(a)
    // attempting to move a into b (its descendant) is a no-op
    useSchematicStore.getState().moveFolder(a, b)
    project = useSchematicStore.getState().projects.find(p => p.id === useSchematicStore.getState().activeProjectId)
    expect(project.folders.find(f => f.id === a).parentId).toBeNull()
  })
})

// Manual ordering (PLC release batch 2): a drawing dropped on another drawing is
// inserted before it in project.drawingIds (and adopts its folder).
describe('fileTree store integration — reorderDrawing', () => {
  beforeEach(() => {
    useSchematicStore.getState().newProject('Reorder Test')
  })

  function ids() {
    const s = useSchematicStore.getState()
    return s.projects.find(p => p.id === s.activeProjectId).drawingIds
  }

  it('moves the dragged drawing immediately before the target', () => {
    const s = useSchematicStore.getState()
    s.newDrawing() // d2
    useSchematicStore.getState().newDrawing() // d3
    const [d1, d2, d3] = ids()
    useSchematicStore.getState().reorderDrawing(d3, d1)
    expect(ids()).toEqual([d3, d1, d2])
  })

  it('adopts the target drawing folder when reordering across folders', () => {
    const s = useSchematicStore.getState()
    const fid = s.addFolder('F', null)
    useSchematicStore.getState().newDrawing(fid)        // d2 inside F
    const [d1, d2] = ids()
    useSchematicStore.getState().reorderDrawing(d1, d2) // drop d1 onto d2
    expect(ids()).toEqual([d1, d2])
    const moved = useSchematicStore.getState().drawings.find(d => d.id === d1)
    expect(moved.folderId).toBe(fid)
  })

  it('is a no-op for self-drops and unknown ids', () => {
    const [d1] = ids()
    useSchematicStore.getState().reorderDrawing(d1, d1)
    useSchematicStore.getState().reorderDrawing(d1, 'nope')
    useSchematicStore.getState().reorderDrawing(null, d1)
    expect(ids()).toEqual([d1])
  })
})
