const { lookup } = require('dns');
const { setPriority } = require('os');
const WebSocket = require('ws');
let accounts = require('./accounts.json');
let settings = require('./settings.json');
let desks = require('./desks.json');
let decoder = new TextDecoder("utf-8");
let fs = require('fs');

const version = settings.version
const whitelist = settings.whitelist
const port = settings.port
let desk = settings.desk
const consoleoutput = true;

function tokenat(text,index,separator) {
    text = text+""
    let splitarray = text.split(separator);
    return splitarray[index];
};

function rand(min, max) {
    let rand = min + Math.random() * (max + 1 - min);
    return Math.floor(rand);
}

let clients = {};
const ws = new WebSocket.Server({port: port});
console.log("Сервер Tasker версии "+version+" успешно запущен. Прослушиваем порт "+port+"...");

function ready(_websock) {
    let tmpdata = "data:/:"+desks[desk].columns+":/:";
    let columns = desks[desk].columns
    for (let i = 0; i < columns; i++) {
        tmpdata = tmpdata + (desks[desk].column[i+""].name) + ":/:";
        tmpdata = tmpdata + (desks[desk].column[i+""].rows) + ":/:";
        for (let o = 0; o < desks[desk].column[i+""].rows; o++) {
            tmpdata = tmpdata + (desks[desk].column[i+""].row[o+""].color) + ":/:";
            tmpdata = tmpdata + (desks[desk].column[i+""].row[o+""].text) + ":/:";
        }
    }
    _websock.send(tmpdata)
    let tmpusers = 0;
    for (let _id in clients) {
        if (clients[_id].logged) tmpusers++;
    }
    tmpdata = "users:/:"+tmpusers+":/:"
    for (let _id in clients) {
        tmpdata = tmpdata + clients[_id].nick + ":/:"
    }
    
    _websock.send(tmpdata)
}

function cursor(message, _nickname) {
    let mess = decoder.decode(message)
    for (let _id in clients) {
        clients[_id].send("cursor:/:"+_nickname+":/:"+tokenat(mess,1,":/:")+":/:"+tokenat(mess,2,":/:"));
    }
}

function touch(message, _nickname) {
    let mess = decoder.decode(message)
    for (let _id in clients) {
        clients[_id].send("touch:/:"+_nickname+":/:"+tokenat(mess,1,":/:")+":/:"+tokenat(mess,2,":/:"));
    }
}

function click(_nickname,_clicktype) {
    for (let _id in clients) {
        clients[_id].send("click:/:"+_nickname+":/:"+_clicktype);
    }
}

function card(message, _nickname) {
    let mess = decoder.decode(message)
    for (let _id in clients) {
        clients[_id].send(mess);
    }
    desks[desk].column[tokenat(mess,1,":/:")].row[tokenat(mess,2,":/:")].color = tokenat(mess,3,":/:")
    desks[desk].column[tokenat(mess,1,":/:")].row[tokenat(mess,2,":/:")].text = tokenat(mess,4,":/:")
    save()
}

function column(message, _nickname) {
    let mess = decoder.decode(message)
    for (let _id in clients) {
        clients[_id].send(mess);
    }
    desks[desk].column[tokenat(mess,1,":/:")].name = tokenat(mess,2,":/:")
    save()
}

function grayscale(_nickname, _logic) {
    for (let _id in clients) {
        clients[_id].send("grayscale:/:"+_nickname+":/:"+_logic);
    }
}

function carddelete(message, _nickname) {
    let mess = decoder.decode(message)
    for (let _id in clients) {
        clients[_id].send(mess);
    }
    for (let i = 0; i < desks[desk].column[tokenat(mess,1,":/:")].rows-tokenat(mess,2,":/:")-1; i++) {
        let row0 = parseInt(tokenat(mess,2,":/:"))+i
        let row1 = row0+1
        desks[desk].column[tokenat(mess,1,":/:")].row[row0].text = desks[desk].column[tokenat(mess,1,":/:")].row[row1].text
        desks[desk].column[tokenat(mess,1,":/:")].row[row0].color = desks[desk].column[tokenat(mess,1,":/:")].row[row1].color
    }
    delete desks[desk].column[tokenat(mess,1,":/:")].row[desks[desk].column[tokenat(mess,1,":/:")].rows-1]
    desks[desk].column[tokenat(mess,1,":/:")].rows--;
    save()
}

