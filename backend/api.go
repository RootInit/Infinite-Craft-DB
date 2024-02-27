package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
)

// Class to handle API call functions
type API struct {
	db              ItemsDB
	totalItemsCache []byte
	nextItemsCache  map[int][]byte
	// TODO more
}

// Initializes and returns an API struct
func InitializeAPI(db ItemsDB) (*API, error) {
	api := API{db: db}
	api.nextItemsCache = map[int][]byte{}
	// Set static caches
	// Cache the first 10 pages of item requests
	toCache := []int{0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000}
	for idx, afterId := range toCache {
		jsonData, err := getNextItems(api.db, afterId)
		if err != nil {
			return &api, err
		}
		if string(jsonData) == "[]" {
			// Delete previous as it may be incomplete
			delete(api.nextItemsCache, toCache[idx-1])
			break
		}
		api.nextItemsCache[afterId] = jsonData
		log.Println("Cached request: getNextItems?after=", afterId)
	}
	// Set dynamic caches
	go func() {
		for {
			// Set total items
			totalItemsJson, err := getTotalItemsJson(db)
			if err != nil {
				log.Println("Unable to set totalItemsCache")
			}
			api.totalItemsCache = totalItemsJson
			// TODO more as needed
      // Update every minute
			time.Sleep(1 * time.Minute)
		}
	}()
	return &api, nil
}

func getTotalItemsJson(db ItemsDB) ([]byte, error) {
	totalItems, err := db.GetTotalItems()
	if err != nil {
		log.Println("Error retrieving totalItems from db ", err)
		return nil, err
	}
	totalItemsMap := map[string]int{"Total": totalItems}
	totalItemsJson, err := json.Marshal(totalItemsMap)
	if err != nil {
		log.Println("Error converting totalItemsMap to json: ", err)
		return nil, err
	}
	return totalItemsJson, nil
}

// Serves the api.totalItemsCache value
func (api *API) getTotalItems(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write(api.totalItemsCache)
}

// Serves a getItemRecipe?item=id api request
// Writes json [[id, emoji+text, parentId]]
func (api *API) getItemRecipe(w http.ResponseWriter, r *http.Request) {
	itemIdParam := r.URL.Query().Get("item")
	itemId, err := strconv.Atoi(itemIdParam)
	if err != nil {
		http.Error(w, "Invalid afterId parameter", http.StatusBadRequest)
		return
	}
	recipe, err := api.db.getRecipe(itemId)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Println("Error retrieving recipe from DB: ", err)
		return
	}
	recipeJson, err := json.Marshal(recipe)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Println("Error converting recipe to json: ", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(recipeJson)
}

// Serves a getNextItems?after=int api request
// Writes json [[id, emoji+text]]
func (api *API) getNextItems(w http.ResponseWriter, r *http.Request) {
	afterIdParam := r.URL.Query().Get("after")
	afterId, err := strconv.Atoi(afterIdParam)
	if err != nil {
		http.Error(w, "Invalid afterId parameter", http.StatusBadRequest)
		return
	}
	var itemsJson []byte
	// Check cache for data
	if data, exists := api.nextItemsCache[afterId]; exists {
		itemsJson = data
	} else {
		// Load the data from DB
		itemsJson, err = getNextItems(api.db, afterId)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(itemsJson)
}

// Returns a batch of items in json format
func getNextItems(db ItemsDB, afterId int) ([]byte, error) {
	items, err := db.GetItemBatch(1000, afterId)
	if err != nil {
		log.Println("Error retrieving items from DB: ", err)
		return []byte{}, nil
	}
	itemsJson, err := json.Marshal(items)
	if err != nil {
		log.Println("Error converting Item to json: ", err)
		return []byte{}, nil
	}
	return itemsJson, err
}

// Serves a getItemsFuzzy?query=text request
// Writes json [[id,emoji+text]]
func (api *API) getItemsFuzzy(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	// Load the data from DB
	items, err := api.db.GetItemsByFuzzyName(query, 50)
	if err != nil {
		log.Println("Error retrieving items from DB: ", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	itemsJson, err := json.Marshal(items)
	if err != nil {
		log.Println("Error converting Item to json: ", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(itemsJson)
}
