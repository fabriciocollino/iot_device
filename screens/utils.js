/**
 * Created by martin on 14/08/16.
 */

function pad(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length - size);
}

document.addEventListener("keydown", function (e) {
    if (e.which === 117) {
        require('remote').getCurrentWindow().toggleDevTools();
    } else if (e.which === 116) {
        location.reload();
    }
});