function columndelete(message, _nickname) {
    let mess = decoder.decode(message)
    for (let _id in clients) {
        clients[_id].send(mess);
    }

    for (let i = 0; i < desks[desk].columns-tokenat(mess,1,":/:")-1; i++) {
        desks[desk].column[parseInt(tokenat(mess,1,":/:"))+i] = desks[desk].column[parseInt(tokenat(mess,1,":/:"))+i+1] 
    }
    delete desks[desk].column[desks[desk].columns-1]
    desks[desk].columns--;
    save()
}

function columnadd(_nickname) {
    for (let _id in clients) {
        clients[_id].send("columnadd:/:Новая колонка");
    }
    desks[desk].column[desks[desk].columns] = JSON.parse('{"name":"Новая колонка","rows":0}')
    desks[desk].columns++
    save()
}

function cardadd(message, _nickname) {
    let mess = decoder.decode(message)
    for (let _id in clients) {
        clients[_id].send("cardadd:/:"+tokenat(mess,1,":/:")+":/:Новая карточка:/:"+(desks[desk].column[parseInt(tokenat(mess,1,":/:"))].rows).toString());
    }
    if (!desks[desk].column[parseInt(tokenat(mess,1,":/:"))].row) {
        desks[desk].column[parseInt(tokenat(mess,1,":/:"))].row = JSON.parse('{"0":{"color":"0","text":"Новая карточка"}}')
    } else {
    desks[desk].column[parseInt(tokenat(mess,1,":/:"))].row[desks[desk].column[parseInt(tokenat(mess,1,":/:"))].rows] = JSON.parse('{"color":"0","text":"Новая карточка"}')
    }
    desks[desk].column[parseInt(tokenat(mess,1,":/:"))].rows++
    save()
}

function cardmove (message, _nickname) {
    let mess = decoder.decode(message)
    for (let _id in clients) {
        clients[_id].send(mess);
    }
    let card0column = parseInt(tokenat(mess,1,":/:"))
    let card0h = parseInt(tokenat(mess,2,":/:"))
    let poscolumn = parseInt(tokenat(mess,3,":/:"))
    let posh = parseInt(tokenat(mess,4,":/:"))
    let backupcard = desks[desk].column[card0column].row[card0h]

    if (card0column == poscolumn) {
        if (card0h < posh) {
            for (let i = card0h; i < posh; i++) {
                desks[desk].column[card0column].row[i] = desks[desk].column[card0column].row[i+1]
            }
            desks[desk].column[card0column].row[posh] = backupcard


        } else {
            for (let i = card0h; i > posh; i--) {
                desks[desk].column[card0column].row[i] = desks[desk].column[card0column].row[i-1]
            }
            desks[desk].column[card0column].row[posh] = backupcard

        }
    } else {
        for (let i = 0; i < desks[desk].column[card0column].rows-card0h-1; i++) {
            let row0 = card0h+i
            let row1 = row0+1
            desks[desk].column[card0column].row[row0] = desks[desk].column[card0column].row[row1]
        }
        delete desks[desk].column[card0column].row[desks[desk].column[card0column].rows-1]
        desks[desk].column[card0column].rows--;
        desks[desk].column[poscolumn].rows++;
        for (let i = desks[desk].column[poscolumn].rows-1; i > posh; i--) {
            desks[desk].column[poscolumn].row[i] = desks[desk].column[poscolumn].row[i-1]
        }
        if (!desks[desk].column[poscolumn].row) {
            desks[desk].column[poscolumn].row = JSON.parse('{"0":{"color":"0","text":"Новая карточка"}}')
        }
        desks[desk].column[poscolumn].row[posh] = backupcard
    }
    save()
}

