//
// Created by fabricio on 03/12/16.
//

#ifndef DPREADER_READER_H
#define DPREADER_READER_H

class reader;

#include "main.h"
#include <dpfpdd.h>
#include <string>

using namespace std;


enum class r_state {
    CAPTURING, STOPED, ERROR
};

class reader {
private:
    DPFPDD_DEV hReader; //handle of the selected reader
    DPFPDD_CAPTURE_CALLBACK cb;
    string nombre;
    volatile int status;
    DPFPDD_DEV_CAPS caps;
    r_state state;
    int dpi;

    pthread_t statusTh;

    bool showStatus;

public:
    void *context;

    reader(void *ctx);

    ~reader();


    int start_capture();

    void stop_catpure();

    void setCallBack(DPFPDD_CAPTURE_CALLBACK f) { cb = f; }

    void setContext(void *ctx) { context = ctx; }

    bool isInit() { return hReader != NULL; }

    void setStatus(int status);

    const string &getNombre() const;

    int getStatus() const;

    bool isCapturing();

    static void *statusThread(void *context);

    int reset();

    void showSensorStatus() {
        showStatus = true;
    };

};


#endif //DPREADER_READER_H
