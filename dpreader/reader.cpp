//
// Created by fabricio on 03/12/16.
//

#include <iostream>
#include <vector>

#include <chrono>
#include <thread>

#include "reader.h"

reader::reader(void *ctx) {
    unsigned int cantDev = 1;
    unsigned int newcantDev;
    vector<DPFPDD_DEV_INFO> pReaderInfo(cantDev);
    int result;
    state = r_state::STOPED;
    hReader = NULL;
    context = ctx;
    showStatus = false;


    // Inicializo la Lib
    result = dpfpdd_init();
    if (DPFPDD_SUCCESS != result) {
        std::cout << "ERROR 001: Abriendo el dispositivo" << endl;
        return;
    }

    // Busco dispositivos
    while (!pReaderInfo.empty()) {

        // lleno los distintos posibles dispositivos
        for (int i = 0; i < cantDev; i++) {
            pReaderInfo[i].size = sizeof(DPFPDD_DEV_INFO);
        }
        newcantDev = cantDev;
        result = dpfpdd_query_devices(&newcantDev, &pReaderInfo[0]);

        // Mas memoria para el dispositivo
        if (DPFPDD_E_MORE_DATA == result) {
            pReaderInfo.resize(newcantDev);
            cantDev = newcantDev;
            continue;
        }

        // Error no conocido
        if (DPFPDD_E_FAILURE == result) {
            hReader = NULL;
            state = r_state::ERROR;
            std::cout << "ERROR 002: No hay dispositivo " << endl;
            return;
        }

        // Success!
        cantDev = newcantDev;
        std::this_thread::sleep_for(std::chrono::milliseconds(400));
        result = dpfpdd_open(pReaderInfo[0].name, &hReader);

        // Si hubo error
        if (DPFPDD_SUCCESS != result) {
            hReader = NULL;
            state = r_state::ERROR;
            std::cout << "ERROR 003: No se pudo abrir el dispositivo " << endl;

        } else {

            int rc;
            nombre = pReaderInfo[0].name;
            //extraigo las capabilities del device
            unsigned int nCapsSize = sizeof(DPFPDD_DEV_CAPS);
            DPFPDD_DEV_CAPS* pCaps = (DPFPDD_DEV_CAPS*)malloc(nCapsSize);
            pCaps->size = nCapsSize;
            dpfpdd_get_device_capabilities(hReader, pCaps);
            //de las capabilities, uso la resolucion solamente
            dpi = pCaps->resolutions[0];
            pReaderInfo.clear();
            rc = pthread_create(&statusTh, NULL, statusThread, (void *) this);
            if (rc) {
                cout << "ERROR 004: No se pudo iniciar el hilo" << endl;
            }
        }
    }
}

int reader::start_capture() {
    //prepare parameters and result
    if (state == r_state::STOPED) {
        DPFPDD_CAPTURE_PARAM cp = {0};
        cp.size = sizeof(cp);
        cp.image_fmt = DPFPDD_IMG_FMT_ISOIEC19794;
        cp.image_proc = DPFPDD_IMG_PROC_NONE;
        cp.image_res = dpi;

        //start asyncronous capture
        int result = dpfpdd_capture_async(hReader, &cp, context, cb);
        if (result == DPFPDD_SUCCESS)
            state = r_state::CAPTURING;
        return result;
    }
    return DPFPDD_SUCCESS;
}

void reader::stop_catpure() {
    if (state == r_state::CAPTURING) {
        //stop asyncronous capture
        int result = dpfpdd_cancel(hReader);
        if (result == DPFPDD_SUCCESS)
            state = r_state::STOPED;
    }
}

reader::~reader() {
    //close reader
    this->stop_catpure();

    if (NULL != hReader) {
        dpfpdd_close(hReader);
        hReader = NULL;
    }
    //relese capture library
    dpfpdd_exit();
}

const string &reader::getNombre() const {
    return nombre;
}

void reader::setStatus(int status) {
    reader::status = status;
}

int reader::getStatus() const {
    return status;
}

bool reader::isCapturing() {
    return (state == r_state::CAPTURING);
}

void *reader::statusThread(void *context) {
    int result;
    int old_finger;
    DPFPDD_STATUS old_status = -1;
    reader *r = (reader *) context;
    t_objs *obj = (t_objs *) r->context;

    DPFPDD_DEV_STATUS *dpStatus = new DPFPDD_DEV_STATUS;

    std::this_thread::sleep_for(std::chrono::milliseconds(10000));

    result = dpfpdd_get_device_status(r->hReader, dpStatus);


    if (result == DPFPDD_E_MORE_DATA) {
        int size = dpStatus->size;
        delete dpStatus;
        dpStatus = new DPFPDD_DEV_STATUS[size];
    }

    while (true) {
        result = dpfpdd_get_device_status(r->hReader, dpStatus);
        if (result == DPFPDD_SUCCESS) {
            if (dpStatus->finger_detected != old_finger) {
                if (dpStatus->finger_detected == 1 &&
                    (obj->i->get_size() > 0) || obj->state == app_states::ENROLLING)
                    cout << "FINGER_DETECTED " << endl;
            }
            old_finger = dpStatus->finger_detected;

            // Mostrar
            if (dpStatus->status != old_status || r->showStatus) {
                r->showStatus = false;
                cout << "READER_STATUS " << dpStatus->status << endl;
                old_status = dpStatus->status;
            }
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(223));
    }

    pthread_exit(NULL);
}


int reader::reset() {

    dpfpdd_cancel(hReader);
    std::this_thread::sleep_for(std::chrono::milliseconds(100));

    return dpfpdd_reset(hReader);
}