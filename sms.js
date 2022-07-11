var PosixMQ = require('posix-mq');

// // Comunicación entre equipos
module.exports = function (canal, onSMS) {
    var mqtx = new PosixMQ();
    var mqrx = new PosixMQ();
    mqtx.open({
        name: '/' + canal + 'tx',
        create: true,
        mode: '0777',
        maxmsgs: 10,
        msgsize: 104876
    });

    mqrx.open({
        name: '/' + canal + 'rxa',
        create: true,
        mode: '0777',
        maxmsgs: 10,
        msgsize: 104876
    });


    mqrx.on('messages', function () {
        var n;
        var readbuf = new Buffer(mqrx.msgsize);
        var txt;
        while ((n = this.shift(readbuf)) !== false) {
            txt = readbuf.toString('utf8', 0, n).split('|');
            onSMS(txt);
        }
    });

    this.push = function (txtdat) {
        this.mqtx.push(new Buffer(txtdat));
    }
};

