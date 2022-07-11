const electron = require('electron');
//require('electron-reload')(__dirname);
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

module.exports = function () {
    var self = this;
    this.mainWindow = {};
    function createWindow() {
        // Create the browser window.
        self.mainWindow = new BrowserWindow(
            {
                width: 320,
                height: 240,
                kiosk: true,
                toolbar: false
            }
        );
        self.mainWindow.setMenu(null);
        // and load the index.html of the app.
        self.mainWindow.loadURL(`file://${__dirname}/screens/index.html`);
        //self.mainWindow.openDevTools();
        // Emitted when the window is closed.
        self.mainWindow.on('closed', function () {
            self.mainWindow = null
        });
    }

    app.on('ready', createWindow);

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', function () {
        if (self.mainWindow === null) {
            createWindow()
        }
    });
};