// ------------------------------ //
//      Old php info from previous project, example of login auth for db
//     $host="localhost";
//     $port=3306;
//     $socket="MySQL";
//     $username="root";
//     $password="";
//     $dbname="best_girl";
// ------------------------------ //
// const mysql = require('mysql');
// const fs = require('fs');
let count = 10;

// var con = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "",
//   database: "best_girl"
// });



// Buying stocks from the market

// Make generic function to take a player name, a girl name, and a quantity
//   TODO, handle concurrency:
//     Have a obj with keys of player names
//     When a transaction starts, check obj[playername]
//     If value is true, put transaction on queue, if false continue
//     After doing transaction: 
//       set obj[playername] to true
//       unshift new transaction off queue and call recursively
//   Check if girl exists in DB, save gID
//   Check if girl has stocks >= quantity, minus quantity from g.stocks
//   Check if player's wallet >= quantity * g.value      
//     Yes, save pID and minus value from p.wallet and increment p.trades
//     No, add quantity back to g.stocks
//   Check if pID + gID row exists in Stocks
//     Yes, add quantity to Stocks.quantity and increment g.trades
//     No, create new row with gID, pID, quantity

function buyFromMarket(con, playerD, girlname, quantity) {
  let gID, pID, girl, player;
  con.query(`SELECT * FROM girl WHERE gName = '${girlname}'`, function (err, result) {
    if (err) throw err;
    if (!result[0]) {console.error('Failed! No girl found with that name!'); return;}
    girl = result[0];
    gID = girl.gID;
    if (girl.Stocks < quantity) {console.error('Failed! Not enough stocks for that girl!'); return;}

    con.query(`SELECT * FROM player WHERE dID = '${playerD}'`, function (err, result) {
      if (err) throw err;
      if (!result[0]) {console.error('Failed! No player with that name!'); return;}
      player = result [0];
      pID = player.pID;
      if (player.Wallet < quantity * girl.Value) {console.error('Failed! Not enough money for those stocks!')};

      con.query(`UPDATE girl SET Stocks = Stocks - ${quantity}, Trades = Trades + ${quantity} WHERE gID = '${gID}'`, function (err, result) {
        if (err) throw err;
        con.query(`UPDATE player SET Wallet = Wallet - ${quantity * girl.Value} WHERE pID = '${pID}'`, function (err, result) {
          if (err) { // something broke when doing player part of changes, revert things and exit
            con.query(`UPDATE girl SET Stocks = Stocks + ${quantity}, Trades = Trades - ${quantity} WHERE gID = '${gID}'`, function (err, result) {
              return;
            });
            throw err;
          }
          con.query(`SELECT * FROM stocks WHERE pID = '${pID}' AND gID = '${gID}'`, function (err, result) {
            if (err) { // something went wrong, fix player's wallet
              console.error(err); 
              con.query(`UPDATE player SET Wallet = Wallet + ${quantity * girl.Value} WHERE pID = ${pID}`)
              throw err;
            }
            if (result && result[0]) {
              let stock = result[0];
              con.query(`UPDATE stocks SET Quantity = Quantity + ${quantity} WHERE id = '${stock.id}'`, function (err, result) {
                if (err) throw err;
              });
            }
            else {
              con.query(`INSERT INTO stocks (pID, gID, Quantity) VALUES (${pID}, ${gID}, ${quantity})`, function (err, result) {
                if (err) throw err;
              });
            }
          });
        });
      });
    });
  });
}

// Test call to buyFromMarket
//buyFromMarket('FroFox#4689', 'Bulma', 1)


