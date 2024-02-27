
import { TreeNode } from "./canvas-tree";

const ROWSPACING = 75;
const COLSPACING = 20;

/* 
tree-layout.js implements the extended Reingold-Tilford algorithm as described 
in the paper "Drawing Non-layered Tidy Trees in Linear Time" by Atze van der Ploeg
*/

export function layoutTree(tree: TreeNode): void {
  firstWalk(tree);
  secondWalk(tree, 0);
}

function firstWalk(tree: TreeNode): void {
  if (tree.children.length === 0) {
    setExtremes(tree);
    return;
  }
  firstWalk(tree.children[0]);
  // Create siblings in contour minimal vertical coordinate
  // and index list.
  let indexHighest = updateIndexYLowest(
    bottom(tree.children[0]._extremeLeft as TreeNode),
    0, null);
  for (let i = 1; i < tree.children.length; i++) {
    firstWalk(tree.children[i]);
    // Store lowest vertical coordinate while extreme nodes still
    // point in current subtree.
    let minY = bottom(tree.children[i]._extremeRight as TreeNode);
    separate(tree, i, indexHighest);
    indexHighest = updateIndexYLowest(minY, i, indexHighest);
  }
  positionRoot(tree);
  setExtremes(tree);
}

// Sets the subtree extremes
function setExtremes(tree: TreeNode) {
  if (tree.children.length === 0) {
    tree._extremeLeft = tree;
    tree._extremeRight = tree;
    tree._modSumLeft = tree._modSumRight = 0;
  } else {
    tree._extremeLeft = tree.children[0]._extremeLeft;
    tree._modSumLeft = tree.children[0]._modSumLeft;
    tree._extremeRight = tree.children[tree.children.length - 1]._extremeRight;
    tree._modSumRight = tree.children[tree.children.length - 1]._modSumRight;
  }
}

function separate(tree: TreeNode, i: number, indexHighest: IndexYLowest) {
  // Right contour node of left siblings and its sum of modfiers.
  let subtreeRight: TreeNode | null = tree.children[i - 1];
  let modSumSubtreeRight = subtreeRight._modifierX;
  // Left contour node of current subtree and its sum of modfiers.
  let contourLeft: TreeNode | null = tree.children[i];
  let modSumContourLeft = contourLeft._modifierX;
  while (subtreeRight && contourLeft) {
    if (bottom(subtreeRight) > indexHighest.lowY) {
      if (indexHighest.next !== null) {
        indexHighest = indexHighest.next;
      }
    }
    // How far to the left of the right side of sr is the left side of cl?
    let dist = (modSumSubtreeRight + subtreeRight._initialX + subtreeRight.width() + COLSPACING);
    dist = dist - (modSumContourLeft + contourLeft._initialX);
    if (dist > 0) {
      modSumContourLeft += dist;
      moveSubtree(tree, i, indexHighest.index, dist);
    }
    let subtreeY = bottom(subtreeRight);
    let contourY = bottom(contourLeft);
    // Advance highest node(s) and sum(s) of modifiers
    if (subtreeY <= contourY) {
      subtreeRight = nextRightContour(subtreeRight);
      if (subtreeRight !== null) {
        modSumSubtreeRight += subtreeRight._modifierX;
      }
    }
    if (subtreeY >= contourY) {
      contourLeft = nextLeftContour(contourLeft);
      if (contourLeft !== null) {
        modSumContourLeft += contourLeft._modifierX;
      }
    }
  }
  // Set threads and update extreme nodes.
  // In the first case, the current subtree must be taller than the left siblings.
  if (subtreeRight == null && contourLeft != null) {
    setLeftThread(tree, i, contourLeft, modSumContourLeft);
  }
  // In this case, the left siblings must be taller than the current subtree.
  else if (subtreeRight != null && contourLeft == null) {
    setRightThread(tree, i, subtreeRight, modSumSubtreeRight);
  }
}


function moveSubtree(tree: TreeNode, i: number, sourceIndex: number, dist: number) {
  // Move subtree by changing mod.
  tree.children[i]._modifierX += dist;
  tree.children[i]._modSumLeft += dist;
  tree.children[i]._modSumRight += dist;
  distributeExtra(tree, i, sourceIndex, dist);
}

