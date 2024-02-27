package main

import (
	"database/sql"
  "slices"

	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)
// An item with emoji and text concatinated
type Item struct {
	ID         int
	Text       string
}
// Represents the Item table
type DbItem struct {
	ID         int
	Text       string
  Emoji      string
}
func (dbItem DbItem) getMergedText() string {
  return dbItem.Emoji+" "+dbItem.Text
}
// Convert DbItem => Item
func (dbItem DbItem) convert() (Item) {
  return Item{dbItem.ID, dbItem.getMergedText()}
}

type ItemsDB struct {
	*sql.DB
}

// Initializes the sqlite Db
func InitializeDB(dbFile string) (ItemsDB, error) {
	var db ItemsDB
	dbCon, err := sql.Open("sqlite3", dbFile)
	if err != nil {
		return db, err
	}
	db = ItemsDB{dbCon}
	return db, err
}

//  Returns the total items in the db
func (db ItemsDB) GetTotalItems() (int, error) {
  var total int
  err := db.QueryRow(`SELECT COUNT(id) FROM items`).Scan(&total)
  return total, err
}

// Returns an Item from the "items" table
func (db ItemsDB) GetItem(id int) (Item, error) {
  var item DbItem
  err := db.QueryRow(
    `SELECT id, text, emoji FROM items WHERE id = ?`,id,
    ).Scan(&item.ID, &item.Text, &item.Emoji)
  return item.convert(), err
}

// Returns item arrays from the "items" table
func (db ItemsDB) GetItemBatch(limit int, afterId int) ([][]any, error) {
  rows, err := db.Query(
    `SELECT id, text, emoji FROM items
    WHERE id > ? LIMIT ?`,
    afterId, limit)
  if err != nil {
    return nil, err
  }
  defer rows.Close()
  var items [][]any
  for rows.Next() {
    var dbItem DbItem
    err := rows.Scan(&dbItem.ID, &dbItem.Text, &dbItem.Emoji)
    if err != nil { 
      return nil, err
    }
    items = append(items, []any{dbItem.ID, dbItem.getMergedText()})
  }
  return items, nil
}

// Returns an item array of items with name matching
func (db ItemsDB) GetItemsByFuzzyName(query string, limit int) ([][]any, error) {
  rows, err := db.Query(
    `SELECT id, text, emoji from items 
    WHERE text COLLATE NOCASE LIKE '%' || ? || '%'
    LIMIT ?`,
    query, limit)
  if err != nil {
    return nil, err
  }
  defer rows.Close()
  var items [][]any
  for rows.Next() {
    var dbItem DbItem
    err := rows.Scan(&dbItem.ID, &dbItem.Text, &dbItem.Emoji)
    if err != nil { 
      return nil, err
    }
    items = append(items, []any{dbItem.ID, dbItem.getMergedText()})
  }
  return items, nil
}

// Returns a recipe array [[id, emoji+text, parentId]]
func (db ItemsDB) getRecipe(itemId int) ([][]any, error) {
  var recipe [][]any
  foundNodes := []int{1,2,3,4}
  // Add top node
  rootItem, err := db.GetItem(itemId)
  if err != nil {
    return nil, err
  } 
  recipe = append(recipe, []any{rootItem.ID, rootItem.Text, -1})
  // Add child nodes
  var addChildNodes func(currentItem Item) error 
  addChildNodes = func(currentItem Item) error {
    components, err:= db.getItemComponents(currentItem.ID)
    if err != nil {
      return err
    }
    for _, cmpnt := range components {
      recipe = append(recipe, []any{cmpnt.ID, cmpnt.Text, currentItem.ID})
      if !slices.Contains(foundNodes, cmpnt.ID) {
        foundNodes = append(foundNodes, cmpnt.ID) 
        addChildNodes(cmpnt)
      }
    }
    return nil
  }
  if !slices.Contains(foundNodes, rootItem.ID){
    addChildNodes(rootItem)
  }
  return recipe, nil
} 

// GetRecipes retrieves the lowest id recipe for an itemId
func (db ItemsDB) getItemComponents(itemId int) ([]Item, error) {
  var first, second DbItem
  err := db.QueryRow(
    `SELECT 
    C1.id, C1.text, C1.emoji, 
    C2.id, C2.text, C2.emoji
    FROM recipes as R
    LEFT JOIN items as C1 ON C1.id = R.first
    LEFT JOIN items as C2 ON C2.id = R.second
    WHERE R.result = ?
    ORDER BY R.first, R.second DESC
    LIMIT 1`,
    itemId).Scan(
    &first.ID, &first.Text, &first.Emoji,
    &second.ID, &second.Text, &second.Emoji)
  return []Item{first.convert(), second.convert()}, err
}

// GetBatches returns a list of batch end ids from the "resume" table
func (db ItemsDB) GetBatches() ([]int, error) {
  rows, err := db.Query(`SELECT batch_end_id FROM resume`)
  if err != nil {
    return nil, err
  }
  defer rows.Close()
	var batches []int
  for rows.Next() {
    var batchEnd int
    err := rows.Scan(&batchEnd)
    if err != nil {
      return nil, err
    }
    batches = append(batches, batchEnd)
  }
	return batches, nil
}
