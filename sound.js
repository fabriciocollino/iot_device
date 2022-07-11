/**
 * Created by fabricio on 13/08/16.
 */
var rpio = require('rpio');

// // Uso de lector de huella
module.exports = function () {
    var pin = 33;
    var range = 1024;
    var timeout = null;

    rpio.open(pin, rpio.PWM);
    rpio.pwmSetData(pin, 0);
    rpio.pwmSetClockDivider(16);
    rpio.pwmSetRange(pin, range);


    this.playError = function (t) {
        rpio.pwmSetClockDivider(64);
        rpio.pwmSetData(pin, range / 2);
        wait(t);
    };

    this.playOk = function (t) {
        rpio.pwmSetClockDivider(16);
        rpio.pwmSetData(pin, range / 2);
        wait(t);
    };

    function wait(t) {
        clearTimeout(timeout);
        timeout = setTimeout(function () {
            rpio.pwmSetData(pin, 0);
        }, t);
    }
};