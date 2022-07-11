console.log("Electron Iniciado");
console.log("APP_VERSION: 1.1.2  DATE: 06 AGO 2018");

const fs = require('fs');
// Watchdog
fs.closeSync(fs.openSync("/app/ramdisk/watchdog", 'w'));
setInterval(function () {
    fs.closeSync(fs.openSync("/app/ramdisk/watchdog", 'w'));
}, 2000);

// Librerias utilizadas
const sqlite3 = require('sqlite3').verbose();
//const exec = require('child_process').exec;
const async = require('async');

const pubsub = require('./pubsub.js');
const fp = require('./fp.js');
const gui = require('./gui.js');
const rfid = require('./rfid.js');
const database = require('./database.js');
const s = require('./sound.js');

const isOnline = require('is-online');
const schedule = require('node-schedule');
const memwatch = require('memwatch-next');
const procfs = require('procfs-stats');
const ipcMain = require('electron').ipcMain;

let util = require('./util.js');

let enMantenimiento = "";
let eqBloqueado = "";

let wifiSignal = 0;
let tipoRed = '';
let onlineStatus = false;


//TODO: Solucion temporal para el finger detected en el enroll
let toEnrolling = null;
let enrolling = false; //dejo el enrolling en true por unos segundos hasta que la persona saque el dedo la ultima vez. sino aparece el relojito

//TODO: solucion temporal para resetear el lector todos los dias a la medianoche.
schedule.scheduleJob('0 0 * * *', () => { fp.reset() }); // run everyday at midnight

// Errores a consola
process.on('uncaughtException', function (err) {
    console.error(err.message + "\n\n" + err.stack);
});

process.on('SIGTERM', function () {
    console.log('electron shutting down... SIGTERM');
    process.exit(0);
});
process.on('SIGINT', function () {
    console.log("electron caught interrupt signal");
    process.exit(0);
});

//si el archivo de configuracion no existe, lo creo
if (!fs.existsSync('/data/config')) fs.writeFileSync('/data/config', JSON.stringify({
    'client_id': 0,
    'sub_dom': 'manager'
}), 'utf8');

let staticConfig = JSON.parse(fs.readFileSync('/data/config', 'utf8'));


let equipoID = process.env.RESIN_DEVICE_UUID; // Hacer con ID equipo despues.
let clientID = process.env.CLIENT_ID || staticConfig.client_id; // Hacer con ID equipo despues.
let subDom = process.env.SUB_DOM || staticConfig.sub_dom;


// Vars para algunos timeouts
let TOenroll = null;
let TOrfRead = null;
let TOPubSub = null;
let TOPing = null;

let db = new sqlite3.Database('/data/tk822.db');
database.updatedb(db); // Verifico que este actualizada

let testdb = db.serialize(function () {
    db.all("select * from logs_equipo;", function (err, rows) {
        if (err) {
            console.log(err);
        }
        else {
            var data = [];

            rows.forEach(function (row) {
                data.push(
                    {
                        log_id: row.id,
                        persona: row.persona_id,
                        lector: row.lector,
                        fecha: row.fecha_hora,
                        accion: row.accion,
                        dedo: row.dedo
                    });
            });


            fs.writeFileSync('/data/databasetest.txt', JSON.stringify(data));
        }
    })
});



let ps = new pubsub(subDom, clientID, equipoID);

fp.setidentifycb(identificacion);
fp.setenrollcb(errolled);
fp.setfingerDetectedcb(fingerDetected);
fp.reloadFingerprints(loadHuellas);

let rf = new rfid(identificacion);
let sound = new s();
let mw = new gui();

// PubSub asyncrono
setTimeout(ps.connect, 100);


loadHuellas();

rf.identify();

TOPing = setTimeout(ping, 60000);

setInterval(checkPubsub, 10000);

util.checkLockUpdatesFiles();

setInterval(checkWifiSignal, 11000);
checkWifiSignal(true);


var LoadingHuellaTO = null;


function loadHuellas(updateNow) {
    if (typeof updateNow !== 'undefined')
        updateNow = 0;
    else
        updateNow = (process.env.LOAD_HUELLA_TIMEOUT || 5) * 1000;
    clearTimeout(LoadingHuellaTO);

    LoadingHuellaTO = setTimeout(function () {
        fp.printsClear();
        db.all("select h.dedo as dedo, h.persona_id as persona_id, h.datos as datos " +
            "from huella h, personas p where h.persona_id = p.id and p.enable = 1;", function (err, rows) {
            if (err) {
                console.log(err);
            } else {
                let cont = 0;
                rows.forEach(function (row) {
                    if (row.datos) {
                        fp.printsAdd(row.persona_id, row.datos, row.dedo);
                        cont++;
                    }
                });
                console.log("Cargadas " + cont + " huellas");
                if (!fp.isEnrolling()) {
                    fp.identify();
                }
            }
        });
    }, updateNow);
}


