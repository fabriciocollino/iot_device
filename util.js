/**
 * Created by fabricio on 3/2/17.
 */

let fs = require('fs');
let exec = require('child_process').exec;

let debug = false;

function removeNetworkConfig(){
    try {
        fs.writeFileSync('/data/forceAP', '');
    } catch (e) {
        if(debug)console.log('No se pudo crear forceAP');
    }

    let coffeeProcess = exec('node /ap/src/app.js --clear=true');
    coffeeProcess.stdout.on('data', function(data) {
        console.log(data);
    });
}


function removeDatabase(){
    try {
        fs.accessSync('/data/tk822.db', fs.F_OK);
        fs.unlinkSync('/data/tk822.db');
        if(debug)console.log('base de datos eliminada correctamente');
    } catch (e) {
        if(debug)console.log('No se pudo eliminar la base de datos');
    }
}

function removeImg(){
    try {
        exec('rm -rf /data/img', function (error, stdout, stderr) {
        });
        if(debug)console.log('imagenes eliminadas correctamente');
    } catch (e) {
        if(debug)console.log('No se pudo eliminar la carpeta de imagenes');
    }
}


function rebootDevice(){
    exec('curl -X POST --header "Content-Type:application/json" \
    "$RESIN_SUPERVISOR_ADDRESS/v1/reboot?apikey=$RESIN_SUPERVISOR_API_KEY"', function (error, stdout, stderr) {
    });
}

function restartAPP(){
    exec('pkill xinit', function (error, stdout, stderr) {
    });
}

function reconnectWifi(){
    exec('ifconfig wlan0 down', function (error, stdout, stderr) {
    });
    setTimeout(()=>{
        exec('ifconfig wlan0 up', function (error, stdout, stderr) {
        });
    },60000);
    setTimeout(()=>{
        let coffeeProcess = exec('node /ap/src/app.js --clear=false');
        coffeeProcess.stdout.on('data', function(data) {
            console.log(data);
        });
    },120000);
}

function lockUpdates(){
    try {
        fs.closeSync(fs.openSync('/data/resin-updates.lock', 'w'));
        fs.closeSync(fs.openSync('/tmp/resin/resin-updates.lock', 'w')); //soporte para OS 2.x
    } catch (e) {
        // It isn't accessible
    }
}

function unlockUpdates(){
    try {
        fs.accessSync('/data/resin-updates.lock', fs.F_OK);
        fs.unlinkSync('/data/resin-updates.lock');
    } catch (e) {
        // It isn't accessible
    }
    try {
        fs.accessSync('/tmp/resin/resin-updates.lock', fs.F_OK); //soporte para OS 2.x
        fs.unlinkSync('/tmp/resin/resin-updates.lock'); //soporte para OS 2.x
    } catch (e) {
        // It isn't accessible
    }
}

function checkLockUpdatesFiles(){
    try {
        console.log("checking if updates are locked");
        fs.accessSync('/tmp/resin/resin-updates.lock', fs.F_OK);
        console.log("re-locking");
        lockUpdates();
        console.log("locked");
    } catch (e) {
        // It isn't accessible
    }
}


module.exports = {
    removeNetworkConfig:removeNetworkConfig,
    removeDatabase:removeDatabase,
    removeImg:removeImg,
    rebootDevice:rebootDevice,
    restartAPP:restartAPP,
    reconnectWifi:reconnectWifi,
    lockUpdates:lockUpdates,
    unlockUpdates:unlockUpdates,
    checkLockUpdatesFiles:checkLockUpdatesFiles,
    debug:debug
};