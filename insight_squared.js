https://repl.it/@DanGreff1/SyncTest2#index.js


/**
 * API documentation
 *
 * https://lodash.com/docs/4.17.15
 * https://www.npmjs.com/package/nedb
 * https://github.com/bajankristof/nedb-promises
 * https://www.npmjs.com/package/await-the#api-reference
 */

const Datastore = require('nedb-promises');
const _ = require('lodash');
const the = require('await-the');

// The source database to sync updates from
let sourceDb = new Datastore({
  inMemoryOnly: true,
  timestampData: true
});

// The target database that sendEvents() will write too
let targetDb = new Datastore({
  inMemoryOnly: true,
  timestampData: true
});


let TOTAL_RECORDS;
const load = async () => {
  // Add some documents to the collection
  await sourceDb.insert({ name : 'GE', owner: 'test', amount: 1000000 });
  await the.wait(300);
  await sourceDb.insert({ name : 'Exxon', owner: 'test2', amount: 5000000 });
  await the.wait(300);
  await sourceDb.insert({ name : 'Google', owner: 'test3', amount: 5000001 });

  TOTAL_RECORDS = 3;
}

let EVENTS_SENT = 0;
/**
 * Api to send each document to in order to sync
 */
const sendEvent = data => {
  EVENTS_SENT += 1;
  console.log('event being sent: ');
  console.log(data);


  //todo - bonus: write data to targetDb
  //await sourceDb.insert(data);
};

// Find and update an existing document
const touch = async name => {
  await sourceDb.update({ name }, { $set: { owner: 'test4' } });
};

const dump = async name => {
  const record = await sourceDb.findOne( { name });
  console.log(record);
};

/**
 * Get all records out of the database and send them using
 * 'sendEvent()'
 */
const syncAllNoLimit = async () => {

}

/**
 * Sync up to the provided limit of records. Data returned from
 * this function will be provided on the next call as the data
 * argument
 */
const syncWithLimit = async (limit, data) => {
  return data;
}

/**
 * Synchronize in given batch sizes.  This is needed to get around
 * limits most APIs have on result sizes.
 */
const syncAllSafely = async (batchSize, data) => {

  // Example implementation
  if (_.isNil(data)) {
    data = {}
  }
  data.lastResultSize = -1;
  await the.while(
    () => data.lastResultSize != 0,
    async () => {
      data = await syncWithLimit(batchSize, data);
    });

  return data;
}

/**
 * Sync changes since the last time the function was called with
 * with the passed in data
 */
const syncNewChanges = async data => {
  return data;
}


/**
 * Implement function to fully sync of the database and then
 * keep polling for changes.
 */
const synchronize = async () => {
}



const runTest = async () => {
  await load();

  await dump('GE');

  EVENTS_SENT = 0;
  await syncAllNoLimit();

  if (EVENTS_SENT === TOTAL_RECORDS) {
    console.log('1. synchronized correct number of events')
  }

  EVENTS_SENT = 0;
  let data = await syncAllSafely(1);

  if (EVENTS_SENT === TOTAL_RECORDS) {
    console.log('2. synchronized correct number of events')
  }

  // Makes some updates and then sync just the changed files
  EVENTS_SENT = 0;
  await the.wait(300);
  await touch('GE');
  await syncNewChanges(1, data);

  if (EVENTS_SENT === 1) {
    console.log('3. synchronized correct number of events')
  }


}


runTest();
