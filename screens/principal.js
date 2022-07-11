const ifconfig = require('wireless-tools/ifconfig');
const isOnline = require('is-online');
const exec = require('child_process').exec;
const {ipcRenderer} = require('electron');

let timeOut;
let FDtimeOut;

let onlineStatus = false;
let connectionType = '';
let firstStartForceClockSync = true;

exec('pkill gifview', function (error, stdout, stderr) {

});

function checkConection() {
    ifconfig.status(function (err, status) {

        for(let dev of status) {
            if (dev.interface.indexOf('eth') !== -1 && dev.link === 'ethernet' && typeof dev.ipv4_address !== 'undefined') {
                connectionType = 'eth';
                break;
            }else if (dev.interface.indexOf('wlan') !== -1 && dev.link === 'ethernet' && typeof dev.ipv4_address !== 'undefined') {
                connectionType = 'wlan';
                break;
            }else
                connectionType = '';
        }
        if (connectionType === '') {
            let imgconnection = document.getElementById('onlineStatus');
            let imgserver = document.getElementById('conectionStatus');

            imgconnection.src = 'img/offline.png';
            imgserver.src = 'img/status-server-off.png';

            ipcRenderer.send('connectionType', connectionType);
            ipcRenderer.send('connectionStatus', online);
        }
        else {
            isOnline().then(online => {
                let imgNetwork = document.getElementById('onlineStatus');
                let imgCloud = document.getElementById('conectionStatus');

                if (!online) {
                    imgNetwork.src = 'img/offline.png';
                    imgCloud.src = 'img/status-server-off.png';
                    onlineStatus = false;
                }
                else {
                    imgNetwork.src = 'img/' + connectionType + '-online.png';
                    onlineStatus = true;
                }
                ipcRenderer.send('connectionType', connectionType);
                ipcRenderer.send('connectionStatus', online);
            });
        }

    });
}

let syncClock = false;

function clock() {
    var divs = document.getElementsByClassName('hora');
    var hora;
    var h = '--';
    var m = '--';

    var date = new Date();
    var s = date.getSeconds();
    // Verifico cada 30s si tengo actualizado el reloj
    if ((s % 30 == 0 && syncClock == false) || firstStartForceClockSync) {
        if(firstStartForceClockSync){firstStartForceClockSync = false;}
        exec('/usr/sbin/ntpdate -q time1.google.com', function (error, stdout, stderr) {
            var patt = /offset (.*) sec/g;
            var res = patt.exec(stdout);
            syncClock = (res != null && !isNaN(res[1]) && Math.abs(res[1] - 0) < 10 && stdout.indexOf('no server suitable') < 1);
        });
    }


    if (syncClock) {
        m = pad(date.getMinutes().toString(), 2);
        h = pad(date.getHours().toString(), 2);
    } else if (s % 59 == 0) {
        exec('/usr/sbin/ntpdate time2.google.com', function (error, stdout, stderr) {
        });
    }

    if (s % 2)
        hora = h + ':' + m;
    else
        hora = h + ' ' + m;

    for (var i = 0; i < divs.length; i++) {
        divs[i].innerHTML = hora;
    }
}

var detectFinger = false;