let sendingLogs = null;

function sendLogs() {
    clearTimeout(sendingLogs);
    sendingLogs = setTimeout(function () {
        db.all("select * from logs_equipo;", function (err, rows) {
            if (err) {
                console.log(err);
            }

            else {
                var data = [];
                rows.forEach(function (row) {
                    data.push(
                        {
                            log_id: row.id,
                            persona: row.persona_id,
                            lector: row.lector,
                            fecha: row.fecha_hora,
                            accion: row.accion,
                            dedo: row.dedo
                        });


                    if (data.length >= 50){
                        ps.sendSync('CMD_LOG', data, {}, function (err) {
                            if (!err) {
                                console.log("Enviado logs");
                            }
                        });
                        data = [];
                    }


                });


                if(data.length >= 1){
                    ps.sendSync('CMD_LOG', data, {}, function (err) {
                        if (!err) {
                            console.log("Enviado logs");
                        }
                    });
                    data = [];
                }



            }
        });
    }, (process.env.SEND_LOG_WAIT || 30) * 1000);
}


function sync(datos, tipo, sess_id, att, cb, array) {
    switch (tipo) {
        case 'TYPE_PERSON':
            console.log("Sync Persona " + datos.per_Id);

            if (datos.per_Eliminada === 0) {
                db.run("insert or replace into personas " +
                    "(id, hor_tipo, hor_id, legajo, nombre, apellido, dni, tag, enable, eliminado, fecha_mod) " +
                    "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
                    [
                        Number(datos.per_Id),
                        Number(datos.per_Hor_Tipo),
                        Number(datos.per_Hor_Id),
                        datos.per_Legajo,
                        datos.per_Nombre,
                        datos.per_Apellido,
                        datos.per_Dni,
                        datos.per_Tag,
                        Number(datos.per_Enabled),
                        0,
                        Number(datos.per_Fecha_Mod)
                    ], function (err) {
                        if (err)
                            console.log(err);

                        if (typeof att.req == 'undefined') {
                            if(sess_id !== 'api') { //no envio nada al browser si la llamada vino de la api
                                ps.sendBrowser('CMD_ACK', [{
                                    id: datos.per_Id,
                                    result: (err ? 'ERROR' : 'OK')
                                }], {
                                    type: tipo,
                                    sess_id: sess_id
                                });
                            }
                        }
                        db.run("UPDATE fechas_mod SET " +
                            "fecha_mod = ? " +
                            "WHERE tabla = 'persons' and fecha_mod < ?;",
                            [Number(datos.per_Fecha_Mod), Number(datos.per_Fecha_Mod)], function (err) {
                                if (err)
                                    console.log(err);
                                cb();
                            });
                    });

                //datos = Buffer.from(JSON.stringify(datos));


                let buf = Buffer.from(JSON.stringify(datos.per_Imagen), 'base64');
                if (buf.length > 0) {
                    fs.writeFile("/data/img/" + datos.per_Id + '.png', buf, function (err) {
                        if (err) {
                            return console.log(err);
                        }
                        console.log("Foto saved!");
                    });
                }
                // Persona Eliminada
            }
            else {
                db.run("DELETE from personas where id = ?;",
                    [Number(datos.per_Id)],
                    function (err) {

                        if (typeof att.req == 'undefined')
                            ps.sendSync('CMD_ACK_ELIMINADO', [{
                                id: datos.per_Id,
                                result: (err ? 'ERROR' : 'OK')
                            }], {
                                type: tipo
                            });
                        db.run("UPDATE fechas_mod SET " +
                            "fecha_mod = ? " +
                            "WHERE tabla = 'persons' and fecha_mod < ?;",
                            [Number(datos.per_Fecha_Mod), Number(datos.per_Fecha_Mod)], function (err) {
                                if (err)
                                    console.log(err);
                                cb();
                            });
                    });
            }
            loadHuellas();
            break;
        case 'TYPE_FINGERPRINT':
            console.log('Recibido Huella ' + datos.hue_Id);
            if (datos.hue_Eliminada == 0) {
                db.run("insert or replace into huella " +
                    "(id, persona_id, dedo, datos, enabled, eliminado, fecha_mod) " +
                    "values (?, ?, ?, ?, ?, ?, ?);",
                    [
                        Number(datos.hue_Id),
                        Number(datos.hue_Per_Id),
                        Number(datos.hue_Dedo),
                        datos.hue_Datos,
                        Number(datos.hue_Enabled),
                        0,
                        Number(datos.hue_Fecha_Mod)
                    ], function (err) {
                        if (err)
                            console.log(err);

                        if (typeof att.req == 'undefined') {
                            if(sess_id !== 'api') { //no envio nada al browser si la llamada vino de la api
                                ps.sendBrowser('CMD_ACK', [{
                                    id: datos.per_Id,
                                    result: (err ? 'ERROR' : 'OK')
                                }], {
                                    type: tipo,
                                    sess_id: sess_id
                                });
                            }
                        }
                        db.run("UPDATE fechas_mod SET " +
                            "fecha_mod = ? " +
                            "WHERE tabla = 'fingerprints' and fecha_mod < ?;",
                            [Number(datos.hue_Fecha_Mod), Number(datos.hue_Fecha_Mod)], function (err) {
                                if (err)
                                    console.log(err);
                                if(array)
                                    loadHuellas();
                                else
                                    loadHuellas(true);
                                cb();
                            });
                    });
            } else {
                db.run("DELETE from huella where id = ?;",
                    [Number(datos.hue_Id)],
                    function (err) {

                        if (typeof att.req == 'undefined')
                            ps.sendSync('CMD_ACK_ELIMINADO', [{
                                id: datos.per_Id,
                                result: (err ? 'ERROR' : 'OK')
                            }], {
                                type: tipo
                            });
                    });

                db.run("UPDATE fechas_mod SET " +
                    "fecha_mod = ? " +
                    "WHERE tabla = 'fingerprints' and fecha_mod < ?;",
                    [Number(datos.hue_Fecha_Mod), Number(datos.hue_Fecha_Mod)], function (err) {
                        if (err)
                            console.log(err);

                        if(array)
                            loadHuellas();
                        else
                            loadHuellas(true);
                        cb();
                    });
            }

            break;
        case 'TYPE_NORMAL_HOURS':
            console.log('Recibido Normal Hours');
            break;
        case '':
            break;
    }
}

