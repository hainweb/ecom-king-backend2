const { MongoClient } = require('mongodb');
const state = { db: null };

module.exports.connect = async function (done) {
  const url = 'mongodb+srv://ajinrajeshhillten:ilzSIoQy0bzlzgF2@cluster0.prb1l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
  const dbname = 'shopping';

  try {
    const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    state.db = client.db(dbname);
    done();
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    done(err);
  }
};

module.exports.get = function () {
  return state.db;
};
