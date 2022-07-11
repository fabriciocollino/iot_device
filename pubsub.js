const fs = require('fs');


// // Comunicación entre servidor y equipo
module.exports = function (subDom, cliID, equID) {
    var self = this;
    this.conectado = false;


    // Array de observers para cada tipo de mensaje.
    let observers = {
        'ACK_LOG': [],
        'CMD_SYNC': [],
        'CMD_ENROLL_START': [],
        'CMD_ENROLL_CANCEL': [],
        'CMD_RFID_READ_CANCEL': [],
        'CMD_PONG': [],
        'CMD_CONFIG': [],
        'CMD_PING': [],
        'CMD_RFID_READ_START': [],
        'CMD_REBOOT': [],
        'CMD_RESTART_APP': [],
        'CMD_FORCE_PING': [],
        'CMD_CLEAR_NETWORK_INFO': [],
        'CMD_PURGE_DATABASE': [],
        'CMD_RESET_READER': [],
        'CMD_LOCK_UPDATES': [],
        'CMD_UNLOCK_UPDATES': [],
        'CMD_RESET_WIRELESS_NETWORK': [],
        'CMD_FIRST_START': [],
        'CMD_FIRST_START_CONFIG': [],
        'CMD_BLINK': [],
        'CMD_MAINTENANCE_ENABLE': [],
        'CMD_MAINTENANCE_DISABLE': [],
        'CMD_BLOCK': [],
        'CMD_UNBLOCK': [],
        'CMD_DEBUG_INFO': [],
        'CMD_WIFI_STATS': []
    };const fs = require('fs');


// // Comunicación entre servidor y equipo
    module.exports = function (subDom, cliID, equID) {
        var self = this;
        this.conectado = false;


        // Array de observers para cada tipo de mensaje.
        let observers = {
            'ACK_LOG': [],
            'CMD_SYNC': [],
            'CMD_ENROLL_START': [],
            'CMD_ENROLL_CANCEL': [],
            'CMD_RFID_READ_CANCEL': [],
            'CMD_PONG': [],
            'CMD_CONFIG': [],
            'CMD_PING': [],
            'CMD_RFID_READ_START': [],
            'CMD_REBOOT': [],
            'CMD_RESTART_APP': [],
            'CMD_FORCE_PING': [],
            'CMD_CLEAR_NETWORK_INFO': [],
            'CMD_PURGE_DATABASE': [],
            'CMD_RESET_READER': [],
            'CMD_LOCK_UPDATES': [],
            'CMD_UNLOCK_UPDATES': [],
            'CMD_RESET_WIRELESS_NETWORK': [],
            'CMD_FIRST_START': [],
            'CMD_FIRST_START_CONFIG': [],
            'CMD_BLINK': [],
            'CMD_MAINTENANCE_ENABLE': [],
            'CMD_MAINTENANCE_DISABLE': [],
            'CMD_BLOCK': [],
            'CMD_UNBLOCK': [],
            'CMD_DEBUG_INFO': [],
            'CMD_WIFI_STATS': []
        };

        this.connect = ()=> {


            if (process.env.PUBSUB_JSON) {
                var json_cert = new Buffer(process.env.PUBSUB_JSON, 'base64')
                fs.writeFileSync(__dirname + '/client.json', json_cert.toString());
            }

            const {PubSub} = require('@google-cloud/pubsub');

            const grpc = require('grpc');

            const pubsub = new PubSub({
                projectId: 'enpunto-1286',
                keyFilename: __dirname + '/client.json'
            });


            self.topicSync      = pubsub.topic('projects/enpunto-1286/topics/sync').publisher();
            self.topicBrowser   = pubsub.topic('projects/enpunto-1286/topics/clients-' + subDom).publisher();

            /*
            pubsub.topic('projects/enpunto-1286/topics/clients-' + subDom).getSubscriptions((err, subscriptions) => {

                if (!err){

                }
                console.log(subscriptions);
            });*/


            const subscription_v1 = pubsub.topic('projects/enpunto-1286/topics/clients-' + subDom).subscription(
                'projects/enpunto-1286/subscriptions/clients-' + subDom + '-D-' + equID,
                {autoAck: true}
            );
            subscription_v1.on('message', (msg) => {
                // Called every time a message is received.    // message.id = ID of the message.    // message.ackId = ID used to acknowledge the message receival.    // message.data = Contents of the message.    // message.attributes = Attributes of the message.    // message.publishTime = Timestamp when Pub/Sub received the message.
                console.log("Sub1s exitoso");

                self.conectado = true;

                console.log(msg)


                if ( msg.attributes.uuid === equID) {
                    console.log("entra a uuid");
                    emit(msg.attributes.cmd, msg.attributes, msg.data);
                }

                msg.ack();

            });

            subscription_v1.on('error', (err) => {
                // Called every time a message is received.    // message.id = ID of the message.    // message.ackId = ID used to acknowledge the message receival.    // message.data = Contents of the message.    // message.attributes = Attributes of the message.    // message.publishTime = Timestamp when Pub/Sub received the message.
                console.log('Error en pubsub');
                self.conectado = false;

            });


        };



        this.disconnect = ()=> {
            self.conectado = false;
        };

        this.reconnect = ()=> {
            self.conectado = false;
            self.connect();
        };


        function send(dest, cmd, datos, att, cb) {


            att['uuid'] = String(equID);
            att['cmd'] = cmd;
            att['cli_id'] = String(cliID);
            att['ver'] = '1.0';

            console.log('Enviando a cliente: ' + att['cli_id'] + ": " + cmd);
            console.log('Datos por enviar: ' + JSON.stringify(datos));

            datos = Buffer.from(JSON.stringify(datos));

            const customAttributes = {
                raw: 'true',
            };

            dest.publish(
                Buffer.from(JSON.stringify({data: datos, attributes: att})),
                customAttributes,
                function (err, messageId) {

                    if (err) {
                        console.log('error pub:' + err);
                        self.conectado = false;
                        self.connect();
                    }
                    else{
                        console.log('Todo perfecto + err:' + err);
                    }

                    if (typeof (cb) == "function"){
                        cb(err);
                    }
                }
            );



        }

        this.sendBrowser = (cmd, datos, att, cb) => {
            if (self.conectado)
                send(self.topicBrowser, cmd, datos, att, cb);
            else if (typeof(cb) == "function")
                cb('desconectado');
        };

        this.sendSync = (cmd, datos, att, cb)=> {
            if (self.conectado || cmd == 'CMD_PING'  )
                send(self.topicSync, cmd, datos, att, cb);
            else if (typeof(cb) == "function")
                cb('desconectado');
        };

        this.subscribe = (msg, handler)=> {
            if (typeof handler != 'function')
                return 1;
            if (typeof observers[msg] === 'undefined')
                return 2;


            var index = observers[msg].indexOf(handler);
            if (index > -1)
                return 3;

            // Puedo subscribir
            observers[msg].push(handler); //TODO: Podria subscribirme dos veces?
            return 0;
        };

        this.unsubscribe = (handler)=> {
            if (typeof handler !== 'function')
                return 1;


            // Busco en que mensaje esta
            let ret = 2;
            for (let msg in observers) {
                // Puedo subscribir
                var index = observers[msg].indexOf(handler);
                if (index > -1) {
                    observers.splice(index, 1);
                    ret = 0;
                }
            }
            return ret;
        };

        function emit(msg, att, data) {
            if (typeof observers[msg] == 'undefined')
                return 1;

            observers[msg].forEach((obje)=> {
                obje(att, data);
            });
        }



    };

    this.connect = ()=> {


        if (process.env.PUBSUB_JSON) {
            var json_cert = new Buffer(process.env.PUBSUB_JSON, 'base64')
            fs.writeFileSync(__dirname + '/client.json', json_cert.toString());
        }

        const {PubSub} = require('@google-cloud/pubsub');

        const grpc = require('grpc');

        const pubsub = new PubSub({
            projectId: 'enpunto-1286',
            keyFilename: __dirname + '/client.json'
        });


        self.topicSync      = pubsub.topic('projects/enpunto-1286/topics/sync').publisher();
        self.topicBrowser   = pubsub.topic('projects/enpunto-1286/topics/clients-' + subDom).publisher();

        /*
        pubsub.topic('projects/enpunto-1286/topics/clients-' + subDom).getSubscriptions((err, subscriptions) => {

            if (!err){

            }
            console.log(subscriptions);
        });*/


        const subscription_v1 = pubsub.topic('projects/enpunto-1286/topics/clients-' + subDom).subscription(
            'projects/enpunto-1286/subscriptions/clients-' + subDom + '-D-' + equID,
            {autoAck: true}
        );
        subscription_v1.on('message', (msg) => {
            // Called every time a message is received.    // message.id = ID of the message.    // message.ackId = ID used to acknowledge the message receival.    // message.data = Contents of the message.    // message.attributes = Attributes of the message.    // message.publishTime = Timestamp when Pub/Sub received the message.
            console.log("Sub1s exitoso");

            self.conectado = true;

            console.log(msg)


            if ( msg.attributes.uuid === equID) {
                console.log("entra a uuid");
                emit(msg.attributes.cmd, msg.attributes, msg.data);
            }

            msg.ack();

        });

        subscription_v1.on('error', (err) => {
            // Called every time a message is received.    // message.id = ID of the message.    // message.ackId = ID used to acknowledge the message receival.    // message.data = Contents of the message.    // message.attributes = Attributes of the message.    // message.publishTime = Timestamp when Pub/Sub received the message.
            console.log('Error en pubsub');
            self.conectado = false;

        });


    };



    this.disconnect = ()=> {
        self.conectado = false;
    };

    this.reconnect = ()=> {
        self.conectado = false;
        self.connect();
    };


    function send(dest, cmd, datos, att, cb) {


        att['uuid'] = String(equID);
        att['cmd'] = cmd;
        att['cli_id'] = String(cliID);
        att['ver'] = '1.0';

        console.log('Enviando a cliente: ' + att['cli_id'] + ": " + cmd);
        console.log('Datos por enviar: ' + JSON.stringify(datos));

        datos = Buffer.from(JSON.stringify(datos));

        const customAttributes = {
            raw: 'true',
        };

        dest.publish(
            Buffer.from(JSON.stringify({data: datos, attributes: att})),
            customAttributes,
            function (err, messageId) {

                if (err) {
                    console.log('error pub:' + err);
                    self.conectado = false;
                    self.connect();
                }
                else{
                    console.log('Todo perfecto + err:' + err);
                }

                if (typeof (cb) == "function"){
                    cb(err);
                }
            }
        );



    }

    this.sendBrowser = (cmd, datos, att, cb) => {
        if (self.conectado)
            send(self.topicBrowser, cmd, datos, att, cb);
        else if (typeof(cb) == "function")
            cb('desconectado');
    };

    this.sendSync = (cmd, datos, att, cb)=> {
        if (self.conectado || cmd == 'CMD_PING'  )
            send(self.topicSync, cmd, datos, att, cb);
        else if (typeof(cb) == "function")
            cb('desconectado');
    };

    this.subscribe = (msg, handler)=> {
        if (typeof handler != 'function')
            return 1;
        if (typeof observers[msg] === 'undefined')
            return 2;


        var index = observers[msg].indexOf(handler);
        if (index > -1)
            return 3;

        // Puedo subscribir
        observers[msg].push(handler); //TODO: Podria subscribirme dos veces?
        return 0;
    };

    this.unsubscribe = (handler)=> {
        if (typeof handler !== 'function')
            return 1;


        // Busco en que mensaje esta
        let ret = 2;
        for (let msg in observers) {
            // Puedo subscribir
            var index = observers[msg].indexOf(handler);
            if (index > -1) {
                observers.splice(index, 1);
                ret = 0;
            }
        }
        return ret;
    };

    function emit(msg, att, data) {
        if (typeof observers[msg] == 'undefined')
            return 1;

        observers[msg].forEach((obje)=> {
            obje(att, data);
        });
    }



};