// Callbacks

function errolled(resp) {
    clearTimeout(TOenroll);

    enrolling = true;
    clearTimeout(toEnrolling);
    toEnrolling = setTimeout(function () {
        enrolling = false;
    }, 30000);

    if (typeof resp.data !== 'undefined') {
        // Lectura Correcta de Huella
        ps.sendSync('CMD_ENROLL_OK', resp.data, {
            sess_id: resp.data.sess_id
        });

        console.log(JSON.stringify(resp.data));
        if(resp.data.sess_id !== 'api') {
            ps.sendBrowser('CMD_ENROLL_STATUS', {
                status: 'OK',
                id: resp.data.hue_id
            }, {
                sess_id: resp.data.sess_id
            });
        }
        db.get("select enable " +
            "from personas  where id = ? ;", [resp.data.per_id], function (err, row) {
            if (err) {
                console.log(err);
            } else {
                if (row.enable > 0) {
                    db.run("insert or replace into huella " +
                        "(id, persona_id, dedo, datos, enabled, eliminado, fecha_mod) " +
                        "values (?, ?, ?, ?, ?, ?, ?);",
                        [
                            Number(resp.data.hue_id),
                            Number(resp.data.per_id),
                            Number(resp.data.hue_dedo),
                            resp.data.hue_datos,
                            1, // enable
                            0, // eliminado
                            0  // fecha mod
                        ], function (err) {
                            if (err)
                                console.log(err);
                            loadHuellas();
                        });
                }
            }
        });

        sound.playOk(300);
        mw.mainWindow.webContents.send('pagina',
            {
                pag: 'pagMensaje',
                img: 'registro-ok',
                msgGrande: {
                    txt: 'Etapa de registro exitosa<br><b>Muchas Gracias</b>',
                    tipo: 'ok'
                },
                msgChico: ''
            });
        setTimeout(function () {
            enrolling = false;
        }, 3000);
        ping();
        // Hay otra muestra
    } else if (typeof resp.muestra !== 'undefined') {
        let msg = '';
        let etapa = '1';
        switch (Number(resp.muestra) % 4) {
            case 0:
                msg = 'Otra vez<br>por favor';
                etapa = '1';
                break;
            case 1:
                msg = 'De nuevo<br>por favor';
                etapa = '2';
                break;
            case 2:
                msg = 'Por favor<br>otra vez';
                etapa = '3';
                break;
            case 3:
                msg = 'Por favor<br>de nuevo';
                etapa = '4';
                break;
        }

        if (typeof resp.err !== 'undefined') {
            if(resp.err===1)
                msg = '<span class="error">Error, reintente</span><br>';
            else if(resp.err===2)
                msg = '<span class="error">La huella ya existe</span><br>';
        }
        sound.playOk(150);
        mw.mainWindow.webContents.send('pagina', {
            pag: 'pagEnroll',
            msg: msg,
            etapa: etapa,
            etapaMax: '4'
        });
    } else {
        sound.playError(300);
        if(resp.sess_id !== 'api') {
            ps.sendBrowser('CMD_ENROLL_STATUS', {
                status: 'ERROR',
                id: resp.hue_Id
            }, {
                sess_id: resp.sess_id
            });
        }
    }
}


