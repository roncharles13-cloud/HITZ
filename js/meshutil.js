import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collapse a character's static opaque meshes into ONE mesh per material to cut
// draw calls. Left untouched so they can still animate / sort correctly:
//   • sub-groups (e.g. the stick) and lights — not meshes
//   • transparent decals (jersey numbers, visor)
//   • anything tagged userData.noMerge
//
// Each kept child keeps its reference (so this.stickMesh etc. stay valid).
export function mergeStaticBody(group) {
  const keep  = [];
  const byMat = new Map();

  for (const child of group.children) {
    const mergeable =
      child.isMesh &&
      child.material && !Array.isArray(child.material) &&
      !child.material.transparent &&
      !child.userData.noMerge;

    if (!mergeable) { keep.push(child); continue; }

    child.updateMatrix();
    const geo = child.geometry.clone();
    geo.applyMatrix4(child.matrix);                 // bake local transform into verts
    if (!byMat.has(child.material)) byMat.set(child.material, []);
    byMat.get(child.material).push(geo);
  }

  group.clear();
  for (const k of keep) group.add(k);

  for (const [mat, geos] of byMat) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (merged) {
      group.add(new THREE.Mesh(merged, mat));       // 1 draw call for this material
    } else {
      geos.forEach(g => group.add(new THREE.Mesh(g, mat)));  // safety fallback
    }
  }
}

// Free GPU buffers for a mesh subtree before dropping it — scene.remove() alone
// only unlinks the Object3D graph, it never calls geometry/material/texture
// .dispose(), so repeated buildGame() calls (replay without a page reload) leak
// VRAM. Call this on anything torn down mid-session (old puck/player/goalie).
export function disposeObject3D(root) {
  root.traverse(obj => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
        m[key]?.dispose();
      }
      m.dispose();
    }
  });
}
