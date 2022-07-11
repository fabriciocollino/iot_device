/**
 * Created by fabricio on 13/08/16.
 */
var fs = require('fs');

module.exports = {
    updatedb: function (db) {
        db.serialize(function () {

            // Verifico si la BD esta en blanco (no tiene tabla personas)
            db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='personas'", [], function (err, rows) {
                if (err) {
                    console.log(err);
                } else if (rows.length == 0) {
                    fs.readFile('/app/database/database.sql','utf8', function (err, data) {
                        console.log("Creando BD");

                        db.exec(data, function (err) {
                            if (err)
                                console.log(err);
                            else
                                console.log("BD Creada");
                        });
                    });
                }
            });
        });
    }
};