function errolledRF(resp) {
    clearTimeout(TOrfRead);
    if (typeof resp.tag !== 'undefined') {

        db.get("SELECT * FROM personas WHERE tag =?;", [resp.tag], function (err, row) {
            if (row === undefined) {
                // Lectura Correcta de Huella
                ps.sendSync('CMD_RFID_READ_OK', resp, {
                    sess_id: resp.sess_id
                });
                console.log(JSON.stringify(resp));
                if(resp.sess_id !== 'api') {
                    ps.sendBrowser('CMD_RFID_READ_STATUS', {
                        status: 'OK',
                        per_id: resp.per_id
                    }, {
                        sess_id: resp.sess_id
                    });
                }

                sound.playOk(150);
                mw.mainWindow.webContents.send('pagina',
                    {
                        pag: 'pagMensaje',
                        img: 'registro-ok',
                        msgGrande: {
                            txt: 'Etapa de registro exitosa<br><b>Muchas Gracias</b>',
                            tipo: 'ok'
                        },
                        msgChico: ''
                    });
            } else {
                if(resp.sess_id !== 'api') {
                    ps.sendBrowser('CMD_RFID_READ_STATUS', {
                        status: 'ERROR',
                        per_id: resp.per_id,
                        owner_id: row.id,
                        owner_name: row.nombre,
                        owner_lastname: row.apellido
                    }, {
                        sess_id: resp.sess_id
                    });
                }

                sound.playError(300);
                mw.mainWindow.webContents.send('pagina',
                    {
                        pag: 'pagMensaje',
                        img: 'registro-no',
                        msgGrande: {
                            txt: 'Tarjeta ya registrada',
                            tipo: 'error'
                        },
                        msgChico: ''
                    });
            }
        });
    } else {

        sound.playError(300);
        if(resp.sess_id !== 'api') {
            ps.sendBrowser('CMD_ENROLL_STATUS', {
                status: 'ERROR',
                per_id: resp.per_id
            }, {
                sess_id: resp.sess_id
            });
        }
    }
}

var conta = 0;


function identificacion(data) {
    var hrTime = process.hrtime();
    var cont = conta++;

    if (typeof data.err !== 'undefined') {
        if (data.err === -1) {
            mw.mainWindow.webContents.send('pagina', {
                pag: 'pagMensaje',
                img: 'tryagain',
                msgGrande: {
                    txt: 'No pude leer eso, por favor intenta de nuevo;',
                    tipo: 'error'
                },
                msgChico: '',
                timeout: 2000
            });
            sound.playError(300);
        }
    } else {
        var q = -1;
        var query = '';
        var lector = 0;
        if (typeof data.fp != 'undefined') {
            q = data.fp;
            query = 'SELECT * FROM personas WHERE id = ?;';
            lector = 1;
        } else if (typeof data.tag != 'undefined') {
            q = data.tag;
            query = 'SELECT * FROM personas WHERE tag = ?;';
            lector = 2;
        }

        db.get(query, [q],
            function (err, rows) {

                if (!err && rows != undefined) {
                    if (rows.enable == 1) {
                        var img = '/data/img/' + rows.id + '.png';
                        var d = new Date();
                        mw.mainWindow.webContents.send('pagina', {
                            pag: 'pagIdentificado',
                            img: img,
                            nombre: rows.nombre + ' ' + rows.apellido,
                            legajo: rows.legajo,
                            hora: ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
                        });

                        sound.playOk(150);
                    } else {
                        mw.mainWindow.webContents.send('pagina', {
                            pag: 'pagMensaje',
                            img: 'registro-no',
                            msgGrande: {
                                txt: 'Persona no habilitada',
                                tipo: 'error'
                            },
                            msgChico: ''
                        });
                        sound.playError(300);
                    }
                    db.run("insert into logs_equipo " +
                        "(lector, fecha_hora, persona_id, accion, extra, dedo) " +
                        "values (?," +
                        " strftime('%s','now')," +
                        " ?," +
                        " ?," +
                        " 0," +
                        " ?);",
                        [lector, rows.id, (rows.enable == 1 ? 1 : 3), (data.dedo ? data.dedo : -1)],
                        function (err) {
                            if (err) {
                                console.log(err);
                            } else {
                                sendLogs();
                            }
                        });
                } else {
                    mw.mainWindow.webContents.send('pagina', {
                        pag: 'pagMensaje',
                        img: 'tryagain',
                        msgGrande: {
                            txt: 'Tarjeta no registrada',
                            tipo: 'warning'
                        },
                        msgChico: ''
                    });

                    db.run("insert into logs_equipo " +
                        "(lector, fecha_hora, persona_id, accion, extra, dedo) " +
                        "values (2," +
                        " strftime('%s','now')," +
                        " -1," +
                        " 2," +
                        " 0," +
                        " -1);",
                        function (err) {
                            if (err)
                                console.log(err);
                        });
                    sound.playError(300);
                }
            });
    }
}