var lastPagArg = {pag: 'pagPrincipal'};
function cambiarPagina(e, arg) {
    let cambiar = true;
    let pagP = document.getElementById('pagPrincipal').classList.contains('show');

    switch (arg.pag) {
        case 'pagPrincipal':
            lastPagArg = arg;
            break;

        case 'pagEnroll':
            detectFinger = true;
            lastPagArg = arg;
            document.getElementById('enrollMSG').innerHTML = arg.msg || 'Ingrese su<br>huella';
            document.getElementById('etapaNumero').innerHTML = arg.etapa;
            document.getElementById('etapaMax').innerHTML = arg.etapaMax;
            if (typeof arg.msg === 'undefined') {
                document.getElementById('enrollNombre').innerHTML = arg.apellido + ', ' + arg.nombre;
                document.getElementById('enrollLegajo').innerHTML = arg.legajo;
                document.getElementById('enrollMano').src = 'img/enroll/dedo' + arg.dedo + '.png';
            }
            break;

        case 'pagEnrollRF':
            document.getElementById('enrollRFMSG').innerHTML = arg.msg || ' Pase su credencial';
            if (typeof arg.msg === 'undefined') {
                document.getElementById('enrollRFNombre').innerHTML = arg.apellido + ', ' + arg.nombre;
                document.getElementById('enrollRFLegajo').innerHTML = arg.legajo;
            }
            break;

        case 'pagEnrollMSGOnly':
            document.getElementById('enrollMSG').innerHTML = arg.msg;
            detectFinger = false;
            clearTimeout(timeOut);
            clearTimeout(FDtimeOut);
            FDtimeOut = setTimeout(function () {
                //console.log("Prendido de nuevo!!!!!!")
                detectFinger = true;
            }, 1000);
            break;

        case 'pagMensaje':
            let timeout = arg.timeout || 4000;
            let goback = {pag: 'pagPrincipal'};

            if (arg.goBack == true)
                goback = lastPagArg;

            document.getElementById('mensajeImg').src = 'img/mensaje/' + arg.img + '.png';
            document.getElementById('mensajeGrande').innerHTML = '<div class="' + arg.msgGrande.tipo + '">' +
                arg.msgGrande.txt + '</div>';
            document.getElementById('mensajeChico').innerHTML = '<div>' + arg.msgChico + '</div>';
            clearTimeout(timeOut);
            timeOut = setTimeout(function () {
                cambiarPagina(0, goback);
            }, timeout);
            break;

        case 'pagIdentificado':
            document.getElementById('identFoto').src = arg.img + '?date=' + new Date().getTime();
            document.getElementById('identNombre').innerHTML = '<div>' + arg.nombre + '</div>';
            document.getElementById('identLegajo').innerHTML = '<div>' + arg.legajo + '</div>';
            document.getElementById('identHora').innerHTML = arg.hora;
            clearTimeout(timeOut);
            timeOut = setTimeout(function () {
                cambiarPagina(0, {pag: 'pagPrincipal'});
            }, 4000);

            detectFinger = false;
            clearTimeout(FDtimeOut);
            FDtimeOut = setTimeout(function () {
                detectFinger = true;
            }, 4000);

            break;

        case 'pagFingerDetected':

            if (detectFinger || pagP) {
                detectFinger = false;
                clearTimeout(timeOut);
                timeOut = setTimeout(function () {
                    cambiarPagina(0, lastPagArg);
                }, 3000);
            } else {
                cambiar = false;
            }
            break;


        case 'buttonPressed':

 /*
            document.getElementById('identFoto').src = arg.img + '?date=' + new Date().getTime();
            document.getElementById('identNombre').innerHTML = '<div>' + arg.nombre + '</div>';
            document.getElementById('identLegajo').innerHTML = '<div>' + arg.legajo + '</div>';
            document.getElementById('identHora').innerHTML = arg.hora;
            clearTimeout(timeOut);
            timeOut = setTimeout(function () {
                cambiarPagina(0, {pag: 'pagPrincipal'});
            }, 4000);

            detectFinger = false;
            clearTimeout(FDtimeOut);
            FDtimeOut = setTimeout(function () {
                detectFinger = true;
            }, 4000);


            clearTimeout(timeOut);
            document.getElementById('pagImgIMG').src = 'img/' + arg.img + '.png';
            break;
*/
            break;

            
        case 'pagInitialSetup':
            document.getElementById('setupURL').innerHTML = '<div class="' + arg.msgGrande.tipo + '">' +
                arg.msgGrande.txt + '</div>';
            document.getElementById('setupCodigo').innerHTML = '<div>' + arg.msgCodigo + '</div>';
            clearTimeout(timeOut);
            break;
        case 'pagImg':
            clearTimeout(timeOut);
            document.getElementById('pagImgIMG').src = 'img/' + arg.img + '.png';
            break;
    }
    if (cambiar) {
        let elements = document.getElementsByClassName('page');
        for (let i = 0; i < elements.length; i++) {
            elements[i].classList.remove("show");
        }
        document.getElementById(arg.pag).classList.add('show');
    }
}

function pubsubChange(e, arg) {
    
    if (arg.estado){
        let img = document.getElementById('conectionStatus');
        img.src = 'img/status-server-on.png';
        ipcRenderer.send('connectionType', connectionType);
        ipcRenderer.send('connectionStatus', online);
        }
    //else
        //img.src = 'img/status-server-off.png';

}

function updateWifiSignal(e, arg) {

    if(onlineStatus && connectionType === 'wlan'){
        let imgNetwork = document.getElementById('onlineStatus');
        imgNetwork.src = 'img/wifi/wlan-online-' + arg.step + '.png';
    }

}

// Inicializa la WebApp
function startApp() {
    setInterval(clock, 1000);
    checkConection();
    setInterval(checkConection, 20000);

    ipcRenderer.on('pagina', cambiarPagina);
    ipcRenderer.on('pubsubChange', pubsubChange);
    ipcRenderer.on('updateWifiSignal', updateWifiSignal);
}
