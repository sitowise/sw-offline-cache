var indexedDB = require('fake-indexeddb');
var IDBDatabase = require('fake-indexeddb/lib/FDBDatabase');

var OfflineCache = require('.');

describe('index.js tests', function() {
    function initCache() {
        window.indexedDB = indexedDB;
        window.IDBDatabase = IDBDatabase;

        var randomDbName = Math.random().toString(36).substring(7);
        var cache = new OfflineCache(randomDbName, 1);
        return cache.open().then(function() { return cache; });
    }
    
    it('should create database', function() {
        var cache = initCache();
        return expect(cache).resolves.toBeDefined();
    });

    it('should set and get tile', function() {
        return initCache().then(function(cache) {
            return cache.addTile({ src: 'a1', data: 'd2' }).then(function() {
                return cache.getTile('a1').then(function(tile) {
                    expect(tile).toMatchObject({ src: 'a1', data: 'd2'});
                });
            });
        })
    });

    it('should set edits and return them ordered', function() {
        return initCache().then(function(cache) {
            var addPromises = [];
            for (var i=-3; i<3; i++) {
                var j = i > 0 ? i * -11 : i;
                var ts = 100 + j;
                addPromises.push(cache.addEdit(i, false, ts));
            }
            return Promise.all(addPromises).then(function() {
                return cache.getAllEdits(false).then(function(edits) {
                    expect(edits).toEqual([2, 1, -3, -2, -1, 0]);
                })
            })
        });
    });

    it('should set edits and return them ordered', function() {
        return initCache().then(function(cache) {
            var addPromises = [];
            for (var i=-3; i<3; i++) {
                var j = i > 0 ? i * -11 : i;
                var ts = 100 + j;
                addPromises.push(cache.addEdit(i, false, ts));
            }
            return Promise.all(addPromises).then(function() {
                return cache.getAllEdits(true).then(function(edits) {
                    var withoutKeys = edits.map(function(e) {
                        return { timestamp: e.timestamp, edit: e.edit };
                    });
                    expect(withoutKeys).toEqual([
                        { timestamp: 78, edit: 2},
                        { timestamp: 89, edit: 1},
                        { timestamp: 97, edit: -3},
                        { timestamp: 98, edit: -2},
                        { timestamp: 99, edit: -1},
                        { timestamp: 100, edit: 0},
                    ]);
                })
            })
        });
    });

    it('should set edits if not duplicate and return them ordered', function() {
        return initCache().then(function(cache) {
            function applyEditsInOrder(edits) {
                if (edits.length > 0) {
                    var edit = edits[0];
                    var remainingEdits = edits.slice(1);
                    return cache.addEdit(edit[0], edit[1], edit[2])
                        .then(function () {
                            return applyEditsInOrder(remainingEdits);
                        });
                }
                return Promise.resolve();
            }

            var edits = [];
            for (var i=-3; i<3; i++) {
                var j = i > 0 ? i * -11 : i;
                var ts = 100 + j;
                edits.push([i, true, ts]);
                edits.push([i, true, ts]);
                edits.push([i, true, ts]);
            }
            return applyEditsInOrder(edits)
                .then(function() {
                    return cache.getAllEdits(false).then(function(edits) {
                        expect(edits).toEqual([2, 1, -3, -2, -1, 0]);
                    });
                });
        });
    });

    it('should have 6 edits', function() {
        return initCache().then(function(cache) {
            var addPromises = [];
            for (var i=-3; i<3; i++) {
                var j = i > 0 ? i * -11 : i;
                var ts = 100 + j;
                addPromises.push(cache.addEdit(i, false, ts));
            }
            return Promise.all(addPromises).then(function() {
                return cache.editCount().then(function(count) {
                    expect(count).toEqual(6);
                })
            })
        });
    });

    it('should have 10 tiles', function() {
        return initCache().then(function(cache) {
            var addPromises = [];
            for (var i=0; i<10; i++) {
                addPromises.push(cache.addTile({ src: String(i), value: i }));
            }
            return Promise.all(addPromises).then(function() {
                return cache.tileCount().then(function(count) {
                    expect(count).toEqual(10);
                })
            })
        });
    });

    it('should remove edit', function() {
        return initCache()
        .then(function(cache) {
            return cache.addEdit(123)
                .then(function() {
                    return cache.getAllEdits(true).then(function(edits) {
                        var key = edits[0].key;
                        return cache.removeEdit(key).then(function() {
                            return cache.editCount().then(function(count) {
                                expect(count).toBe(0);
                            });
                        });
                    });
                });
        });
    });

    it('should remove tile', function() {
        return initCache()
        .then(function(cache) {
            return cache.addTile({ src: 'src' })
                .then(function() {
                    return cache.removeTile('src').then(function() {
                        return cache.tileCount().then(function(count) {
                            expect(count).toBe(0);
                        });
                    });
                });
        });
    });

    it('should close database', function() {
        return initCache()
        .then(function(cache) {
            return cache.close().then(function() {
                expect(true).toBeTruthy();
            }).catch(function() {
                expect(false).toBeTruthy();
            })
        });
    });
});