// TODO: Enviar cada funcion a su objeto correspondiente
let functions = {


    'CMD_LOGS': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        sendLogs();
    },

    'CMD_SYNC': (att, data)=> {
        console.log(' let functions CMD_SYNC');
        data = JSON.parse(data);
        //console.log('data_string');
        //console.log(data);


        if (Array.isArray(data)) {
            console.log("Recibidos " + data.length + " en el array de datos.");
            async.eachLimit(data, 1, function (data, cb) {
                console.log('async.eachLimit: data');
                console.log(data);
                if(data.length===1)
                    sync(data, att.type, att.sess_id, att, cb, false);  //not coming in an array
                else
                    sync(data, att.type, att.sess_id, att, cb, true);
            }, function (err) {
                clearTimeout(TOPing);
                TOPing = setTimeout(ping, (process.env.SYNC_PING_INTERVAL || 15 ) * 1000);
            });
        }
        else {
            sync(data, att.type, att.sess_id, att, function () {
                clearTimeout(TOPing);
                TOPing = setTimeout(ping, (process.env.SYNC_PING_INTERVAL || 15) * 1000);
            });
        }
    },

    'CMD_ENROLL_START': (att, data)=> {

        data = JSON.parse(data);
        console.log('Enroll de Huella ' + data.per_id);
        //console.log(JSON.parse(data));
        data['sess_id'] = att.sess_id;

        // Cambio pantalla
        if (data['fecha_start'] < ~~(Date.now() / 1000) + 30) { // timestamp + 30s

            // Muestro pantalla
            db.get("select nombre, apellido, legajo from personas where id=?;", [data.per_id], function (err, rows) {

                if (err) {
                    console.log(err);
                } else if (rows !== undefined) {
                    mw.mainWindow.webContents.send('pagina', {
                        pag: 'pagEnroll',
                        nombre: rows.nombre,
                        apellido: rows.apellido,
                        legajo: rows.legajo,
                        dedo: data.hue_dedo,
                        etapa: '1',
                        etapaMax: '4'
                    });
                    sound.playOk(150);
                    setTimeout(function(){sound.playOk(150);},75);
                }
            });

            // Inicio enrollment
            fp.enroll(data, errolled);

            // Mando respuesta al server sobre comienzo
            if(att.sess_id !== 'api') {
                ps.sendBrowser('ACK_ENROLL_START', {
                    id: data.hue_id
                }, {
                    sess_id: att.sess_id
                });
            }
            enrolling=true;

            // Inicio timeout para que se pare el enroll
            TOenroll = setTimeout(function () {
                fp.identify();
                if(att.sess_id !== 'api') {
                    ps.sendBrowser('CMD_ENROLL_STATUS', {
                        status: 'CANCEL',
                    }, {
                        sess_id: att.sess_id
                    });
                }
                mw.mainWindow.webContents.send('pagina', {pag: 'pagPrincipal'});
            }, (process.env.ENROLL_TIMEOUT || 30) * 1000)
        }
    },

    'CMD_ENROLL_CANCEL': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        fp.identify();
        if(att.sess_id !== 'api') {
            ps.sendBrowser('CMD_ENROLL_STATUS', {
                status: 'CANCEL',
            }, {
                sess_id: att.sess_id
            });
        }
        mw.mainWindow.webContents.send('pagina', {pag: 'pagPrincipal'});
    },

    'CMD_RFID_READ_CANCEL': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        rf.identify();
        if(att.sess_id !== 'api') {
            ps.sendBrowser('CMD_RFID_READ_STATUS', {
                status: 'CANCEL',
            }, {
                sess_id: att.sess_id
            });
        }
        mw.mainWindow.webContents.send('pagina', {pag: 'pagPrincipal'});
    },

    'CMD_PONG': (att, data)=> {
        console.log('Recibido ' + att.cmd + ': ' + JSON.stringify(att));
        switch (att.status) {
            case 'maintenance':
                if (!enMantenimiento) {
                    functions['CMD_MAINTENANCE_ENABLE'](att, data);
                }
                break;
        }
        clearTimeout(TOPubSub);
    },

    'CMD_CONFIG': (att, data)=> {
        console.log('Recibido ' + att.cmd);
    },

    'ACK_LOG': (att, data)=> {
        data = JSON.parse(data);
        console.log('Recibido ' + att.cmd);
        data.forEach(function (result) {
            console.log('1) Antes de log OK');
            if (result.status == 'OK')
                db.run("DELETE from logs_equipo where id=?", [result.id], function (err) {
                    if (err)
                        console.log(err);
                });
        });

    },

    'CMD_PING': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        ps.sendSync('CMD_PONG', {}, {});
        checkWifiSignal(true);
    },

    'CMD_RFID_READ_START': (att, data)=> {

        data = JSON.parse(data);

        console.log('Recibido ' + att.cmd);
        console.log('Enroll RFID de ' + data.per_id);

        data['sess_id'] = att.sess_id;

        // Cambio pantalla
        if (Number(data['fecha_start']) < ~~(Date.now() / 1000) + 30) { // timestamp + 30s
            // Muestro pantalla
            db.get("select nombre, apellido, legajo from personas where id=?;", [data.per_id], function (err, row) {

                if (err) {
                    console.log(err);
                } else if (row != undefined) {
                    mw.mainWindow.webContents.send('pagina', {
                        pag: 'pagEnrollRF',
                        nombre: row.nombre,
                        apellido: row.apellido,
                        legajo: row.legajo
                    });
                }
            });
            // Inicio enrollment
            rf.enroll(data, errolledRF);

            // Mando respuesta al server sobre comienzo
            if(att.sess_id !== 'api') {
                ps.sendBrowser('ACK_RFID_READ_START', {
                    id: data.per_id
                }, {
                    sess_id: att.sess_id
                });
            }

            // Inicio timeout para que se pare el enroll
            TOrfRead = setTimeout(function () {
                rf.identify();
                if(att.sess_id !== 'api') {
                    ps.sendBrowser('CMD_ENROLL_STATUS', {
                        status: 'CANCEL',
                    }, {
                        sess_id: att.sess_id
                    });
                }
                mw.mainWindow.webContents.send('pagina', {pag: 'pagPrincipal'});
            }, (process.env.ENROLL_TIMEOUT || 30) * 1000)
        }
    },

    'CMD_REBOOT': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        util.rebootDevice();
    },

    'CMD_RESTART_APP': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        util.restartAPP();
    },

    'CMD_FORCE_PING': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        ping();
    },

    'CMD_CLEAR_NETWORK_INFO': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        util.removeNetworkConfig();
        setTimeout(util.rebootDevice,8000);
    },
   

    'CMD_PURGE_DATABASE': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        util.removeDatabase();
        util.removeImg();
        util.restartAPP();
    },

    'CMD_RESET_READER': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        fp.reset(data.time);
    },

    'CMD_LOCK_UPDATES': (att, data)=> {
        console.log('Locking Updates');
        util.lockUpdates();
    },

    'CMD_UNLOCK_UPDATES': (att, data)=> {
        console.log('Unlocking Updates');
        util.unlockUpdates();
    },

    'CMD_RESET_WIRELESS_NETWORK': (att, data)=> {
        console.log('Reset Wifi');
        util.reconnectWifi();
    },


    'CMD_FIRST_START': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        console.log('Key: ' + data.key);


        mw.mainWindow.webContents.send('pagina', {
            pag: 'pagInitialSetup',
            msgGrande: {
                txt: 'Ingresa a setup.enpuntocontrol.com',
                tipo: 'ok'
            },
            msgCodigo: data.key.substr(0, 3) + ' ' + data.key.substr(3, 3)
        });
    },

    'CMD_FIRST_START_CONFIG': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        console.log('client: ' + data.client_id);
        console.log('sub_dom: ' + data.sub_dom);
        fs.writeFileSync('/data/config', JSON.stringify({
            client_id: data.client_id,
            sub_dom: data.sub_dom
        }), 'utf8');
        util.restartAPP();
    },

    'CMD_BLINK': (att, data)=> {

        console.log('Recibido ' + att.cmd);
        mw.mainWindow.webContents.send('pagina',
            {
                pag: 'pagMensaje',
                img: 'registro-ok',
                msgGrande: {
                    txt: 'Soy ' + equipoID.substring(0, 8),
                    tipo: 'error'
                },
                msgChico: '',
                timeout: 2700,
                goBack: true
            });

        setTimeout(function () {
            sound.playOk(300);
        }, 0);
        setTimeout(function () {
            sound.playOk(300);
        }, 600);
        setTimeout(function () {
            sound.playOk(300);
        }, 1200);
        setTimeout(function () {
            sound.playOk(300);
        }, 1800);
        setTimeout(function () {
            sound.playOk(300);
        }, 2400);
    },

    'CMD_MAINTENANCE_ENABLE': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        mw.mainWindow.webContents.send('pagina',
            {
                pag: 'pagImg',
                img: 'mantenimiento',
                goBack: false
            });
        fp.stop();
        rf.stop();
        enMantenimiento = true;  //TODO: hacer que si en mantenimiento anden solo ciertos comandos
    },

    'CMD_MAINTENANCE_DISABLE': (att, data)=> {
        console.log('Recibido ' + att.cmd);

        mw.mainWindow.webContents.send('pagina',
            {
                pag: 'pagPrincipal'
            });
        fp.start();
        rf.start();
        enMantenimiento = false;
    },

    'CMD_BLOCK': (att, data)=> {
        console.log('Recibido ' + att.cmd);

        mw.mainWindow.webContents.send('pagina',
            {
                pag: 'pagImg',
                img: 'bloqueado',
                goBack: false
            });
        fp.stop();
        rf.stop();
        eqBloqueado = true;
        //todo: bloquear
    },

    'CMD_UNBLOCK': (att, data)=> {
        console.log('Recibido ' + att.cmd);
        mw.mainWindow.webContents.send('pagina',
            {
                pag: 'pagPrincipal'
            });
        fp.start();
        rf.start();
        eqBloqueado = false;
    },

    'CMD_DEBUG_INFO': (att, data)=> {
        console.log('Recibido ' + att.cmd);

        fp.showDebugInfo();
    },

    'CMD_WIFI_STATS': (att, data)=> {
        console.log('Recibido ' + att.cmd);

        checkWifiSignal(true);
    }


};


