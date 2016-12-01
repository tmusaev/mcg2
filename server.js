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
  },
  web: {
    login: {
      enabled: true,
      nextUri: "/game"
    }
  }
}));

var listener = http.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/CCol", function (request, response) {
  response.sendFile(__dirname + '/views/card_collection.html');
});

app.get('/user', stormpath.getUser, function (request, response) {
  if(request.user) {
    if(request.user.customData.wins === undefined)
      request.user.customData.wins = 0;
    if(request.user.customData.losses === undefined)
      request.user.customData.losses = 0;
    if(request.user.customData.gold === undefined)
      request.user.customData.gold = 0;
    request.user.customData.save();
    response.send(request.user);
  }
  else {
    response.send('error');
  }
});

app.get("/game", function (request, response) {
  response.sendFile(__dirname + '/views/game.html');
});

app.post("/logout", function (request, response) {
  console.log('posting: logged out');
});

app.get('/winner', stormpath.getUser, function (request, response) {
  request.user.customData.wins = parseInt(request.user.customData.wins) + 1;
  request.user.customData.gold = parseInt(request.user.customData.gold) + 50;
  request.user.customData.save();
  response.send('50');
});

app.get('/loser', stormpath.getUser, function (request, response) {
  request.user.customData.losses = parseInt(request.user.customData.losses) + 1;
  request.user.customData.gold = parseInt(request.user.customData.gold) + 15;
  request.user.customData.save();
  response.send('15');
});

