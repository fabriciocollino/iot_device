/**
 * Created by fabricio on 13/08/16.
 */
"use strict";
const spawn = require('child_process').spawn;
const util = require('./util.js');

// ToDO: Hacer singleton

// // Uso de lector de huella
let fp = new function () {
    let estado = 'STOPED';
    let enroll_data = {};
    let WDTimeout = 0;
    let WDResetCount = 0;
    let sensorStatus = 1;
    let debugInfo = false;
    let dp;

    let identifycb = () => {
    };

    let enrollcb = () => {
    };

    let fingerDetectedcb = () => {
    };

    let reloadFingerprints = () => {
    };

    function initDP() {

        if(process.env.DP_READER_THRESHOLD !== undefined){

            if(process.env.DP_READER_THRESHOLD === "1000") {
                console.log("DP READER THRESHOLD 1/1.000");
                dp = spawn('dpreader_1_1000');
            }
            else if(process.env.DP_READER_THRESHOLD === "100") {
                console.log("DP READER THRESHOLD 1/100");
                dp = spawn('dpreader_1_100');
            }
            else {
                console.log("DP READER THRESHOLD 1/10.000");
                dp = spawn('dpreader_1_10000');
            }
        }
        else {
            console.log("DP READER THRESHOLD 1/10.000");
            dp = spawn('dpreader_1_10000');
        }

        // Callback cuando el programa devuelve datos
        dp.stdout.on('data', (stream) => {
            let lineas = stream.toString().split(/(\r?\n)/g);

            // Recorro cada linea
            lineas.forEach((data) => {
                data = data.trim();

                if (data.length === 0)
                    return;

                if (data.indexOf('READER_STATUS') === -1 && data.indexOf('ERROR 003') === -1)
                    console.log(`stdout: ${data}`);

                if(debugInfo)
                    console.log(`stdout: ${data}`);

                // Comandos simples
                if ("STARTED" === data) {
                    estado = "STARTED";
                    return;
                }

                if ("IDENTIFYING" === data) {
                    estado = 'IDENT';
                    console.log("identifying");
                    return;
                }

                if ("ENROLLING" === data) {
                    estado = 'ENROLL';
                    console.log("enrolling");
                    return;
                }

                // Comandos complejos
                let cmds = data.split(' ');

                if ("MATCH" === cmds[0]) {
                    if (cmds[1] === '1') {
                        console.log("MATCHED.");
                        identifycb({fp: cmds[2], dedo: cmds[3]});
                    } else {
                        console.log("MATCH FAILED.");
                        identifycb({err: -1});
                    }
                }

                if ("ENROLL_PASS" === cmds[0]) {
                    enrollcb({muestra: cmds[1]});
                }

                if ("ENROLL_DATA" === cmds[0]) {
                    enroll_data["hue_datos"] = cmds[1];
                    enrollcb({data: enroll_data});
                }

                if ("ENROLL_ERROR" === cmds[0]) {
                    if("FPRINT_EXISTS" === cmds[1])
                        enrollcb({err: 2, muestra: 0, persona: cmds[3]});
                    else
                        enrollcb({err: 1, muestra: 0});
                }

                if ("FINGER_DETECTED" === cmds[0]) {
                    fingerDetectedcb();
                }

                if ("QUALITY:" === cmds[0]) {
                    fingerDetectedcb(cmds[1]);
                }

                if ("ERROR:" === cmds[0]) {
                    dp.stdin.write(`RESET\n`);
                }

                if ("READER_STATUS" === cmds[0]) {
                    if (parseInt(cmds[1]) > 1)
                        dp.stdin.write(`RESET\n`);
                    else
                        sensorStatus = 1;
                }
                if ("FP_RESET_ERROR" === cmds[0]) {
                    //exec('pkill xinit', function (error, stdout, stderr) {
                    //});

                    console.log(`Parando DPReader`);
                    dp.stdin.write(`QUIT\n`);
                }
            });
        });

        dp.on('close', (code) => {
            //TODO: ver que hacer
            console.log(`Se paró el proceso DPREADER ${code}`);
            clearInterval(WDTimeout);
            if (estado !== 'STOP')
                setTimeout(initDP, 500);
        });

        reloadFingerprints();
        setTimeout(function () {
            WDTimeout = setInterval(function () {
                if (sensorStatus === 0) {
                    // Mato dpreader
                    console.log("WatchDog DPReader, reiniciando dpreader " + WDResetCount);
                    WDResetCount++;
                    if(WDResetCount>=8){
                        console.log("Too many dpreader resets. Rebooting...")
                        //util.restartAPP();
                    }
                    dp.stdin.pause();
                    dp.kill('SIGKILL');
                    clearInterval(WDTimeout);
                } else {
                    sensorStatus = 0;
                    dp.stdin.write(`GET_STATUS\n`);
                }
            }, 5000);
        }, 30000);
    }


    initDP();
    // Metodos

    this.setidentifycb = (cb) => {
        identifycb = cb;
    };

    this.setenrollcb = (cb) => {
        enrollcb = cb;
    };

    this.setfingerDetectedcb = (cb) => {
        fingerDetectedcb = cb;
    };

    this.reloadFingerprints = (cb) => {
        reloadFingerprints = cb;
    };
    // TODO: Ver como poder procesar las respuestas de ADD_FP
    this.printsAdd = (id, data, dedo) => {
        dp.stdin.write(`ADD_FP ${id} ${dedo} ${data}\n`);
    };

    this.reset = () => {
        console.log(`Reset DPReader`);
        dp.stdin.write(`QUIT\n`);
    };

    this.printsClear = () => {
        dp.stdin.write(`CLEAN_FP\n`);
    };

    this.identify = () => {
        // Verifico si estoy haciendo enroll
        console.log('Arrancando identify');
        dp.stdin.write('IDENTIFY\n');
    };

    this.enroll = (data, cb) => {
        // Verifico que no esté identificando
        enroll_data = data;
        console.log('Arrancando identify');
        dp.stdin.write('ENROLL\n');
    };

    this.isEnrolling = () => {
        return (estado === "ENROLL");
    };

    this.stop = () => {
        estado = 'STOP';
        dp.stdin.write(`QUIT\n`);
    };

    this.start = () => {
        estado = 'STOPED';

        dp.kill('SIGKILL');
        setTimeout(initDP, 500);
    };

    this.showDebugInfo = () => {
        console.log('estado:',estado);

        if(debugInfo) {
            console.log("parando debug de fp");
            debugInfo = false;
        }
        else {
            console.log("iniciando debug de fp");
            debugInfo = true;
        }
    };

    this.estado = estado;

};

module.exports = fp;