for (let f in functions) {
    ps.subscribe(f, functions[f]);
}


function ping() {
    db.all("select * from fechas_mod;", function (err, rows) {

        if (err) {
            console.log(err);
        }
        else {
            var data = {};
            rows.forEach(function (row) {
                data[row.tabla] = (row.fecha_mod == null ? 0 : row.fecha_mod);
            });
            data['status'] = {
                wifi:wifiSignal,
                network:tipoRed
            };
            console.log('Enviando PING: ' + JSON.stringify(data));

            ps.sendSync('CMD_PING', data, {});
            clearTimeout(TOPubSub);
            TOPubSub = setTimeout(function () {
                console.log("Reconectando pubusb");
                ps.reconnect();
            }, process.env.PUBSUB_TIMEOUT_RECONNECT * 1000 || 30000);
        }
        clearTimeout(TOPing);
        TOPing = setTimeout(ping, (process.env.PING_INTERVAL || 60 ) * 1000);
    });

    sendLogs();
}


function checkPubsub() {
    if (mw.mainWindow.webContents)
        mw.mainWindow.webContents.send('pubsubChange',
            {
                estado: ps.conectado
            });
}

/*
setInterval(checkWiFi, process.env.RECONNECT_WIFI_IF_OFFLINE_INTERVAL * 1000 || 600000);  //10 minutos por defecto

function checkWiFi(forced) {
    ifconfig.status(function (err, status) {
        let tipo = '';
        status.forEach(function (dev) {
            if (dev.link === 'ethernet' && typeof dev.ipv4_address !== 'undefined') {
                if (dev.interface.indexOf('wlan') !== -1)
                    tipo = 'wlan';
                else
                    tipo = 'eth';
            }
        });
        if (tipo === '' || tipo === 'wlan') {   //solo reseteo el wifi si no esta conectado al eth.
            isOnline().then(online => {
                if (!online || typeof forced !== 'undefined') {
                    util.reconnectWifi();
                }
            });
        }
    });
}
*/

