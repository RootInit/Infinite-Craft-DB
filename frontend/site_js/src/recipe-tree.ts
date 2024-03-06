import { fabric } from "fabric";
import {
  createTreeCanvasItem,
} from "./canvas-utils";
import { layoutTree } from "./tree-layout";

export interface TreeRow {
  ID: number;
  Text: string;
  Parent: number;
}

// Handle crafting tree canvas
export function newTree(canvas: fabric.Canvas, treeRows: TreeRow[]): TreeNode {
  // Find the root item
  const rootItemIndex = treeRows.findIndex(item => item.Parent == -1);
  if (rootItemIndex === -1) {
    throw new Error("Root item not found in array.")
  }
  const rootItemData = treeRows.splice(rootItemIndex, 1)[0];
  const rootCanvasObject = createTreeCanvasItem(canvas, rootItemData.Text)
  const rootNode = new TreeNode(rootItemData.Text, rootCanvasObject);

  // Recursive function to add children to the tree data structure 
  function addChildren(rootItem: TreeNode, rootItemId: number) {
    for (let i = 0; i < treeRows.length;) {
      let row = treeRows[i];
      if (row.Parent === rootItemId) {
        // Add the row as a tree child
        let newObject = createTreeCanvasItem(canvas, row.Text)
        let childNode = rootItem.addChild(row.Text, newObject);
        addChildren(childNode, row.ID);
        // Remove from the list.
        treeRows.splice(i, 1);
        // No need to increment due to splice
      } else {
        // Increment otherwise.
        i++;
      }
    }
    rootItem.object.on('mousedown', function() {
      rootItem.toggleChildVisability();
    });
  }
  addChildren(rootNode, rootItemData.ID);
  // Align nodes and draw connector lines
  rootNode.layoutNodes();
  rootNode.drawChildLines();
  return rootNode;
}

// data-structure to store a tree of canvas objects
export class TreeNode {
  text: string;
  object: fabric.Object;
  canvas: fabric.Canvas;
  parent: TreeNode | null = null;
  children: TreeNode[] = [];
  connectorLine: fabric.Object | null = null;
  // Position setting helper values
  _initialX: number = 0.0;
  _modifierX: number = 0.0;
  _shiftX: number = 0.0;
  _posChange: number = 0.0;
  _threadLeft: TreeNode | null = null;
  _threadRight: TreeNode | null = null;
  _extremeLeft: TreeNode | null = null;
  _extremeRight: TreeNode | null = null;
  _modSumLeft: number = 0.0;
  _modSumRight: number = 0.0;

  constructor(text: string, canvasObject: fabric.Object) {
    this.text = text;
    this.object = canvasObject;
    this.canvas = canvasObject.canvas!;
  }
  // Gets the x position of a node's object
  // Can also set the position by specifying a coordinate
  x(pos = -Infinity): number {
    if (pos !== -Infinity) {
      this.object.set({ left: pos });
    }
    pos = this.object.left!;
    return pos;
  }
  // Gets the y position of a node's object
  // Can also set the position by specifying a coordinate
  y(pos = -Infinity): number {
    if (pos !== -Infinity) {
      this.object.set({ top: pos });
    }
    pos = this.object.top!;
    return pos;
  }
  // Gets the [x, y] position of a node's object
  // Can also set the position by specifying coordinates
  xy(xPos = -Infinity, yPos = -Infinity): number[] {
    if (xPos != -Infinity && yPos != -Infinity) {
      this.object.set({
        left: xPos,
        top: yPos
      });
    }
    return [this.x(), this.y()];
  }
  // Gets the width of a node's object
  width(): number {
    return this.object.width!;
  }
  // Gets the height of a node's object
  height(): number {
    return this.object.height!;
  }
  // Sets the object position for all child nodes
  // using a modified Reingold-Tilford algorithm
  layoutNodes() {
    // Implemented in tree-layout.ts
    layoutTree(this);
  }
  // Returns the tree depth of the current node relative to root
  getDepth(depth = 0): number {
    if (this.parent != null) {
      depth = this.parent.getDepth(depth + 1)
    }
    return depth;
  }
  // Returns the maximum node depth relative to current node
  getMaxDepth(fromBottom = 0): number {
    let depths = this.children.map((child) => {
      return child.getMaxDepth(fromBottom + 1);
    });
    return depths.length > 0 ? Math.max(...depths) : fromBottom;
  }
  // Adds a fabric.Object to the tree and returns the TreeNode
  addChild(text: string, canvasObject: fabric.Object): TreeNode {
    let itemNode = new TreeNode(text, canvasObject);
    itemNode.parent = this;
    this.children.push(itemNode);
    return itemNode;
  }
  // Shifts the curent subtree position by an X and Y delta
  shiftNode(dX: number, dY: number) {
    this.object.set({
      left: this.x() + dX,
      top: this.y() + dY
    })
    this.children.forEach((child) => {
      child.shiftNode(dX, dY);
    });
  }
  // Sets the current subtree position to X and Y coords
  setNodePos(posX: number, posY: number) {
    const dX = posX - (this.object.left || 0);
    const dY = posY - (this.object.top || 0);
    this.shiftNode(dX, dY);
  }
  // Toggles the visability for the child subtrees
  toggleChildVisability(visible: boolean | null = null) {
    if (visible === null) { // Top level
      if (this.children.length === 0) return; // Nothing to do
      visible = !this.children[0].object.visible!;
    }
    this.children.forEach((child) => {
      child.toggleChildVisability(visible);
      child.object.visible = visible!;
      if (child.connectorLine !== null) {
        child.connectorLine.visible = visible!;
      }
    });
  }
  // Draws a line from the bottom center of the current 
  // node object to the top center of a specified node
  drawLine(destNode: TreeNode) {
    // Calculate the start and end points 
    const startX = this.x();
    const startY = this.y() + this.height() / 2;
    const endX = destNode.x();
    const endY = destNode.y() - destNode.height() / 2;
    // Calculate midpoint
    const midY = startY + (endY - startY) / 2;
    const line = new fabric.Polyline(
      [
        { x: startX, y: startY },
        { x: startX, y: midY },
        { x: endX, y: midY },
        { x: endX, y: endY },
      ],
      {
        stroke: 'black',
        strokeWidth: 1,
        fill: '', // Prevent closed shape
        evented: false,
      }
    );
    this.canvas.add(line);
    this.canvas.sendToBack(line);
    return line
  }
  // Recursivelly (re)draws lines for the current subree
  drawChildLines() {
    this.children.forEach((child) => {
      if (child.connectorLine != null) {
        this.canvas.remove(child.connectorLine);
      }
      let line = this.drawLine(child);
      child.connectorLine = line;
      child.drawChildLines();
    });
  }
}
