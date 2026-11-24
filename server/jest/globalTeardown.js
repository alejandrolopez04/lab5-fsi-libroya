module.exports = async function globalTeardown() {
  const replSet = globalThis.__LIBROYA_REPLSET__;
  if (replSet) {
    await replSet.stop();
  }
};
