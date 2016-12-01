function drawHand(hand) {
  $('#hand').empty();
  for(var i = 0; i < hand.length; i++) {
    drawCard(hand[i], i, "hand");
  }
}

function drawOppHand(oppHand) {
  $('#oppHand').empty();
  for(var i = 0; i < oppHand.length; i++) {
    drawCardBack("oppHand");
  }
}

function drawInPlay(inPlay) {
  $('#inPlay').empty();
  for(var i = 0; i < inPlay.length; i++) {
    drawCard(inPlay[i], i, "inPlay");
  }
}

function drawOppInPlay(oppInPlay) {
  $('#oppInPlay').empty();
  for(var i = 0; i < oppInPlay.length; i++)
    drawCard(oppInPlay[i], i, "oppInPlay");
}

//render a card object to some location represented by a String
//Id used to index the card relative to it's location (hand, field, etc)
function drawCard(card, id, location) {
  var d = document.createElement("div");
  
  if(card.playable === true && location == "hand")
    d.setAttribute("class", "cardplayable");
  else if(card.canattack === true && location == "inPlay") {
    d.setAttribute("class", "cardcanattack");
      d.onclick=function(){
        attacker = this.id;
      };
  }
  else
    d.setAttribute("class", "card");
  
  if(location == "oppInPlay") {
    d.onclick=function(){
      if(attacker !== null) {
        socket.emit('battle', attacker, this.id);
        attacker = null;
      }
    };
  }
  
  var img = document.createElement("img");
  img.src = images.get(card.name);
  d.appendChild(img);
  
  var heart = document.createElement("p");
  heart.setAttribute("class", "heart");
  heart.textContent = "❤";
  d.appendChild(heart);
  
  var sword = document.createElement("p");
  sword.setAttribute("class", "sword");
  sword.textContent = "⚔";
  d.appendChild(sword);
  
  var cost = document.createElement("p");
  cost.setAttribute("class", "cost");
  cost.textContent = card.cost;
  d.appendChild(cost);
  
  var atk = document.createElement("p");
  atk.setAttribute("class", "atk");
  atk.textContent = card.atk;
  d.appendChild(atk);
  
  var health = document.createElement("p");
  health.setAttribute("class", "health");
  health.textContent = card.health;
  d.appendChild(health);
  
  if(location == "inPlay" && card.evolvable) {
    var arrow = document.createElement("p");
    arrow.setAttribute("class", "arrow");
    arrow.textContent = "⇮";
    arrow.onclick=function(){
      socket.emit('evolve', id);
    };
    d.appendChild(arrow);
  }
  
  var name = document.createElement("p");
  name.setAttribute("class", "name");
  name.textContent = card.name;
  d.appendChild(name);
  
  d.id = id;
  
  if(location == "hand") {
    d.onclick=function(){
      socket.emit('play', this.id);
    };
  }
  
  document.getElementById(location).appendChild(d);
}

/*function feCardCol(element, index, array) {
  drawCardForCollection(element, index);
}

function drawCardForCollection(card, id) {
  var d = document.createElement("div");

  d.setAttribute("class", "card");
  
  var img = document.createElement("img");
  img.src = images.get(card.name);
  d.appendChild(img);
  
  var heart = document.createElement("p");
  heart.setAttribute("class", "heart");
  heart.textContent = "❤";
  d.appendChild(heart);
  
  var sword = document.createElement("p");
  sword.setAttribute("class", "sword");
  sword.textContent = "⚔";
  d.appendChild(sword);
  
  var cost = document.createElement("p");
  cost.setAttribute("class", "cost");
  cost.textContent = card.cost;
  d.appendChild(cost);
  
  var atk = document.createElement("p");
  atk.setAttribute("class", "atk");
  atk.textContent = card.atk;
  d.appendChild(atk);
  
  var health = document.createElement("p");
  health.setAttribute("class", "health");
  health.textContent = card.health;
  d.appendChild(health);
  
  if(card.evolvable) {
    var arrow = document.createElement("p");
    arrow.setAttribute("class", "arrow");
    arrow.textContent = "⇮";
    arrow.onclick=function(){
      socket.emit('evolve', id);
    };
    d.appendChild(arrow);
  }
  
  var name = document.createElement("p");
  name.setAttribute("class", "name");
  name.textContent = card.name;
  d.appendChild(name);
  
  d.id = id;
  
  document.getElementById(location).appendChild(d);
}

function drawCardCollection(card[]) {
  card.forEach(feCardCol);
}*/

function drawCardBack(location) {
  var d = document.createElement("div");
  d.setAttribute("class", "cardback");
  
  var img = document.createElement("img");
  img.src = images.get("CardBack");
  d.appendChild(img);
  
  document.getElementById(location).appendChild(d);
}