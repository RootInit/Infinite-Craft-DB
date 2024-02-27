
import { fabric } from 'fabric';

export function initializeCanvas(canvasElm: HTMLCanvasElement): fabric.Canvas {
  const canvas = new fabric.Canvas(canvasElm);
  // Dynamically resize canvas to fit surrounding div
  canvasElm.parentElement!.style.width = "100%";
  canvasElm.parentElement!.style.height = "100%";
  function resizeCanvas(): void {
    let outerElement = canvasElm.parentElement!.parentElement!;
    let width = outerElement.offsetWidth;
    let height = outerElement.offsetHeight;
    canvas.setDimensions({ width: width, height: height });
    fitCanvasToObjects(canvas.getObjects());
  }
  resizeCanvas(); // Initial run
  window.addEventListener('resize', resizeCanvas, false);
  // Add canvas controls
  addCanvasControlEvents(canvas);
  return canvas;
}

// Adds event listeners to handle canvas navigation
function addCanvasControlEvents(canvas: fabric.Canvas) {
  var isDragging: boolean = false;
  var lastPosX: number = 0;
  var lastPosY: number = 0;
  // Zoom buttons
  const zoomInDiv = document.getElementById("zoomIn");
  zoomInDiv?.addEventListener('click', function() {
    var zoom = canvas.getZoom();
    zoom *= 1.25;
    if (zoom > 20) zoom = 20;
    canvas.zoomToPoint({ x: canvas.width! / 2, y: canvas.height! / 2 }, zoom);
  });
  const zoomOutDiv = document.getElementById("zoomOut");
  zoomOutDiv?.addEventListener('click', function() {
    var zoom = canvas.getZoom();
    zoom /= 1.25;
    if (zoom < 0.01) zoom = 0.01;
    canvas.zoomToPoint({ x: canvas.width! / 2, y: canvas.height! / 2 }, zoom);
  });

  // Returns event coordinates based on the event type
  function getEventCoordinates(event: MouseEvent | TouchEvent): [number, number] {
    if (event instanceof MouseEvent) {
      return [event.clientX, event.clientY]
    } else if (event instanceof TouchEvent && event.touches.length > 0) {
      const touch = event.touches[0];
      return [touch.clientX, touch.clientY];
    }
    // Event unsupported disable pan controlls
    canvas.off('mouse:down', onCanvasMouseDown);
    canvas.off('mouse:move', onCanvasMouseMove);
    console.error("Unable to get input event coordinates. Disabled pan.")
    return [0, 0];
  }
  // Scroll zoom
  canvas.on('mouse:wheel', function(opt: fabric.IEvent) {
    const wheelEvent = opt.e as WheelEvent;
    const delta = wheelEvent.deltaY;
    var zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 20) zoom = 20;
    if (zoom < 0.01) zoom = 0.01;
    canvas.zoomToPoint({ x: wheelEvent.offsetX, y: wheelEvent.offsetY }, zoom);
    wheelEvent.preventDefault();
    wheelEvent.stopPropagation();
  });
  // Click pan
  canvas.on('mouse:down', onCanvasMouseDown);
  function onCanvasMouseDown(this: fabric.Canvas, opt: fabric.IEvent) {
    var evt = opt.e as MouseEvent | TouchEvent;
    var target = canvas.findTarget(evt, false) as fabric.Object;
    if (target && target.evented !== false) {
      return;
    }
    const [posX, posY] = getEventCoordinates(evt);
    if (posX === -Infinity) return; // Unable to get coords
    this.selection = false;
    isDragging = true;
    lastPosX = posX;
    lastPosY = posY;
  }
  canvas.on('mouse:move', onCanvasMouseMove);
  function onCanvasMouseMove(this: fabric.Canvas, opt: fabric.IEvent) {
    if (isDragging) {
      var evt = opt.e as MouseEvent | TouchEvent;
      var vpt = this.viewportTransform!;
      const [posX, posY] = getEventCoordinates(evt);
      if (posX === -Infinity) return; // Unable to get coords
      vpt[4] += posX - lastPosX;
      vpt[5] += posY - lastPosY;
      lastPosX = posX;
      lastPosY = posY;
      this.renderAll();
    }
  }
  canvas.on('mouse:up', function(this: fabric.Canvas) {
    this.setViewportTransform(this.viewportTransform as number[]);
    isDragging = false;
    this.selection = true;
  });
}

// Returns the bounds of a group of objects.
// [left, right, top, bottom]
export function findObjectBounds(objects: fabric.Object[]): [number, number, number, number] {
  let left = Math.min(...objects.map(o => o.left! - (o.width! / 2)));
  let right = Math.max(...objects.map(o => o.left! + (o.width! / 2)));
  let top = Math.min(...objects.map(o => o.top! - (o.height! / 2)));
  let bottom = Math.max(...objects.map(o => o.top! + (o.height! / 2)));
  return [left, right, top, bottom];
}

// Returns a fabric.Object group with the specified text label
export function createTreeCanvasItem(canvas: fabric.Canvas, text: string): fabric.Object {
  if (canvas.width == undefined) {
    throw new Error("Canvas width undefined.")
  }
  const ITEMPADDING = 10
  const RADIUS = 5
  var textObject = new fabric.Text(text, {
    fontSize: 12,
    originX: 'center',
    originY: 'center',
    fill: '#000',
    fontFamily: 'Roboto, sans-serif', // Specify the sans-serif font family
  });
  const textBounds = textObject.getBoundingRect();
  const boxWidth = Math.round(textBounds.width + ITEMPADDING);
  const boxHeight = Math.round(textBounds.height + ITEMPADDING);
  var box = new fabric.Rect({
    fill: '#FFF',
    stroke: "#000",
    strokeWidth: 1,
    width: boxWidth,
    height: boxHeight,
    originX: 'center',
    originY: 'center',
    rx: RADIUS,
    ry: RADIUS
  });
  const group = new fabric.Group([box, textObject], {
    originX: 'center',
    originY: 'center',
    left: canvas.width / 2,
    top: canvas.width / 2,
    hasControls: false,
    lockMovementX: true,
    lockMovementY: true,
  });
  canvas.add(group);
  return group;
}

// Sets the canvas viewport to fit the objects specified
// EDGESPACING is added to each side
export function fitCanvasToObjects(objects: fabric.Object[]): void {
  const EDGESPACING = 30;
  if (objects.length === 0) {
    return;
  }
  const canvas = objects[0].canvas!;
  var [objLeft, objRight, objTop, objBottom] = findObjectBounds(objects);
  // Add margin 
  objLeft -= EDGESPACING;
  objRight += EDGESPACING;
  objTop -= EDGESPACING;
  objBottom += EDGESPACING;
  const objWidth = objRight - objLeft;
  const objHeight = objBottom - objTop;
  // Calculate scale factor and zoom
  const width = canvas.width as number;
  const height = canvas.height as number;
  const scaleFactor = Math.min(width / objWidth, height / objHeight);
  canvas.setZoom(scaleFactor);
  // Viewport to center 
  const centerX = (objLeft + objRight) / 2;
  const centerY = (objTop + objBottom) / 2;
  canvas.viewportTransform = [scaleFactor, 0, 0, scaleFactor, width / 2 - centerX * scaleFactor, height / 2 - centerY * scaleFactor];
}


