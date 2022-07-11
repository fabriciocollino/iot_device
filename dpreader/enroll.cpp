//
// Created by fabricio on 04/12/16.
//

#include <iostream>

#include "enroll.h"
#include "base64.h"

// Formato por defecto
#define DPFJ_FORMAT DPFJ_FMD_ISO_19794_2_2005

enroll::enroll() {
    state = e_state::STARTING;
    pass = 0;
    //start the enrollment
    int result = dpfj_start_enrollment(DPFJ_FORMAT);
    if (DPFJ_SUCCESS != result) {
        // Error;
        return;
    }
}

enroll::~enroll() {
    state = e_state::ENDED;
    //start the enrollment
    //finish the enrollment
    int result = dpfj_finish_enrollment();
    if (DPFJ_SUCCESS != result) {
        //Error al finalizar el enroll
    }
}

int enroll::addImage(unsigned char *fmd, unsigned int fmd_size) {

    int result, ret_val = -1;
    unsigned char *pEnrollmentFmd = NULL;
    unsigned int nEnrollmentFmdSize = 0;
    result = dpfj_add_to_enrollment(DPFJ_FORMAT, fmd, fmd_size, 0);

    switch (result) {
        case DPFJ_E_MORE_DATA:
            // Falta otra imagen
            this->state = e_state::ENROLLING;
            this->pass++;
            ret_val = pass;
            break;


        case DPFJ_SUCCESS:
            // Finalizado el enrollment, creo la data
            this->state = e_state::ENDED;

            result = dpfj_create_enrollment_fmd(NULL, &nEnrollmentFmdSize);

            if (DPFJ_E_MORE_DATA == result) {
                pEnrollmentFmd = new unsigned char[nEnrollmentFmdSize];
                result = dpfj_create_enrollment_fmd(pEnrollmentFmd, &nEnrollmentFmdSize);
            }

            if (DPFJ_SUCCESS == result && NULL != pEnrollmentFmd && 0 != nEnrollmentFmdSize) {
                // Genero la salida en BASE64
                data = base64_encode(pEnrollmentFmd, nEnrollmentFmdSize);
                // libero memoria
                ret_val = 0;
            }
            if (pEnrollmentFmd != NULL)
                delete pEnrollmentFmd;

            break;
        default:
            ret_val = -1;
    }
    return ret_val;
}

string enroll::getData() {

    if (state == e_state::ENDED) {
        return this->data;
    }
    return "";
}