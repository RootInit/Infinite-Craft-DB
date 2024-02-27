
import {
  initializeCanvas,
} from "./canvas-utils";

import {
  newTree,
  TreeRow
} from "./canvas-tree";

const DEBUG = false;

const ROOTURL = `${window.location.protocol}//${window.location.host}`;

// Debouncer class. Create a new instance 
// per function to isolate debouncing
class Debouncer {
  blockTimer: number | null = null; // Timer to check if blocked
  funcTimer: number | null = null; // Timer to run once unblocked
  delay: number; // Time between function calls
  constructor(delay: number) {
    this.delay = delay;
  }
  // Runs a function imediatly then blocks until delay elapses
  // If blocked runs the function once unblocked
  debounce(func: () => void) {
    if (this.blockTimer == null) {
      // Run the function
      func()
      // Set a timeout to block
      this.blockTimer = window.setTimeout(() => {
        window.clearTimeout(this.blockTimer!);
        this.blockTimer = null;
      }, this.delay);
    }
    else {
      // Abort previous funcTimer
      if (this.funcTimer) window.clearTimeout(this.funcTimer);
      // Create a new funcTimer with current function
      this.funcTimer = window.setTimeout(() => {
        this.debounce(func);
      }, 100) // Check if unblocked every 100ms
    }
  }
}

// Crafting Tree setup
const canvasElm = document.getElementById('craftTreeView') as HTMLCanvasElement;
const canvas = initializeCanvas(canvasElm);
// Resets canvas and displays an item tree
async function showRecipe(itemId: number) {
  canvas.clear();
  const path = `getItemRecipe?item=${itemId}`;
  const treeJson = await runRequest(path) as [number, string, number][];
  const treeRows: TreeRow[] = treeJson.map(([ID, Text, Parent]) => ({ ID, Text, Parent }));
  const rootNode = newTree(canvas, treeRows);
  if (DEBUG) {
    console.log(rootNode);
    (window as any).rootNodeGlobal = rootNode;
    (window as any).showRecipe = showRecipe;
  }
}
// Anonymous function to set totalItems and show random recipe
(async function() {
  const totalItemsSpan = document.getElementById("totalItems") as HTMLElement
  type TotalItems = {
    Total: number
  }
  const totalItemsJson = await runRequest(`getTotalItems`) as TotalItems;
  const totalItems = totalItemsJson.Total;
  totalItemsSpan!.textContent = totalItems.toString();
  // Show initial random recipe
  const randomRecipeId = Math.floor(Math.random() * totalItems) + 5;
  showRecipe(randomRecipeId);
})()

// Item search setup
const searchDiv = document.getElementById('searchDiv') as HTMLInputElement;
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const suggestionListDiv = document.getElementById('suggestionList') as HTMLCanvasElement;
const searchDeb = new Debouncer(500);
searchInput.addEventListener('input', () => { searchDeb.debounce(handleSearch) });
searchInput.addEventListener('focus', () => { searchDeb.debounce(handleSearch) });
// Hide suggestions when search unfocused
searchDiv.addEventListener('focusout', () => { suggestionListDiv.innerHTML = ''; });
// Shows item search results
async function handleSearch() {
  const searchTerm: string = searchInput.value.toLowerCase();
  if (searchTerm.length < 3) {
    suggestionListDiv.innerHTML = '';
    return; // Too short
  }
  const resultsJson = await getSearchItems(searchTerm);
  suggestionListDiv.innerHTML = ''; // Clear suggestions
  if (!resultsJson) return;
  // Add the suggestion divs
  resultsJson.forEach(row => {
    const suggestionElm = document.createElement('div');
    suggestionElm.textContent = row[1];
    suggestionElm.addEventListener('mousedown', function() {
      showRecipe(row[0]);
      // Clear suggestions
      suggestionListDiv.innerHTML = '';
    }, { once: true });
    suggestionListDiv.appendChild(suggestionElm);
  });
}
// Returns an array of item suggestions [[id, text]]
async function getSearchItems(searchTerm: string): Promise<[number, string][]> {
  const path = `getItemsFuzzy?query=${searchTerm}`;
  const itemsJson = await runRequest(path) as [number, string][];
  return itemsJson;
}


// Item list
const itemListElm = document.getElementById('itemList') as HTMLElement;
let itemListLastId = 0;
async function loadNewItems() {
  const path = `getNextItems?after=${itemListLastId}`;
  const itemsJson = await runRequest(path) as [number, string][];
  itemListLastId = itemsJson[itemsJson.length - 1][0];
  // Add items to DOM
  itemsJson.forEach((item) => {
    const itemElm = document.createElement('div');
    itemElm.textContent = item[1];
    itemElm.addEventListener('click', function() {
      // Enable scrollBack to the previous height
      setScrollBackListener();
      // Show the recipe
      showRecipe(item[0]);
      // Scroll to recipe canvas
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
    itemListElm.appendChild(itemElm);
  });
  return true;
}
loadNewItems();

// Infinite scroll event handler
async function handleInfiniteScroll() {
  // Total scroll height
  const scrollHeight = window.innerHeight + window.scrollY;
  const bodyHeight = document.body.offsetHeight;
  // Load items when 2 full window heights remains
  const loadHeight = bodyHeight - window.innerHeight * 2;
  if (scrollHeight >= loadHeight) {
    let result = await loadNewItems();
    if (result === false) {
      // Loaded all the items
      window.removeEventListener('scroll', handleInfiniteScroll);
    }
  }
}
const scrollDeb = new Debouncer(500);
window.addEventListener('scroll', () => { scrollDeb.debounce(handleInfiniteScroll) });

// Scroll back listener to return to the original
// place on the item list
function setScrollBackListener() {
  const initialScrollY = window.scrollY;
  let lastScrollY = initialScrollY;
  const scrollBack = function() {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY) {
      window.removeEventListener('scroll', scrollBack);
      window.scrollTo({
        top: initialScrollY,
        // behavior: 'smooth' (TODO broken)
      });
    }
    lastScrollY = currentScrollY;
  };
  window.addEventListener('scroll', scrollBack);
}

// Returns json response from a request url
// Returns null if request fails
async function runRequest(request: string): Promise<any> {
  try {
    const url = `${ROOTURL}/api/${request}`;
    const response = await fetch(url);
    if (response.ok) {
      // console.log(await response.text())
      return await response.json();
    } else if (response.status === 429) {
      window.alert("Too Many Requests. Please try again later.");
      console.error("Request failed. Too many requests.");
    } else {
      console.error(`Request failed. Status: ${response.status}`);
    }
  }
  catch (error) {
    console.error("Error:", error);
  }
  return null;
}


