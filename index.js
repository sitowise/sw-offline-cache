'use strict';
var nanoEqual = require('nano-equal');

var TILESTORE_NAME = 'tile';
var EDITSTORE_NAME = 'edit';

/**
 * A Wrapper around IndexedDB. 
 * 
 * @param {string} databaseName Name of the database. 
 * @param {number} databaseVersion Database version. If undefined, defaults to 1.
 */
var OfflineCache = function(databaseName, databaseVersion) {
    var db;
    var dbName;
    var dbVersion;

    if (databaseName === null|| databaseName === undefined || databaseName === '') {
        console.error('Databasename must be given.');
    } else {
        dbName = databaseName;
        dbVersion = databaseVersion || 1;
    }

    /**
     * Creates schema on the database if database exists.
     */
    function createSchema () {
        if (db instanceof window.IDBDatabase) {
            db.createObjectStore(TILESTORE_NAME, { keyPath: 'src' });
            db.createObjectStore(EDITSTORE_NAME, { keyPath: 'key'});
        } else {
            console.error(
                'Cannot create schemabecause database seems not to exists.'
            );
        }
    }

    /**
     * Get's a transaction and store for given database and transaction mode.
     * 
     * If no transactionMode given then defaults to 'readonly'.
     * 
     * @param {string} storeName Name of the IDBObjectStore.
     * @param {string} transactionMode One of IDBTransaction.mode modes.
     * @param {function} onerror Function to be called if errors.
     * @returns {object} Transaction and store.
     */
    function getConnection(storeName, transactionMode, onerror) {
        var transaction = db.transaction(
            [storeName],
            transactionMode || 'readonly'
        );
        transaction.onerror = onerror;
        transaction.onabort = onerror;

        var store = transaction.objectStore(storeName);
        store.onerror = onerror;

        return { transaction: transaction,  store: store };
    }

    /**
     * A generic method to add (almost) anything into database.
     * 
     * Returns a Promise that will resolve with given item, if operation was
     * succesfull. Otherwise it will reject.
     * 
     * @param {string} storeName Name of the IDBObjectStore where to store item.
     * @param {object} item Item to store.
     * @returns {Promise} Promise for the add -operation.
     */
    function add(storeName, item) {
        return new Promise(function(resolve, reject) {
            var conn = getConnection(storeName, 'readwrite', reject);
            var request = conn.store.put(item);

            request.onerror = reject;
            request.onsuccess = function() {
                resolve(item);
            };
        });
    }

    /**
     * A generic method to get single item from database.
     * 
     * Returns a Promise that will resolve with given item, if operation was
     * succesfull. Otherwise it will reject.
     * 
     * @param {string} storeName Name of the IDBObjectStore where to get item.
     * @param {string} key Key of the item to get.
     * @returns {Promise} Promise for the get -operation.
     */
    function get(storeName, key) {
        return new Promise(function(resolve, reject) {
            var conn = getConnection(storeName, 'readonly', reject);
            var request = conn.store.get(key);

            request.onerror = reject;
            request.onsuccess = function () {
                resolve(request.result);
            }
        });
    }

    /**
     * A generic method to get all items from database.
     * 
     * Returns a Promise that will resolve with given items, if operation was
     * succesfull. Otherwise it will reject.
     * 
     * @param {string} storeName Name of the IDBObjectStore where to get items.
     * @returns {Promise} Promise for the get -operation.
     */
    function getAll(storeName) {
        return new Promise(function(resolve, reject) {
            var conn = getConnection(storeName, 'readonly', reject);
            var request = conn.store.getAll();

            request.onerror = reject;
            request.onsuccess = function () {
                resolve(request.result);
            }
        });
    }

    /**
     * Removes item from the database.
     * 
     * @param {string} storeName Name of the IDBObjectStore where to remove item.
     * @param {string} key Key of the item to remove.
     * @return {Promise} Promise for the remove-operation. 
     */
    function remove(storeName, key) {
        return new Promise(function(resolve, reject) {
            var conn = getConnection(storeName, 'readwrite', reject);
            var request = conn.store.delete(key);

            request.onerror = reject;
            request.onsuccess = function() {
                resolve(key);
            }
        });
    }

    /**
     * Returns total count of items in IDBObjectStore.
     * 
     * @param {string} storeName Name of the IDBObjectStore whose items to count.
     * @returns {Promise} Promise for the count-operation.
     */
    function count(storeName) {
        return new Promise(function(resolve, reject) {
            var conn = getConnection(storeName, 'readonly', reject);
            var request = conn.store.count();

            request.onerror = reject;
            request.onsuccess = function() {
                resolve(request.result);
            }
        });
    }

    /**
     * Opens the database.
     * 
     * Will return a Promise that will resolve, if there are not any errors
     * on opening the database. Otherwise the Promise will reject.
     * 
     * @returns {Promise} Promise for the opening operation.
     */
    this.open = function() {
        return new Promise(function(resolve, reject) {
            var dbRequest = window.indexedDB.open(dbName, dbVersion);

            dbRequest.onerror = function(error) {
                reject(error);
            }

            dbRequest.onsuccess = function(event) {
                db = event.target.result;
                resolve();
            }

            dbRequest.onupgradeneeded = function(event) {
                db = event.target.result;
                createSchema();
            }
        });
    };

    /**
     * Closes the database.
     * 
     * Will return a Promise that will resolve, if the database exists and can 
     * be closed. Otherwise the Promise will reject.
     * 
     * @returns {Promise} Promise for the closing operation.
     */
    this.close = function() {
        return new Promise(function(resolve, reject) {
            if (db instanceof window.IDBDatabase) {
                db.close();
                db = undefined;
                resolve();
            } else {
                reject(
                    'Cannot close the database because it seems not to exists.'
                );
            }
        });
    };

    /**
     * Adds edit to database.
     * 
     * Stores current timestamp (ms) alongside the original edit.
     * Returns a Promise that will resolve with given item, if operation was
     * succesfull. Otherwise it will reject. By default does nothing, is equal
     * edit can be found from database.
     * 
     * Checking for duplicates is known to be slow, but also the amount of edits
     * is expected to be rather small.
     * 
     * The "unique" -key generated is not collision-free, but also propability
     * for collision is rather low.
     * 
     * @param {object} edit Edit to store in the database.
     * @param {boolean} replace Optional. Do nothing if equal edit is found.
     * @param {number} timestamp Optional timestamp (ms) for the edit.
     * @returns {Promise} Promise for the addTile -operation.
     */
    this.addEdit = function(edit, replace, timestamp) {
        replace = replace === false ? false : true;
        timestamp = Number.isInteger(timestamp) ? timestamp : Date.now();
        var key = String(timestamp)
            + '_'
            + Math.random().toString(36).substring(7);
        var editMeta = { timestamp: timestamp, edit: edit, key: key };

        if (replace) {
            return getAll(EDITSTORE_NAME).then(function(edits) {
                for (var i=0; i<edits.length; i++) {
                    if (nanoEqual(edits[i].edit, edit)) {
                        return Promise.resolve(edit);
                    }
                }
                return add(EDITSTORE_NAME, editMeta);
            });
        }
        return add(EDITSTORE_NAME, editMeta);
    };

    /**
     * Adds given tile into tilestore.
     * 
     * Returns a Promise that will resolve with given item, if operation was
     * succesfull. Otherwise it will reject.
     * 
     * @param {object} tile Tile to store in the database.
     * @returns {Promise} Promise for the addTile -operation.
     */
    this.addTile = function(tile) {
        return add(TILESTORE_NAME, tile);
    };

    /**
     * Returns all edits from the database sorted by the timestamp.
     * 
     * Will sort (asc) edits based on their timestamp -property.
     * Returns a Promise that will resolve with given items, if operation was
     * succesfull. Otherwise it will reject.
     * 
     * @param {boolean} keepMeta Should added metadata be kept.
     * @returns {Promise} Promise for the getAllEdits -operation.
     */
    this.getAllEdits = function(keepMeta) {
        keepMeta = Boolean(keepMeta) || false;

        return getAll(EDITSTORE_NAME).then(function(edits) {
            var sorted = edits.sort(function(a, b) {
                return a.timestamp - b.timestamp;
            });
            if (!keepMeta) {
                return sorted.map(function(e) { return e.edit; });
            }
            return sorted;
        });
    };

    /**
     * Gets tile from the database.
     * 
     * Returns a Promise that will resolve with given item, if operation was
     * succesfull. Otherwise it will reject.
     * 
     * @param {string} src Tile retrieval url.
     * @returns {Promise} Promise for the getTile -operation.
     */
    this.getTile = function(src) {
        return get(TILESTORE_NAME, src);
    };

    /**
     * Removes edit from the database.
     * 
     * @param {string} key Key of the edit.
     * @return {Promise} Promise for the removeEdit -operation. 
     */
    this.removeEdit = function(key) {
        return remove(EDITSTORE_NAME, key);
    }

    /**
     * Removes tile from the database.
     * 
     * @param {string} key Key of the tile.
     * @return {Promise} Promise for the removeTile -operation. 
     */
    this.removeTile = function(key) {
        return remove(TILESTORE_NAME, key);
    }

    /**
     * Returns number of edits in the database.
     * 
     * @return {Promise} Promise for the editCount -operation. 
     */
    this.editCount = function() {
        return count(EDITSTORE_NAME);
    }

    /**
     * Returns number of tiles in the database.
     * 
     * @return {Promise} Promise for the tileCount -operation. 
     */
    this.tileCount = function() {
        return count(TILESTORE_NAME);
    }
};

module.exports = OfflineCache;
