// https://repl.it/@DanGreff1/SyncTest2#index.js


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
  await sourceDb.insert({ name: 'GE', owner: 'test', amount: 1000000 });
  await the.wait(300);
  await sourceDb.insert({ name: 'Exxon', owner: 'test2', amount: 5000000 });
  await the.wait(300);
  await sourceDb.insert({ name: 'Google', owner: 'test3', amount: 5000001 });

  TOTAL_RECORDS = 3;
}

let EVENTS_SENT = 0;
/**
 * Api to send each document to in order to sync
 * send event is what i call to send the new record to the target database
 */
const sendEvent = async eventData => {
  EVENTS_SENT += 1;
  // console.log('event being sent: ');
  // console.log('event data', eventData);

  // put an if statement to see if the event type is an insert or an update

  if (eventData.type === "insert") {
    //todo - bonus: write data to targetDb
    await targetDb.insert(eventData.document); //takes the event data.document and inserts it
  } else if (eventData.type === "update") {
    // UPDATE THE DOCUMENT
    targetDb.update({ _id: eventData.document._id }, { $set: { name: eventData.document.name, owner: eventData.document.owner, amount: eventData.document.amount }, }, { multi: false })
  } else {
    // if it isn't an insert or update, then display bug information
    console.error("invalid event data type", eventData.type)
  }
};

// Find and update an existing document
const touch = async name => {
  // { name } is the same thing as { name: name } which is a part of destructuring
  await sourceDb.update({ name }, { $set: { owner: 'test4' } }); //does an update on source db, i have to find a record to update; 1) a way to find the filter 2) change what property of those records and what am i going change it to?
};

const dump = async name => {
  const record = await sourceDb.findOne({ name });
  console.log(record);
};

/**
 * Get all records out of the database and send them using
 * 'sendEvent()'
 */
const syncAllNoLimit = async () => {
  //synching everything from source dB to target dB; first step - get all records from source dB
  const allDocuments = await sourceDb.find({});
  // console.log("syncAllNoLimit", allDocuments);
  allDocuments.forEach(document => {
    const eventData = { type: "insert", document: document }
    sendEvent(eventData) //sendEvent does the actual synching so ill need to call it later
  })
}

/**
 * Sync up to the provided limit of records. Data returned from
 * this function will be provided on the next call as the data
 * argument
 */
const syncWithLimit = async (limit, data) => {
  const documents = await sourceDb.find({}).skip(data.skip).limit(limit); //start with data.skip; start w/0 then increment by batch size
  // documents is an array of documents from dB returned by the find call
  data.lastResultSize = documents.length
  documents.forEach(document => { //documents is the array i want to for each on
    const eventData = { type: "insert", document: document }
    sendEvent(eventData) //sendEvent does the actual synching & this is where i called it
  })
  // console.log('synced this many documents:', documents.length, limit, data)
  data.timeLastSynced = new Date()
  return data;
}

/**
 * Synchronize in given batch sizes.  This is needed to get around
 * limits most APIs have on result sizes.
 */
const syncAllSafely = async (batchSize, data) => {
  // batchSize tells me how many batches i want to look at, at a time, from the source dB, implement limit on batchsize; did a skip, to move to the next batch. the batch size is going to be 1 but skip is going to get bigger; and it would have to go up the same size as the batch size
  // Example implementation
  if (_.isNil(data)) {
    data = {}
  }
  data.lastResultSize = -1;
  data.skip = 0; // let skip = 0 makes a new variable whereas data.skip creates a property on the object data
  await the.while( // while the data is not equal to 0, do the sync w limit,
    () => data.lastResultSize != 0,
    async () => {
      data = await syncWithLimit(batchSize, data); //syncWithLimit is called over and over till everything is gone through
      data.skip += batchSize //this went after bc it was "off by 1", not before
      console.log('inside while loop data.lastResultSize', data.lastResultSize)
    });

  data.timeLastSynced = new Date()
  return data;
}


/**
 * Sync changes since the last time the function was called with
 * with the passed in data
 */
const syncNewChanges = async (data) => {
  const updatedNeedSync = await (await sourceDb.find({ "updatedAt": { $gt: data.timeLastSynced } })).filter( doc => doc.createdAt !== doc.updatedAt);//sourcedb.find returns an array of documents
  const newDocumentsNeedSync = await sourceDb.find({ "createdAt": { $gt: data.timeLastSynced } });
  console.log('****WILL SYNC THESE UPDATES', data, updatedNeedSync)
  console.log('****WILL SYNC THESE INSERTS', data, newDocumentsNeedSync)
  // function sendEvent, have list of docs that needed to be synched & I take those documents and create this event data object; event data is whats in my send event functoin. make the object and call the send event function with each of the docuemnts I have with the update. send an event data event for each one of those documents
  // call send event, give it the right type, & pass every
  updatedNeedSync.forEach(document => {
    const eventData = { type: "update", document: document }
    sendEvent(eventData)
  })
  newDocumentsNeedSync.forEach(document => {
    const eventData = { type: "insert", document: document } // want to see how event data is used, look at send event next line
    sendEvent(eventData)
  })
  data.timeLastSynced = new Date()
  data.lastResultSize = updatedNeedSync.length + newDocumentsNeedSync.length
  return data;
}


/**
 * Implement function to fully sync of the database and then
 * keep polling for changes.
 */
const synchronize = async () => {
  let data = await syncAllSafely(1);
  await the.while(
    () => true, //function always returns true; keeps while loop running forever
    async () => {
      await the.wait(3000);
      data = await syncNewChanges(data);
      console.log('polling for & syncing new changes', data.lastResultSize)
    });
}

const testInsert = () => {
  sourceDb.insert({ name: 'Tesla', owner: 'test2', amount: 5000000 }); // test data to see if insert is also being synchronized
}




const runTest = async () => {
  await load();

  await dump('GE');

  EVENTS_SENT = 0;
  await syncAllNoLimit(); //this copies everything from source dB to target dB at once but then later, it does it again
  // all of them at once

  if (EVENTS_SENT === TOTAL_RECORDS) {
    console.log('1. synchronized correct number of events')
  }

  EVENTS_SENT = 0;
  await targetDb.remove({}, { multi: true })
  await the.wait(300);
  let data = await syncAllSafely(1); // copies all records AGAIN from source to target
  //do this at the batch size of 1
  console.log('time last synched:', data.timeLastSynced)

  console.log('Events & Records:', EVENTS_SENT, TOTAL_RECORDS)
  if (EVENTS_SENT === TOTAL_RECORDS) {
    console.log('2. synchronized correct number of events')
  }


  // Makes some updates and then sync just the changed files
  EVENTS_SENT = 0;
  await the.wait(300);
  await touch('GE');
  await sourceDb.insert({ name: 'Tesla', owner: 'test2', amount: 5000000 }); // test data to see if insert is also being synchronized
  await syncNewChanges(data);

  if (EVENTS_SENT === 2) {
    console.log('3. synchronized correct number of events')
  }

  const allSourceDocuments = await sourceDb.find({});
  const allTargetDocuments = await targetDb.find({});
  console.log("****** source", allSourceDocuments, "****** target", allTargetDocuments)
  await targetDb.remove({}, { multi: true }) // need to clean out targetDb before I fully sync it again
  setTimeout(touch, 6*1000, 'Exxon');



}
  // runTest();
  const doit = async () => {
    await load(); // load the test records
    setTimeout(touch, 2*1000, 'Exxon'); // schedule a test update
    setTimeout(testInsert, 5*1000, 'Exxon'); // schedule a test insert
    synchronize(); // sync the complete db and then start polling for new changes
  }
  doit();