function columnmove(message, _nickname) {
    let mess = decoder.decode(message)
    for (let _id in clients) {
        clients[_id].send(mess);
    }

    let backupcolumn = desks[desk].column[parseInt(tokenat(mess,1,":/:"))]
    if (parseInt(tokenat(mess,2,":/:")) < parseInt(tokenat(mess,1,":/:"))) {

        for (let i = desks[desk].columns-1; i >= 0; i--) {
            if (i >= parseInt(tokenat(mess,2,":/:")) && i < parseInt(tokenat(mess,1,":/:"))) {
                desks[desk].column[i+1] = desks[desk].column[i]
            }
        }
        desks[desk].column[parseInt(tokenat(mess,2,":/:"))] = backupcolumn
    } else {
        for (let i = 0; i < desks[desk].columns; i++) {
            if (i < parseInt(tokenat(mess,2,":/:")) && i > parseInt(tokenat(mess,1,":/:"))) {
                desks[desk].column[i-1] = desks[desk].column[i]
            }
        }
        desks[desk].column[parseInt(tokenat(mess,2,":/:"))-1] = backupcolumn
    }
    save()
}

function save() {
    fs.writeFile('./desks.json', JSON.stringify(desks), function (err) {
        if (err) return console.log(err);
      });
      
}

ws.on('connection', (ws, req) => {
    let id = Math.random();
    clients[id] = ws;
    clients[id].ip = ws._socket.remoteAddress;

    ws.on('message', function(message) {
        if (message.slice(0,5) == "pass:") {
            let tmplog = tokenat(message,1,":/:")
            let tmppass = tokenat(message,2,":/:");
            if (accounts[tmplog] && accounts[tmplog].pass == tmppass) {
                let loggedflag = false;
                for (let _id in clients) {
                    if (clients[_id].logged && clients[_id].nick == tmplog) loggedflag = true;
                }
                if (!loggedflag) {
                clients[id].admin = accounts[tmplog].admin;
                clients[id].logged = true;
                clients[id].nick = accounts[tmplog].nick;
                clients[id].send('pass/success/'+clients[id].admin);
                console.log(`[ + ] ${clients[id].nick}  ${clients[id].ip}   ${tmppass}`);
                 } else {
                    clients[id].send('kick/double');
                    clients[id].close();
                }
            } else {
                if (whitelist) {
                    clients[id].send('kick/whitelist');
                    console.log(`[ ! ] ${tmplog}  ${clients[id].ip}   ${tmppass}`);
                    clients[id].close();
                } else {
                    clients[id].send('pass/fail');
                    clients[id].logged = true;
                }
            }};
        if (message == "ver" && clients[id].logged) {
            clients[id].send("ver/"+version)
        }
        if (message == "ready" && clients[id].logged) {
            clients[id].ready = true;
            ready(clients[id]);
            for (let _id in clients) {
                clients[_id].send("join:/:"+clients[id].nick)
            }
        };
        if (clients[id].logged) {
            if (tokenat(message,0,":/:") == "mycursor") cursor(message, clients[id].nick);
            if (tokenat(message,0,":/:") == "mytouch") touch(message, clients[id].nick);
            if (tokenat(message,0,":/:") == "myclick") click(clients[id].nick, tokenat(message,1,":/:"));
            if (tokenat(message,0,":/:") == "grayscaleme") grayscale(clients[id].nick, tokenat(message,1,":/:"));

            if (clients[id].admin) {
                if (tokenat(message,0,":/:") == "card") card(message, clients[id].nick);
                if (tokenat(message,0,":/:") == "column") column(message, clients[id].nick);
                if (tokenat(message,0,":/:") == "carddelete") carddelete(message, clients[id].nick);
                if (tokenat(message,0,":/:") == "columndelete") columndelete(message, clients[id].nick);
                if (tokenat(message,0,":/:") == "cardadd") cardadd(message, clients[id].nick);
                if (tokenat(message,0,":/:") == "columnadd") columnadd(message, clients[id].nick);
                if (tokenat(message,0,":/:") == "cardmove") cardmove(message, clients[id].nick);
                if (tokenat(message,0,":/:") == "columnmove") columnmove(message, clients[id].nick);
            }
        };
    });

    ws.on('close', function() {
        if (clients[id].logged) {
            console.log(`[ - ] ${clients[id].nick}  ${clients[id].ip}`);
            for (let _id in clients) {
                clients[_id].send("out:/:"+clients[id].nick)
            }
        }
        delete clients[id];
    });

});