function fingerDetected(quality) {
    if (typeof mw.mainWindow != 'undefined' && enrolling == false) {
        if (typeof quality == 'undefined') {
            mw.mainWindow.webContents.send('pagina', {
                pag: 'pagFingerDetected'
            });
        } else if (parseInt(quality) > 0) {

            mw.mainWindow.webContents.send('pagina', {pag: 'pagPrincipal'});

           /* mw.mainWindow.webContents.send('pagina',
                {
                    pag: 'pagMensaje',
                    img: 'registro-ok',
                    msgGrande: {
                        txt: 'No pude leer eso<br><b>Intenta de nuevo</b>',
                        tipo: 'error'
                    },
                    msgChico: '',
                    timeout: 2000,
                    goBack: true
                });
                */
            switch(parseInt(quality)){
                case 1: console.log("No Image");break;
                case 2: console.log("Too Light");break;
                case 3: console.log("Too Dark");break;
                case 4: console.log("Too Noisy");break;
                case 5: console.log("Low Contrast");break;
                case 6: console.log("Not Enough Features");break;
                case 7: console.log("Not Centered");break;
                case 8: console.log("Not a Finger");break;
                case 9: console.log("Too High");break;
                case 10: console.log("Too Low");break;
                case 11: console.log("Too Left");break;
                case 12: console.log("Too Right");break;
                case 13: console.log("Too Strange");break;
                case 14: console.log("Too Fast");break;
                case 15: console.log("Too Skewed");break;
                case 16: console.log("Too Short");break;
                case 17: console.log("Too Slow");break;
                case 18: console.log("Reverse Motion");break;
                case 19: console.log("Pressure Too Hard");break;
                case 20: console.log("Pressure Too Light");break;
                case 21: console.log("Wet Finger");break;
                case 22: console.log("Fake Finger");break;
                case 23: console.log("Too Small");break;
                case 24: console.log("Rotated Too Much");break;
            }
        }
    }
}

let button = require('./button.js');

button.start(36);  //GPIO16

button.resetTodo(function () {
    console.log('Borrando configuracion del equipo');
    mw.mainWindow.webContents.send('pagina', {
        pag: 'pagButtonDetected',
    });
    util.removeNetworkConfig();
    util.removeDatabase();
    util.removeImg();
    setTimeout(util.rebootDevice,8000);
});

