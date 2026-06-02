// Pure tree-building + drag-validation logic for the file-tree sidebar (Stage 6).
//
// The React components (FileTree.jsx / FileTreeNode.jsx) are thin renderers over
// these functions, so all the interesting logic is unit-tested here without a DOM.
//
// Data model (from Stage 1):
//   project.folders = [ { id, name, parentId: string|null } ]   // root = parentId null
//   drawings[]      = [ { id, name, folderId: string|null } ]   // root = folderId null
//
// A tree node is one of:
//   { type: 'folder',  id, name, children: Node[] }
//   { type: 'drawing', id, name }

// buildTree(project, drawings) -> Node[]  (the root-level nodes)
//
// Folders nest to arbitrary depth via parentId. Drawings attach to the folder
// named by their folderId (or root when folderId is null). Folders are listed
// before drawings at each level, each alphabetised by name for stable ordering.
// Orphaned references (folderId/parentId pointing at a missing folder, or a
// cycle) are treated as root so nothing silently disappears.
export function buildTree(project, drawings = []) {
  const folders = (project && project.folders) || []
  const folderById = new Map(folders.map(f => [f.id, f]))

  // Resolve each folder's effective parent: treat a missing parent or a parent
  // that forms a cycle as root (null) so every folder is reachable.
  const effectiveParent = new Map()
  for (const f of folders) {
    let parent = f.parentId
    if (parent != null) {
      // Walk up to detect a cycle or a dangling reference.
      const seen = new Set([f.id])
      let cursor = parent
      let valid = true
      while (cursor != null) {
        if (seen.has(cursor) || !folderById.has(cursor)) { valid = false; break }
        seen.add(cursor)
        cursor = folderById.get(cursor).parentId
      }
      if (!valid) parent = null
    }
    effectiveParent.set(f.id, parent ?? null)
  }

  // Build folder nodes keyed by id so we can attach children.
  const nodeById = new Map()
  for (const f of folders) {
    nodeById.set(f.id, { type: 'folder', id: f.id, name: f.name, children: [] })
  }

  const roots = []
  for (const f of folders) {
    const node = nodeById.get(f.id)
    const parentId = effectiveParent.get(f.id)
    if (parentId != null && nodeById.has(parentId)) {
      nodeById.get(parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Attach drawings to their folder (or root). A folderId pointing at a missing
  // folder falls back to root.
  for (const d of drawings) {
    const node = { type: 'drawing', id: d.id, name: d.name }
    const fid = d.folderId ?? null
    if (fid != null && nodeById.has(fid)) {
      nodeById.get(fid).children.push(node)
    } else {
      roots.push(node)
    }
  }

  sortNodes(roots)
  return roots
}

// Folders first, then drawings; each group alphabetised (case-insensitive).
function sortNodes(nodes) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  })
  for (const n of nodes) {
    if (n.children) sortNodes(n.children)
  }
}

// findNode(tree, id) -> Node | null  (depth-first search across the node array)
export function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const hit = findNode(n.children, id)
      if (hit) return hit
    }
  }
  return null
}

// isDescendant(tree, ancestorId, maybeDescendantId) -> boolean
// True when maybeDescendantId sits anywhere inside the subtree rooted at ancestorId.
export function isDescendant(nodes, ancestorId, maybeDescendantId) {
  const ancestor = findNode(nodes, ancestorId)
  if (!ancestor || !ancestor.children) return false
  return !!findNode(ancestor.children, maybeDescendantId)
}

// canMove(tree, dragId, dropId) -> boolean
//
// Validates an HTML5 drag-drop re-parent before it touches the store:
//   - dropId === null  -> dropping onto root: always allowed.
//   - dragging onto itself              -> rejected.
//   - dragging a folder onto one of its own descendants -> rejected (would cycle).
//   - dropping a folder/drawing into a drawing node      -> rejected (drawings
//     can't contain children).
// Anything else is a valid move.
export function canMove(nodes, dragId, dropId) {
  if (dragId == null) return false
  if (dropId == null) return true // drop to root
  if (dragId === dropId) return false

  const dropNode = findNode(nodes, dropId)
  if (!dropNode) return false
  if (dropNode.type !== 'folder') return false // can only drop into a folder

  const dragNode = findNode(nodes, dragId)
  if (!dragNode) return false

  // A folder can't move into its own descendant.
  if (dragNode.type === 'folder' && isDescendant(nodes, dragId, dropId)) return false

  return true
}