function nextLeftContour(tree: TreeNode): TreeNode | null {
  if (tree.children.length === 0) {
    return tree._threadLeft;
  } else {
    return tree.children[0];
  }
}

function nextRightContour(tree: TreeNode): TreeNode | null {
  if (tree.children.length === 0) {
    return tree._threadRight;
  } else {
    return tree.children[tree.children.length - 1];
  }
}

function bottom(tree: TreeNode): number {
  return tree.y() + tree.height();
}

function setLeftThread(tree: TreeNode, i: number, contourLeft: TreeNode, modSumContourLeft: number): void {
  let leftIndex = tree.children[0]._extremeLeft!;
  leftIndex._threadLeft = contourLeft;
  // Change mod so that the sum of modifier after following thread is correct.
  let diff: number = (modSumContourLeft - contourLeft._modifierX);
  diff -= tree.children[0]._modSumLeft;
  leftIndex._modifierX += diff;
  // Change preliminary x coordinate so that the node does not move.
  leftIndex._initialX -= diff;
  // Update extreme node and its sum of modifiers.
  tree.children[0]._extremeLeft = tree.children[i]._extremeLeft;
  tree.children[0]._modSumLeft = tree.children[i]._modSumLeft;
}

// Symmetrical to setLeftThread.
function setRightThread(tree: TreeNode, i: number, subtreeRight: TreeNode, modSumSubtreeRight: number): void {
  let rightIndex = tree.children[i]._extremeRight!;
  rightIndex._threadRight = subtreeRight;
  let diff: number = (modSumSubtreeRight - subtreeRight._modifierX);
  diff -= tree.children[i]._modSumRight;
  rightIndex._modifierX += diff;
  rightIndex._initialX -= diff;
  tree.children[i]._extremeRight = tree.children[i - 1]._extremeRight;
  tree.children[i]._modSumRight = tree.children[i - 1]._modSumRight;
}

function positionRoot(tree: TreeNode): void {
  // Position root between children, taking into account their mod.
  tree._initialX = tree.children[0]._initialX +
    tree.children[0]._modifierX +
    tree.children[tree.children.length - 1]._modifierX +
    tree.children[tree.children.length - 1]._initialX +
    (tree.children[tree.children.length - 1].width() + COLSPACING)
  tree._initialX = (tree._initialX / 2) - ((tree.width() + COLSPACING) / 2);
}

function secondWalk(tree: TreeNode, modSum: number): void {
  modSum += tree._modifierX;
  // Set absolute node position
  tree.xy(
    tree._initialX + modSum,
    tree.getDepth() * ROWSPACING
  );
  addChildSpacing(tree);
  for (let i = 0; i < tree.children.length; i++) {
    secondWalk(tree.children[i], modSum);
  }
}

function distributeExtra(tree: TreeNode, i: number, sourceIndex: number, dist: number): void {
  // Are there intermediate children?
  if (sourceIndex !== i - 1) {
    let numberRecipients: number = i - sourceIndex;
    tree.children[sourceIndex + 1]._shiftX += dist / numberRecipients;
    tree.children[i]._shiftX -= dist / numberRecipients;
    tree.children[i]._posChange -= dist - dist / numberRecipients;
  }
}


// Process change and shift to add intermediate spacing to mod.
function addChildSpacing(tree: TreeNode): void {
  let d = 0, modSumDelta = 0;
  tree.children.forEach((subTree) => {
    d += subTree._shiftX;
    modSumDelta += d + subTree._posChange;
    subTree._modifierX += modSumDelta;
  });
}

// A linked list of the indexes of left siblings and their 
// lowest vertical coordinate.
class IndexYLowest {
  lowY: number;
  index: number;
  next: IndexYLowest | null;

  constructor(lowY: number, index: number, next: IndexYLowest | null) {
    this.lowY = lowY;
    this.index = index;
    this.next = next;
  }
}

function updateIndexYLowest(minY: number, i: number, indexHighest: IndexYLowest | null): IndexYLowest {
  // Remove siblings that are hidden by the new subtree.
  while (indexHighest !== null && minY >= indexHighest.lowY) {
    indexHighest = indexHighest.next;
  }
  // Prepend the new subtree.
  return new IndexYLowest(minY, i, indexHighest);
}