function buyFromPlayer (con, buyername, sellername, girlname, value, quantity) {
  let gID, bID, sID, buyer, seller;
  con.query(`SELECT * FROM girl WHERE gName = '${girlname}'`, function (err, result) {
    if (err) throw err;
    if (!result || !result[0]) {console.error('Failed! No girl found with that name!')};
    gID = result[0].gID;

    // get both buyer and seller to make the most of the query in the player table
    // the fewer queries it takes to do this function, the less chance of concurrency issues or race conditions
    con.query(`SELECT * FROM player WHERE Name = '${buyername}' OR Name = '${sellername}'`, function (err, result) {
      if (err) throw err;
      if (!result || !result[0]) {console.error('Failed! No buyer with that name!')};
      for (let player of result) {
        (player.Name == buyername)? buyer = player : seller = player;
      }
      bID = buyer.pID;
      sID = seller.pID;
      if (buyer.Wallet < quantity * value) {console.error('Failed! Not enough money for those stocks!')};

        con.query(`UPDATE player SET Wallet = Wallet + ${quantity * value} WHERE pID = ${sID},
                  UPDATE player SET Wallet = Wallet - ${quantity * value} WHERE pID = ${bID};`, function (err, result) {
            console.error('here 1')
            if (err) throw err;
          
          con.query(`SELECT * FROM stocks WHERE (pID = ${sID} AND gID = '${gID}') OR (pID = ${bID} AND gID = '${gID}')`, function (err, result) {
            if (err) { // something went wrong, fix the player wallets
              console.error(err);
              con.query(`UPDATE player SET Wallet = Wallet - ${quantity * value} WHERE pID = ${sID},
                        UPDATE player SET Wallet = Wallet + ${quantity * value} WHERE pID = ${bID};`);
              throw err;
            }
            if (result && result[1]) {
              for (let stock of result) {
              (stock.pID == sID) ? seller.stockID = stock.id : buyer.stockID = stock.id;
              }
              con.query(`UPDATE stocks SET Quantity = Quantity + ${quantity} WHERE id = '${buyer.stockID}',
                        UPDATE stocks SET Quantity = Quantity - ${quantity} WHERE id = '${seller.stockID}',
                        UPDATE girl SET Trades = Trades + ${quantity} WHERE gID = '${gID}';`, function (err, result) {
                if (err) { // something went wrong, reset stocks and wallets
                  console.error(err);
                  con.query(`UPDATE stocks SET Quantity = Quantity - ${quantity} WHERE id = '${buyer.stockID}',
                  UPDATE stocks SET Quantity = Quantity + ${quantity} WHERE id = '${seller.stockID}',
                  UPDATE player SET Wallet = Wallet - ${quantity * value} WHERE pID = ${sID},
                  UPDATE player SET Wallet = Wallet + ${quantity * value} WHERE pID = ${bID};`);
                  console.error('here 2')
                  throw err;
                }
              });
            }
            else if (result && result[0]) { // only one player has stocks in this girl
              if (result[0].pID != sID) { // check if the player with stocks is the seller
                console.error(`Seller doesn't have stocks in that girl!`);
                con.query(`UPDATE player SET Wallet = Wallet - ${quantity * value} WHERE pID = ${sID},
                UPDATE player SET Wallet = Wallet + ${quantity * value} WHERE pID = ${bID};`);
                console.error('here 3')
                err = {customError: true, message: `Seller ${sellername} doesn't have stocks in Girl ${girlname}!`};
                throw err;
              }
              let queryStr =`UPDATE stocks SET Quantity = Quantity - ${quantity} WHERE id = ${sID},
              INSERT INTO stocks (pID, gID, Quantity) VALUES (${bID}, ${gID}, ${quantity}),
              UPDATE girl SET Trades = Trades + ${quantity} WHERE gID = '${gID}';`
              con.query(queryStr, function (err, result) {
                if (err) { // something went wrong, fix player stocks and wallets
                  console.error(err);
                  queryStr =`UPDATE stocks SET Quantity = Quantity + ${quantity} WHERE id = ${sID},
                  DELETE FROM stocks WHERE pID = ${bID} && gID = '${gID}',
                  UPDATE player SET Wallet = Wallet - ${quantity * value} WHERE pID = ${sID},
                  UPDATE player SET Wallet = Wallet + ${quantity * value} WHERE pID = ${bID};`
                  console.error('here 4')
                  con.query(queryStr);
                  throw err;
                }
              });
            }
          });
        });
    });
  });
}

// Test call to buyFromPlayer
// let err = buyFromPlayer('Muahahayes#5739','FroFox#4689', 'Bulma', 10, 1);
// if (err) console.log(err.message)



// Make generic function to take a buyer name, a seller name, a girl name, a value, and a quantity
//   Check if girl exists in DB, save gID
//   Check if seller name exist in Players, save sID
//   Check if gID + sID in Stocks has s.quantity >= quantity, minus quantity from s.quantity
//   Check if buyer's wallet >= quantity * g.value
//     Yes, save bID and minus value from b.wallet, add value to s.wallet and increment b.trades and s.trades
//     No, add quantity back to s.quantity
//   Check if pID + gID row exists in Stocks
//     Yes, add quantity to Stocks.quantity and increment g.trades
//     No, create new row with gID, pID, quantity and increment g.trades



