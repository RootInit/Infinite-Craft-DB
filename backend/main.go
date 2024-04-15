package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
)

func main() {
	addressPtr := flag.String("port", "127.0.0.1:8080", "Address to serve on")
	dbPathPtr := flag.String("db", "Items.db", "Address to serve on")
	helpPtr := flag.Bool("h", false, "Display help")

	flag.Parse()

	if *helpPtr {
		fmt.Println("Usage: webserver <message>")
		fmt.Println("Options:")
		flag.PrintDefaults()
		return
	}

	// Initialize the database
	log.Println("Loading database: ", *dbPathPtr)
	db, err := InitializeDB(*dbPathPtr)
	if err != nil {
		log.Fatal("Failed to load database: ", err)
	}
	defer db.Close()
	// Initialize the API class
	api, err := InitializeAPI(db)
	if err != nil {
		log.Fatal("Failed to initialize API", err)
	}
	// Create routes
	mux := http.NewServeMux()
	// Serve web assets
	mux.Handle("/assets/", http.StripPrefix(
		"/assets/",
		http.FileServer(http.Dir("./html/assets")),
	))
	// Serve main page
	mux.HandleFunc("/",
		func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/" {
				http.ServeFile(w, r, "./html/index.html")
			} else {
				w.WriteHeader(http.StatusNotFound)
				w.Write([]byte("404 Not Found"))
			}
		})
	// Serve API paths
	mux.HandleFunc("/api/getItemRecipe", api.getItemRecipe)
	mux.HandleFunc("/api/getNextItems", api.getNextItems)
	mux.HandleFunc("/api/getTotalItems", api.getTotalItems)
	mux.HandleFunc("/api/getItemsFuzzy", api.getItemsFuzzy)
	// Start the server
	log.Println("Running webserver on ", *addressPtr)
	err = http.ListenAndServe(*addressPtr, mux)
	if err != nil {
		log.Fatal("Failed to initialize webserver: ", err.Error())
	}
}
