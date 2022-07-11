/**
 * Created by diego on 2/28/17.
 */




let rpio = require('rpio');
let s = require('./sound.js');
let sound = new s();

let pin_to_check = null;
let pinPressedCount = 0;
let checkButtonInt = null;
let checkButtonStillPressedInt = null;
let flagReboot = 0;
let flagRestartAPP = 0;
let flagResetWifi = 0;
let flagResetAll = 0;

let buttonPressedClbck;
let resetWifiClbck;
let resetTodoClbck;
let resetWifiAchievedClbck;
let resetTodoAchievedClbck;
let restartAPPAchievedClbck;
let rebootAchievedClbck;
let pressedCountClbck;

let debug = false;
let useSound = true;

/*

 documentacion super precaria, pero documentacion al fin.

 funcionamiento:  despues de llamar al metodo start(), pasandole como parametro el pin a chequear, checkButton chequea
 cada 250ms si se aprieta el boton, si esta apretado, a partir de ese momento se chequea cada 1 segundo si sigue
 apretado y se toman las acciones pertinentes.

 el modulo expone los siguientes callbacks:

 resetWifi: se llama cuando se debe resetear el wifi
 resetTodo: se llama cuando se debe resetear todo_
 resetWifiAchieved: se llama cuando se llega a la cuenta suficiente para resetear el wifi.  (para funcionamiento a futuro, por ej, cambiar pantalla)
 resetTodoAchieved: se llama cuando se llega a la cuenta suficiente para resetear todo_.  (para funcionamiento a futuro, por ej, cambiar pantalla)
 pressedCount: se llama cada un segundo si el boton sigue presionado y pasa como primer argumento la cantidad de segundos que el boton ha estado presionado.



 ej de uso:

 let button = require('./button.js');

 button.start(36);  //se selecciona el pin

 button.resetTodo(function () {
 console.log('reset todo_ desde main');
 });
 button.resetWifi(function () {
 console.log('reset wifi desde main');
 });

 button.pressedCount(function (count) {
 //console.log('Boton de reset sigue presionado #: ',count);
 });

 */

function checkButton(){
    let state = rpio.read(pin_to_check);
    if(state===0){//button pressed
        if(debug)console.log('Boton de reset presionado');
        pinPressedCount = 1;
        clearInterval(checkButtonInt);
        checkButtonStillPressedInt = setInterval(checkButtonStillPressed,1000);
        if(useSound)sound.playOk(200);
        buttonPressedClbck();
    }else{
        if(pinPressedCount>0)
            pinPressedCount=0;
    }
}


function checkButtonStillPressed(){
    let state = rpio.read(pin_to_check);


    if(state===0){//button is still pressed
        pinPressedCount++;

        if(debug)console.log('Boton de reset sigue presionado #: ',pinPressedCount);

        switch (pinPressedCount){
            case 2:
                if (debug) console.log('Aca se deberia reiniciar la app');
                flagRestartAPP      = 1;
                flagReboot          = 0;
                flagResetWifi        = 0;
                flagResetAll        = 0;
                //if(useSound)sound.playOk(100);
                restartAPPAchievedClbck();
                break;
            case 4:
                if (debug) console.log('Aca se deberia reiniciar el equipo');
                flagRestartAPP      = 0;
                flagReboot          = 1;
                flagResetWifi        = 0;
                flagResetAll        = 0;
                rebootAchievedClbck();
                break;
            case 10:
                if(debug)console.log('Aca se deberia resetear el wifi');
                flagRestartAPP      = 0;
                flagReboot          = 0;
                flagResetWifi        = 1;
                flagResetAll        = 0;
                
                if(useSound){
                      //giving sound feedback
                    setTimeout(function () {
                        sound.playOk(300);
                    }, 0);
                    setTimeout(function () {
                        sound.playOk(300);
                    }, 600);

                }
                resetWifiAchievedClbck();
                break;
                
                case 20:
                if(debug)console.log('Aca se deberia resetear todo');
                flagRestartAPP      = 0;
                flagReboot          = 0;
                flagResetWifi        = 0;
                flagResetAll        = 1;

                if(useSound){
                      //giving sound feedback - CHECK IF REALOCATE THIS CODE
                    setTimeout(function () {
                        sound.playOk(300);
                    }, 0);
                    setTimeout(function () {
                        sound.playOk(300);
                    }, 600);
                    setTimeout(function () {
                        sound.playOk(300);
                    }, 1200);

                }

                resetTodoAchievedClbck();
                break;
                
        }

        pressedCountClbck(pinPressedCount);

    }
    else{//button is not pressed anymore

        if(flagResetAll){
            flagResetAll= 0;
            if(debug)console.log('Reseteando todo');
            resetTodoClbck();
        }else
        if(flagResetWifi){
            flagResetWifi = 0;
            if(debug)console.log('Reseteando wifi');
            resetWifiClbck();

        }else if(flagReboot){
            flagReboot = 0;
            if(debug)console.log('Reiniciando');
            rebootClbck();

        }else if(flagRestartAPP){
            flagRestartAPP = 0;
            if(debug)console.log('Reiniciando APP');
            restartAPPClbck();
        }
     
        pinPressedCount = 0;
        clearInterval(checkButtonStillPressedInt);
        checkButtonInt = setInterval(checkButton,250);
    }
  
}




function start(pin){
    if(debug)console.log('iniciando el boton checker');

    pin_to_check = pin;
    rpio.open(pin_to_check, rpio.INPUT, rpio.PULL_UP);
    checkButtonInt = setInterval(checkButton,250);
}

function buttonPressed(cb){
    buttonPressedClbck=cb;
}

function resetWifi(cb){
    resetWifiClbck=cb;
}

function resetTodo(cb){
    resetTodoClbck=cb;
}

function restartAPP(cb){
    restartAPPClbck=cb;
}

function reboot(cb){
    rebootClbck=cb;
}

function resetWifiAchieved(cb){
    resetWifiAchievedClbck=cb;
}

function resetTodoAchieved(cb){
    resetTodoAchievedClbck=cb;
}

function restartAPPAchieved(cb){
    restartAPPAchievedClbck=cb;
}

function rebootAchieved(cb){
    rebootAchievedClbck=cb;
}

function pressedCount(cb){
    pressedCountClbck=cb;
}


module.exports = {
    start:start,
    buttonPressed:buttonPressed,
    resetWifi:resetWifi,
    resetTodo:resetTodo,
    reboot:reboot,
    restartAPP:restartAPP,
    resetWifiAchieved:resetWifiAchieved,
    resetTodoAchieved:resetTodoAchieved,
    restartAPPAchieved:restartAPPAchieved,
    rebootAchieved:rebootAchieved,
    pressedCount:pressedCount,
    debug:debug,
    sound:useSound
};