// sellToMarket (sells a girl to the market for 0.9x her current listed price, market has internal value from the lost 10% which is distributed evenly next update to all girls for "market inflation" over time)
function sellToMarket(con, playerD, girlname, quantity) { // TODO: unfinished, still needs to be adapted from buyFromMarket code
  let gID, pID, girl, player;
  con.query(`SELECT * FROM girl WHERE gName = '${girlname}'`, function (err, result) {
    if (err) throw err;
    if (!result[0]) {console.error('Failed! No girl found with that name!'); return;}
    girl = result[0];
    gID = girl.gID;
    if (girl.Stocks < quantity) {console.error('Failed! Not enough stocks for that girl!'); return;}

    con.query(`SELECT * FROM player WHERE dID = '${playerD}'`, function (err, result) {
      if (err) throw err;
      if (!result[0]) {console.error('Failed! No player with that name!'); return;}
      player = result [0];
      pID = player.pID;
      if (player.Wallet < quantity * girl.Value) {console.error('Failed! Not enough money for those stocks!')};

    //   con.query(`UPDATE girl SET Stocks = Stocks - ${quantity}, Trades = Trades + ${quantity} WHERE gID = '${gID}'`, function (err, result) {
    //     if (err) throw err;
    //     con.query(`UPDATE player SET Wallet = Wallet - ${quantity * girl.Value} WHERE pID = '${pID}'`, function (err, result) {
    //       if (err) { // something broke when doing player part of changes, revert things and exit
    //         con.query(`UPDATE girl SET Stocks = Stocks + ${quantity}, Trades = Trades - ${quantity} WHERE gID = '${gID}'`, function (err, result) {
    //           return;
    //         });
    //         throw err;
    //       }
    //       con.query(`SELECT * FROM stocks WHERE pID = '${pID}' AND gID = '${gID}'`, function (err, result) {
    //         if (err) { // something went wrong, fix player's wallet
    //           console.error(err); 
    //           con.query(`UPDATE player SET Wallet = Wallet + ${quantity * girl.Value} WHERE pID = ${pID}`)
    //           throw err;
    //         }
    //         if (result && result[0]) {
    //           let stock = result[0];
    //           con.query(`UPDATE stocks SET Quantity = Quantity + ${quantity} WHERE id = '${stock.id}'`, function (err, result) {
    //             if (err) throw err;
    //           });
    //         }
    //         else {
    //           con.query(`INSERT INTO stocks (pID, gID, Quantity) VALUES (${pID}, ${gID}, ${quantity})`, function (err, result) {
    //             if (err) throw err;
    //           });
    //         }
    //       });
    //     });
    //   });
    });
  });
}
// dailyUpdate (does the trades vs par value shift algorithm I came up with on the whiteboard, with a minor amount of rng to simulate market uncertainty)
// elo boosts (when a ;set is recorded, the waifus the winning player has at least 1 stock gain a small boost to the next dailyUpdate)

// Inserting Girls:

// For manual insertion, uncomment here and run this js file through node
// let jsongirls = JSON.parse(fs.readFileSync('bestgirl.json', {encoding:'utf8'}))
// insertGirl(con, jsongirls, 30)

// For automatic insertion, call this function from module and give it the number of girls to insert
// Defaults to 10
function insertGirls(con, girls, c) {
  if (c) count = c;
  if (!girls) {
    let json = '[]';
    fs.writeFileSync('bestgirl.json', json);
    return;
  }
  if (!girls[0]) {
    let json = '[]';
    fs.writeFileSync('bestgirl.json', json);
    return;
  }
  if (count <= 0) {
    let json = JSON.stringify(girls);
    fs.writeFileSync('bestgirl.json', json);
    return;
  }

  // insert girls[0] to db
  let girl = girls.shift();
  let qry = `INSERT INTO girl (gName, Series, Description, Picture) VALUES (
    '${girl.Name}', 
    '${girl.Series}', 
    '${girl.Description}', 
    '${girl.Picture}')`;

  con.query(qry, function (err, result) {
    if (err) throw err;
    console.log(`${girl} inserted!`);
  });

  insertGirls(girls, --count);
}

function insertGirl(con, girl) {
  // insert girls[0] to db
  let qry = `INSERT INTO girl (gName, Series, Description, Picture) VALUES (
    '${girl.Name}', 
    '${girl.Series}', 
    '${girl.Description}', 
    '${girl.Picture}')`;

  con.query(qry, function (err, result) {
    if (err) throw err;
    console.log(`${girl} inserted!`);
  });
}



// Export functions as module for bot to call these
module.exports = {insertGirl, buyFromMarket, insertGirls, buyFromPlayer};