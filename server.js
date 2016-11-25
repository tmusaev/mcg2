// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var stormpath = require('express-stormpath');

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

app.use(stormpath.init(app, {
  expand: {
    customData: true //so we can store wins, losses, and gold
  }
}));

var listener = http.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/user', stormpath.getUser, function (request, response) {
  if(request.user) {
    response.send(request.user.fullName);
  }
  else {
    response.send('error');
  }
});

var users = new Map(); //maps socket.id to username
var ids = new Map(); //maps usernames to socket.id
var games = new Map(); //maps socket.id to a game

io.on('connection', function(socket){
  io.to(socket.id).emit('myId', socket.id); //send id back so it knows itself
  
  socket.on('debug', function(msg){
    console.log(msg);
  });
  
  socket.on('connectToServer', function(user) {
    users.set(socket.id, user);
    ids.set(user, socket.id);
    var arr = [];
    for(var key of users.keys()) {
      arr.push(users.get(key));
    }
    io.emit('users', arr);
  });
  
  socket.on('challenge', function(toUser){
    var from = users.get(socket.id);
    var to = ids.get(toUser);
    io.to(to).emit('challenge', from);
  });
  
  socket.on('newgame', function(user1, user2) {
    var p1Deck = initDeck();
    var p1Hand = initHand(p1Deck);
    var p2Deck = initDeck();
    var p2Hand = initHand(p2Deck);
    var p1 = new Player(ids.get(user1), p1Deck, p1Hand, [], [], 0);
    var p2 = new Player(ids.get(user2), p2Deck, p2Hand, [], [], 0);
    var game = new Game(p1, p2);
    games.set(ids.get(user1), game);
    games.set(ids.get(user2), game);
    emitGameState(game);
  });
  
  socket.on('play', function(index) {
    var game = games.get(socket.id);
    if(game.turnPlayerId != socket.id) {
      io.to(socket.id).emit('notyourturn');
    }
    else {
      var player;
      if(game.player1.id == socket.id)
        player = game.player1;
      else
        player = game.player2;
      var c = player.hand[index];
      if(c.cost > player.power)
        io.to(socket.id).emit('notenoughpower');
      else if(c.type == "Creature" && player.inPlay.length == 5)
        io.to(socket.id).emit('toomanycreatures');
      else {
        var card = player.hand.splice(index, 1);
        player.inPlay.push(card[0]);
        player.power = player.power - c.cost;
        emitGameState(game);
      }
    }
  });
  
  socket.on('endturn', function() {
    var game = games.get(socket.id);
    if(game.player1.id == socket.id) {
      drawCard(game.player2);
      game.player2.totalPower++;
      game.player2.power = game.player2.totalPower;
      game.turnPlayerId = game.player2.id;
    }
    else {
      drawCard(game.player1);
      game.player1.totalPower++;
      game.player1.power = game.player1.totalPower;
      game.turnPlayerId = game.player1.id;
    }
    emitGameState(game);
  });
  
  socket.on('disconnect', function(){
    if(users.has(socket.id)) {
      users.delete(socket.id);
      ids.delete(users.get(socket.id));
      var arr = [];
      for(var key of users.keys()) {
        arr.push(users.get(key));
      }
      io.emit('users', arr);
    }
    if(games.has(socket.id)) {
      games.delete(socket.id);
    }
  });
});

function emitGameState(game) {
  io.to(game.player1.id).emit('gameState', game);
  io.to(game.player2.id).emit('gameState', game);
}

var Card = function(name, cost, atk, health, type) {
  this.name = name;
  this.cost = cost;
  this.type = type;
  this.atk = atk;
  this.health = health;
};

var Player = function(id, deck, hand, discard, inPlay, power) {
  this.id = id;
  this.deck = deck;
  this.hand = hand;
  this.discard = discard;
  this.inPlay = inPlay;
  this.totalPower = 0;
  this.power = power;
};

var Game = function(player1, player2) {
  this.player1 = player1;
  this.player2 = player2;
  if(Math.floor((Math.random() * 2) + 1) == 1){
    this.turnPlayerId = player1.id;
    player1.totalPower++;
    player1.power++;
  }
  else {
    this.turnPlayerId = player2.id;
    player2.totalPower++;
    player2.power++;
  }
};

var Things = new Card("Things", 1, 1, 1, "Creature");
var Assassin = new Card("Assassin", 2, 2, 2, "Creature");
var Captain = new Card("Captain", 3, 3, 3, "Creature");
var Warrior = new Card("Warrior", 4, 4, 4, "Creature");
var Priest = new Card("Priest", 5, 5, 5, "Creature");
var Wardog = new Card("Wardog", 6, 6, 6, "Creature");
var Ninja = new Card("Ninja", 7, 7, 7, "Creature");
var Medic = new Card("Medic", 8, 8, 8, "Creature");
var Sherrif = new Card("Sherrif", 9, 9, 9, "Creature");
var Judge = new Card("Judge", 10, 10, 10, "Creature");

function drawCard(player) {
  if(player.deck.length > 0) {
    var c = player.deck.shift();
    if(player.hand.length < 10)
      player.hand.push(c);
    else
      player.discard.push(c);
  }
}

function initHand(deck) {
  var hand = [];
  for(var i = 0; i < 5; i++)
    hand.push(deck.shift());
  return hand;
}

function initDeck() {
  var deck = [];
  for(i = 0; i < 3; i++)
    deck.push(Things);
  for(i = 0; i < 3; i++)
    deck.push(Assassin);
  for(i = 0; i < 3; i++)
    deck.push(Captain);
  for(i = 0; i < 3; i++)
    deck.push(Warrior);
  for(i = 0; i < 3; i++)
    deck.push(Priest);
  for(i = 0; i < 3; i++)
    deck.push(Wardog);
  for(i = 0; i < 3; i++)
    deck.push(Ninja);
  for(i = 0; i < 3; i++)
    deck.push(Medic);
  for(i = 0; i < 3; i++)
    deck.push(Sherrif);
  for(i = 0; i < 3; i++)
    deck.push(Judge);
  shuffle(deck);
  return deck;
}

function shuffle(array) {
  var i = 0, j = 0, temp = null;
  for (i = array.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1));
    temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}