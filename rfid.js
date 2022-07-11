/**
 * Created by fabricio on 13/08/16.
 */
var SerialPort = require('serialport');

// // Uso de lector de huella
module.exports = function (identcb) {
    var self = this;

    var estado = 'STOPED';
    var identifycb = identcb;
    var enrollcb = null;
    var person_data = null;

    function startRFID() {
        var puerto = process.env.SERIAL_PORT || '/dev/ttyAMA0';
        console.log(puerto);
        var port = new SerialPort(puerto, {baudRate: 9600}, function (err) {
            if (err) {
                setTimeout(start, 5000);
                return console.log('Error: ', err.message);
            }
            estado = 'IDENT'; //por defecto en ident

            port.on('data', function (data) {
                var tag = '000000000000' + data.toString('hex').toUpperCase();

                //////// PARA LECTORES RFID_RF125_PS /////// Brinda 2 TAGS seguidos, se descarta el que empieza con 3030
                var tag_check_iftrash = tag.substr(-10,4); 
                if(tag_check_iftrash == '3030'){ 
                    data = null;
                    tag = null;
                    return;
                }
                 ///// ///// ///// ///// ///// ///// ///// ///// ///// ///// ///// ///// ///// ///// ///// /////


                if (process.env.WIEGAND_ENABLED) {
                    tag = tag.substr(-12, 10) + "0000";  // Corto los dos ultimos y agrego el 0
                }

                if (estado == 'STOPED')
                    return;

                tag = tag.substr(-10); // Corto para a  ancho fijo de 10.
                console.log('RFID read ' + tag);
                switch (estado) {
                    case 'IDENT':
                        setTimeout(function () {
                            identifycb({tag: tag});
                        }, 0);
                        break;
                    case 'ENROLL':
                        setTimeout(function () {
                            person_data['tag'] = tag;
                            enrollcb(person_data);
                            estado = 'IDENT';
                        }, 0);
                }
            });
        });
    }

    startRFID();


    this.printsAdd = function (id, data) {
    };

    this.printsClear = function () {
    };

    this.identify = function () {

        if (estado == 'STOPED')
            return;

        console.log('RFID ident start');
        estado = 'IDENT';
    };

    this.enroll = function (data, cb) {

        if (estado == 'STOPED')
            return;

        console.log('RFID enroll start');
        estado = 'ENROLL';
        enrollcb = cb;
        person_data = data;
    };

    this.stop = () => {
        estado = 'STOPED';
    };

    this.start = () => {
        estado = 'IDENT';
    };
};