button.resetWifi(function () {
    console.log('Borrando configuracion wifi');
    mw.mainWindow.webContents.send('pagina', {
        pag: 'pagButtonDetected',
    });
    util.removeNetworkConfig();
    setTimeout(util.rebootDevice,8000);
});

button.restartAPP(function () {
    console.log('Reiniciando APP');
    util.restartAPP();
});

button.reboot(function () {
    console.log('Reiniciando el equipo');
    util.rebootDevice();
});

button.pressedCount(function (count) {
    console.log('Boton de reset sigue presionado #: ',count);
});


button.resetWifiAchieved(function (count) {
    console.log('Suelte el boton para resetear solo el wifi');
});
button.resetTodoAchieved(function (count) {
    console.log('Suelte el boton para resetear todo');
});
button.restartAPPAchieved(function (count) {
    console.log('Suelte el boton para reiniciar la APP');
});
button.rebootAchieved(function (count) {
    console.log('Suelte el boton para reiniciar el equipo');
});
button.buttonPressed(function () {
    console.log('Boton de reset presionado');
});


if(process.env.DEBUG_MEMORY_LEAKS !== undefined) {
    console.log("Debug memory leaks enabled!");
    memwatch.on('leak', (info) => {
        console.error('Memory leak detected:\n', info);
        var diff = hd.end();
        console.log('snapshot diff', diff);
    });

    var hd = new memwatch.HeapDiff();
}

//reinicio forzado cuando no hay conexion
let tiempoSinInternet = 0;

try {
    fs.accessSync('/data/rebootSinInternet', fs.F_OK);
    console.log("viene de un reinicio sin internet");
    fs.unlinkSync('/data/rebootSinInternet');
} catch (e) {}

setInterval(() => {

    if (!onlineStatus)
        tiempoSinInternet++;
    else
        tiempoSinInternet = 0;

    if(tiempoSinInternet === (process.env.FORCE_RECONNECT_WHEN_NO_INTERNET_COUNT || 4) && tipoRed ==='wlan') {
        console.log("reconectando por ifdown/ifup...");
        setTimeout(() => {util.reconnectWifi()}, 60000);
        setTimeout(() => {console.log("se reconecto por ifdown/ifup")}, 600000);
    }

    if(tiempoSinInternet === (process.env.FORCE_RECONNECT_WHEN_NO_INTERNET_COUNT_2 || 8) && tipoRed ==='wlan') {
        console.log("reconectando por ifdown/ifup...");
        setTimeout(() => {util.reconnectWifi()}, 60000);
        setTimeout(() => {console.log("se reconecto por ifdown/ifup")}, 600000);
    }

    if (tiempoSinInternet > (process.env.FORCE_REBOOT_WHEN_NO_INTERNET_COUNT || 15)) {
        //tres horas y algo sin internet
        //if(process.env.FORCE_REBOOT_WHEN_NO_INTERNET !== undefined) {
            try {fs.writeFileSync('/data/rebootSinInternet', '');} catch (e) {}
            setTimeout(() => {util.rebootDevice()}, 60000);
        //}
    }

}, process.env.RECONNECT_IF_OFFLINE_INTERVAL * 1000 || 900000);//cada 15 minutos


function checkWifiSignal(output){

    procfs.wifi((err,wifi)=>{
        if(err){console.log(err);return;}

        if(wifi[0]!==undefined) {
            let quality = wifi[0].link.Quality;

            if (quality[quality.length - 1] === ".")
                quality = quality.slice(0, -1);

            let pcnt = Math.round((parseInt(quality) * 100) / 70);

            wifiSignal = pcnt;

            let step = 1;
            if (pcnt > 20) step = 2;
            if (pcnt > 40) step = 3;
            if (pcnt > 60) step = 4;
            if (pcnt > 80) step = 5;

            if (output) console.log("Wifi link quality: " + quality + "/70. That is a " + pcnt + "%. Step: " + step);

            if (mw.mainWindow.webContents)
                mw.mainWindow.webContents.send('updateWifiSignal',
                    {
                        quality: quality,
                        pcnt: pcnt,
                        step: step
                    });
        }else
            wifiSignal = 0;
    });
}


ipcMain.on('connectionType', (event, arg) => {

    tipoRed = arg;
    if(tipoRed==='')ps.conectado = false;

});

ipcMain.on('connectionStatus', (event, arg) => {
    //arg isOnline
    onlineStatus = arg;
    if(process.env.FORCE_RECONNECT_PUBSUB_WHEN_ONLINE_AND_NOT_CONNECTED !== undefined) {
        if (arg && ps.conectado === false) {
            ps.reconnect();
            setTimeout(() => {console.log("se reconecto por FORCE_RECONNECT_PUBSUB_WHEN_ONLINE_AND_NOT_CONNECTED")}, 600000);
        }
    }

});

