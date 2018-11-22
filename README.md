# Offline cache for webmap -applications
A wrapper around IndexedDB with public APIs to store map-tiles in IndexedDB and user-actions, such as feature creation, edits and deletes.

## Usage
Add dependency into your ES 5/6/7 -project.
```
$ npm install --save git+https://github.com/sitowise/sw-offline-cache
```

And use it in your code.

```
import OfflineCache from 'sw-offline-cache';

const db = new OfflineCache('my-database', 1);
await db.open(); // Is an async action

const edit = { type: 'add', payload: 'my edit payload' };

// Add the edit into the database
await db.addTile(edit);

// For map tiles 'src' is a needed attribute.
const tile = { src: 'https://tiles.example.com/3/4/5.png', data: 'imagedata' };

// Add the tile into the database
await db.addTile(tile);

// Get the map-tile
const tile2 = await db.getTile('https://tiles.example.com/3/4/5.png');

// Get all edits
const edits = await db.getAllEdits();

// Get tile count
const tileCount = await db.tileCount();

// Get edit count
const editCount = await db.editCount();

// Remove tile
await db.removeTile('https://tiles.example.com/3/4/5.png');


// Remove edit. Key can be retrieved with db.getAllEdits(true);
await db.removeEdit('generated key for the edit');
```

Run the test. Tests are written with jest.

```
$ npm test
```

