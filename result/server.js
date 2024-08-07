var express = require('express'),
    async = require('async'),
    path = require('path'),
    { Pool } = require('pg'),
    cookieParser = require('cookie-parser'),
    app = express(),
    router = express.Router(),
    server = require('http').Server(app),
    stringReplace = require('string-replace-middleware'),
    io = require('socket.io')(server, {
      path: '/result/socket.io'
  });

var port = process.env.PORT || 4000;
var basePath = process.env.BASE_PATH || '';
var pgHost = process.env.POSTGRES_HOST || "db";
var optionA = process.env.OPTION_A || "Cats";
var optionB = process.env.OPTION_B || "Dogs";

io.on('connection', function (socket) {

  socket.emit('message', { text : 'Welcome!' });

  socket.on('subscribe', function (data) {
    socket.join(data.channel);
  });
});

var pool = new Pool({
  connectionString: `postgres://postgres:postgres@${pgHost}/postgres`
});

async.retry(
  {times: 1000, interval: 1000},
  function(callback) {
    pool.connect(function(err, client, done) {
      if (err) {
        console.error("Waiting for db");
      }
      callback(err, client);
    });
  },
  function(err, client) {
    if (err) {
      return console.error("Giving up");
    }
    console.log("Connected to db");
    getVotes(client);
  }
);

function getVotes(client) {
  client.query('SELECT vote, COUNT(id) AS count FROM votes GROUP BY vote', [], function(err, result) {
    if (err) {
      console.error("Error performing query: " + err);
    } else {
      var votes = collectVotesFromResult(result);
      io.sockets.emit("scores", JSON.stringify(votes));
    }

    setTimeout(function() {getVotes(client) }, 1000);
  });
}

function collectVotesFromResult(result) {
  var votes = {a: 0, b: 0};

  result.rows.forEach(function (row) {
    votes[row.vote] = parseInt(row.count);
  });

  return votes;
}

const stringReplaceOptions = {
  contentTypeFilterRegexp: /^text\/|^application\/json$|^application\/xml$|^application\/javascript/
}
app.use(stringReplace({
  '{{basePath}}': basePath, '{{optionA}}': optionA, '{{optionB}}': optionB
},stringReplaceOptions));


app.use(cookieParser());
app.use(express.urlencoded());

app.use(basePath, express.static(__dirname + '/views'));

app.get('/', function (req, res) {
  res.sendFile(path.resolve(__dirname + '/views/index.html'));
});

server.listen(port, function () {
  var port = server.address().port;
  console.log('App running on port ' + port);
});
