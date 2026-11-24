const fs = require('fs');
const os = require('os');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const dir = path.join(os.tmpdir(), 'libroya-jest');

module.exports = async function globalSetup() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, dbName: 'libroya' },
  });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'uri.txt'), replSet.getUri('libroya'), 'utf8');
  globalThis.__LIBROYA_REPLSET__ = replSet;
};