var users = new Map(); //maps socket.id to username
var ids = new Map(); //maps usernames to socket.id
var games = new Map(); //maps socket.id to a game
var evos = new Map();
evos.set("Assassin", "Death");
evos.set("Wardog", "Cerebrus");
evos.set("Ninja", "Samurai");
evos.set("Judge", "Justice");
evos.set("Warrior", "Centurion");
evos.set("Sheriff", "The Law");
evos.set("Captain", "Kraken");
evos.set("Medic", "Doctor");
evos.set("Priest", "Hand of God");

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
      if(!games.has(key))
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
    var arr = [];
    for(var key of users.keys()) {
      if(!games.has(key))
        arr.push(users.get(key));
    }
    io.emit('users', arr);
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
      else if(c.type == "Follower" && player.inPlay.length == 5)
        io.to(socket.id).emit('toomanyfollowers');
      else {
        var card = player.hand.splice(index, 1);
        card[0].playable = false;
        if(card[0].name == "Red Lotus") {
          redLotus(game);
          for(var i = 0; i < player.inPlay.length; i++) {
            var card = player.inPlay[i];
            if(card.color == "Red") {
              card.atk++;
              card.health++;
            }
          }
          player.discard.push(card[0]);
        }
        else if(card[0].name == "Blue Lily") {
          blueLily(game);
          for(var i = 0; i < player.inPlay.length; i++) {
            var card = player.inPlay[i];
            if(card.color == "Blue") {
              card.atk++;
              card.health++;
            }
          }
          player.discard.push(card[0]);
        }
        else if(card[0].name == "Green Leaves") {
          greenLeaves(game);
          for(var i = 0; i < player.inPlay.length; i++) {
            var card = player.inPlay[i];
            if(card.color == "Green") {
              card.atk++;
              card.health++;
            }
          }
          player.discard.push(card[0]);
        }
        else {
          player.inPlay.push(card[0]);
        }
        player.power = player.power - c.cost;
        glowPlayable(player);
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
      glowPlayable(game.player2);
      glowCanAttack(game.player2);
      unGlowCanAttack(game.player1);
    }
    else {
      drawCard(game.player1);
      game.player1.totalPower++;
      game.player1.power = game.player1.totalPower;
      game.turnPlayerId = game.player1.id;
      glowPlayable(game.player1);
      glowCanAttack(game.player1);
      unGlowCanAttack(game.player2);
    }
    emitGameState(game);
  });
  
  socket.on('battle', function(attackerId, receiverId) {
    var game = games.get(socket.id);
    if(game.turnPlayerId != socket.id) {
      io.to(socket.id).emit('notyourturn');
    }
    else {
      var player;
      var opp;
      if(game.player1.id == socket.id) {
        player = game.player1;
        opp = game.player2;
      }
      else {
        player = game.player2;
        opp = game.player1;
      }
      var attacker = player.inPlay[attackerId];
      var receiver = opp.inPlay[receiverId];
      attacker.health -= receiver.atk;
      receiver.health -= attacker.atk;
      attacker.canattack = false;
      if(attacker.health <= 0)
        player.discard.push(player.inPlay.splice(attackerId, 1)[0]);
      if(receiver.health <= 0)
        opp.discard.push(opp.inPlay.splice(receiverId, 1)[0]);
      emitGameState(game);
    }
  });
  
  socket.on('atklife', function(attackerId) {
    var game = games.get(socket.id);
    if(game.turnPlayerId != socket.id) {
      io.to(socket.id).emit('notyourturn');
    }
    else {
      var player;
      var opp;
      if(game.player1.id == socket.id) {
        player = game.player1;
        opp = game.player2;
      }
      else {
        player = game.player2;
        opp = game.player1;
      }
      var attacker = player.inPlay[attackerId];
      opp.life -= 1;
      attacker.canattack = false;
      drawCard(opp);
      if(opp.life == 0) {
       io.to(player.id).emit('winner');
       io.to(opp.id).emit('loser');
      }
      else {
        emitGameState(game);
      }
    }
  });
  
  socket.on('evolve', function(index) {
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
      if(player.power < 2) {
        io.to(socket.id).emit('notenoughpower')
      }
      else {
        var c = player.inPlay[index];
        player.inPlay.splice(index, 1, evolve(evos.get(c.name)));
        player.power = player.power - 2;
        glowPlayable(player);
        emitGameState(game);
      }
    }
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

function redLotus(game) {
  game.field = "Red";
}

function blueLily(game) {
  game.field = "Blue";
}

function greenLeaves(game) {
  game.field = "Green";
}

var Card = function(name, cost, atk, health, type, canattack, evolvable, color) {
  this.name = name;
  this.cost = cost;
  this.type = type;
  this.atk = atk;
  this.health = health;
  this.playable = false;
  this.canattack = canattack;
  this.evolvable = evolvable;
  this.color = color;
};

var Player = function(id, deck, hand, discard, inPlay, power) {
  this.id = id;
  this.deck = deck;
  this.hand = hand;
  this.discard = discard;
  this.inPlay = inPlay;
  this.totalPower = 0;
  this.power = power;
  this.life = 6;
};

var Game = function(player1, player2) {
  this.field = null;
  this.player1 = player1;
  this.player2 = player2;
  if(Math.floor((Math.random() * 2) + 1) == 1){
    this.turnPlayerId = player1.id;
    player1.totalPower++;
    player1.power++;
    glowPlayable(player1);
  }
  else {
    this.turnPlayerId = player2.id;
    player2.totalPower++;
    player2.power++;
    glowPlayable(player2);
  }
};

function glowPlayable(player) {
  for(var i = 0; i < player.hand.length; i++) {
    if(player.hand[i].cost <= player.power)
      player.hand[i].playable = true;
    else
      player.hand[i].playable = false;
  }
}

function glowCanAttack(player) {
  for(var i = 0; i < player.inPlay.length; i++) {
      player.inPlay[i].canattack = true;
  }
}

function unGlowCanAttack(player) {
  for(var i = 0; i < player.inPlay.length; i++) {
      player.inPlay[i].canattack = false;
  }
}

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

function evolve(name) {
  if(name == "Death")
    return new Card("Death", 4, 4, 4, "Follower", true, false, "Blue");
  else if(name == "Cerebrus")
    return new Card("Cerebrus", 4, 4, 4, "Follower", true, false, "Red");
  else if(name == "Kraken")
    return new Card("Kraken", 4, 4, 4, "Follower", true, false, "Blue");
  else if(name == "The Law")
    return new Card("The Law", 4, 4, 4, "Follower", true, false, "Green");
  else if(name == "Justice")
    return new Card("Justice", 4, 4, 10, "Follower", true, false, "Green");
  else if(name == "Centurion")
    return new Card("Centurion", 4, 4, 4, "Follower", true, false, "Red");
  else if(name == "Samurai")
    return new Card("Samurai", 5, 6, 4, "Follower", true, false, "Red");
  else if(name == "Doctor")
    return new Card("Doctor", 4, 4, 4, "Follower", true, false, "Green");
  else if(name == "Hand of God")
    return new Card("Hand of God", 8, 10, 10, "Follower", true, false, "Green");
}

function initDeck() {
  var deck = [];
  for(i = 0; i < 3; i++)
    deck.push(new Card("Things", 1, 1, 1, "Follower", false, false, "Black"));
  for(i = 0; i < 3; i++)
    deck.push(new Card("Assassin", 2, 2, 2, "Follower", false, true, "Blue"));
  for(i = 0; i < 3; i++)
    deck.push(new Card("Captain", 5, 2, 5, "Follower", false, true, "Blue"));
  for(i = 0; i < 3; i++)
    deck.push(new Card("Warrior", 4, 5, 4, "Follower", false, true, "Red"));
  for(i = 0; i < 3; i++)
    deck.push(new Card("Priest", 2, 1, 5, "Follower", false, true, "Green"));
  for(i = 0; i < 3; i++)
    deck.push(new Card("Wardog", 3, 4, 3, "Follower", false, true, "Red"));
  for(i = 0; i < 3; i++)
    deck.push(new Card("Ninja", 3, 3, 1, "Follower", true, true, "Red"));
  for(i = 0; i < 3; i++)
    deck.push(new Card("Medic", 4, 2, 8, "Follower", false, true, "Green"));
  for(i = 0; i < 3; i++)
    deck.push(new Card("Sheriff", 6, 5, 6, "Follower", false, true, "Green"));
  for(i = 0; i < 3; i++)
    deck.push(new Card("Judge", 8, 7, 6, "Follower", false, true, "Green"));
  deck.push(new Card("Red Lotus", 1, 0, 0, "Field", false, false, "Red"));
  deck.push(new Card("Blue Lily", 1, 0, 0, "Field", false, false, "Blue"));
  deck.push(new Card("Green Leaves", 1, 0, 0, "Field", false, false, "Green"));
  shuffle(deck);
  return deck;
}

function allCards() {
  var deck = [];
  deck.push(new Card("Things", 1, 1, 1, "Follower", false, true));
  deck.push(new Card("Assassin", 2, 2, 2, "Follower", false, true));
  deck.push(new Card("Captain", 5, 2, 5, "Follower", false, true));
  deck.push(new Card("Warrior", 4, 5, 4, "Follower", false, true));
  deck.push(new Card("Priest", 2, 1, 5, "Follower", false, true));
  deck.push(new Card("Wardog", 3, 4, 3, "Follower", false, true));
  deck.push(new Card("Ninja", 3, 3, 1, "Follower", true, true));
  deck.push(new Card("Medic", 4, 2, 8, "Follower", false, true));
  deck.push(new Card("Sheriff", 6, 5, 6, "Follower", false, true));
  deck.push(new Card("Judge", 8, 7, 6, "Follower", false, true));
  deck.push(new Card("Red Lotus", 1, 0, 0, "Field", false, false));
  deck.push(new Card("Blue Lily", 1, 0, 0, "Field", false, false));
  deck.push(new Card("Green Leaves", 1, 0, 0, "Field", false, false));
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