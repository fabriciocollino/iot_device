#include <iostream>
#include <dpfpdd.h>
#include <dpfj_quality.h>
#include <thread>

#include <string>

#include "main.h"

using namespace std;

// Callback que corre en el otro hilo
void DPAPICALL CaptureCallback(void *pContext, unsigned int reserved, unsigned int nDataSize, void *pData);

void decodeError(int err) {
    switch (err) {
        case DPFPDD_SUCCESS:
            cout << "DPFPDD_SUCCESS";
            break;
        case DPFPDD_E_FAILURE:
            cout << "DPFPDD_E_FAILURE";
            break;
        case DPFPDD_E_INVALID_DEVICE:
            cout << "DPFPDD_E_INVALID_DEVICE";
            break;
        case DPFPDD_E_DEVICE_BUSY:
            cout << "DPFPDD_E_DEVICE_BUSY";
            break;
        case DPFPDD_E_INVALID_PARAMETER:
            cout << "DPFPDD_E_INVALID_PARAMETER";
            break;
        case DPFPDD_E_DEVICE_FAILURE:
            cout << "DPFPDD_E_DEVICE_FAILURE";
            break;
    }
}

int main() {
    t_objs objs;
    objs.r = new reader((void *) &objs);
    objs.i = new identify();
    objs.state = app_states::IDLE;

    if (objs.r->isInit()) {
        cout << "STARTED" << endl;
    }


    objs.r->setCallBack(CaptureCallback);
    objs.r->setContext((void *) &objs);

    string command = "";
    string data = "";


    int engresult = dpfj_select_engine(NULL,DPFJ_ENGINE_DPFJ7);
    if(DPFPDD_SUCCESS != engresult)
        cout << "ERROR: Could not select DPFR engine 7" << endl;
    else
        cout << "Running DPFR engine 7" << endl;


    while (command != "QUIT") {
        command = "";
        if (!(cin >> command))
            continue;

        if ("ENROLL" == command) {

            objs.e = new enroll(); // Creo un nuevo enroll
            objs.state = app_states::ENROLLING;
            int res = objs.r->start_capture();
            if (res == DPFPDD_SUCCESS) {
                cout << "ENROLLING" << endl;
            } else {
                cout << "ERROR: No inicio Capture";
                decodeError(res);
                cout << endl;
            }
            continue;
        }

        if ("IDENTIFY" == command) {
            int res = DPFPDD_SUCCESS;
            objs.state = app_states::IDENTIFYING;
            if (objs.i->get_size() > 0)
                res = objs.r->start_capture();
            else
                objs.r->stop_catpure();
            if (res == DPFPDD_SUCCESS) {
                cout << "IDENTIFYING" << endl;
            } else {
                cout << "ERROR: No inicio Capture";
                decodeError(res);
                cout << endl;
            }
            continue;
        }

        if ("ENROLL_CANCEL" == command) {
            if (objs.e != NULL) {
                delete objs.e;
                objs.e = NULL;
            }
            objs.state = app_states::IDLE;
            cout << "ENROLLING_CANCELED" << endl;
            continue;
        }

        if (0 == command.compare(0, 6, "ADD_FP")) {
            unsigned int id = 0;
            unsigned int dedo = 0;
            int res = DPFPDD_SUCCESS;
            if (cin >> id >> dedo >> data) {
                objs.i->add(id, dedo, data);
                cout << "FP_ADDED " << id << endl;
                if (objs.i->get_size() > 0)
                    res = res = objs.r->start_capture();
                else
                    objs.r->stop_catpure();
                if (res != DPFPDD_SUCCESS) {
                    cout << "ERROR: No inicio Capture";
                    decodeError(res);
                    cout << endl;
                }
            }

            cin.clear();
            cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
            continue;
        }

        if ("CLEAN_FP" == command) {
            objs.i->clean();
            cout << "FP_CLEANED" << endl;
            continue;
        }

        if ("GET_STATUS" == command) {
            objs.r->showSensorStatus();
            continue;
        }

        if ("RESET" == command) {
            int result;

            int capturing = objs.r->isCapturing();

            objs.r->stop_catpure();
            result = objs.r->reset();

            if (result == DPFPDD_SUCCESS) {
                cout << "FP_RESETED" << endl;
            } else {
                cout << "FP_RESET_ERROR ";
                switch (result) {
                    case DPFPDD_E_FAILURE:
                        cout << "DPFPDD_E_FAILURE" << endl;
                        break;
                    case DPFPDD_E_INVALID_DEVICE:
                        cout << "DPFPDD_E_INVALID_DEVICE" << endl;
                        break;
                    case DPFPDD_E_DEVICE_BUSY:
                        cout << "DPFPDD_E_DEVICE_BUSY" << endl;
                        break;
                    case DPFPDD_E_DEVICE_FAILURE:
                        cout << "DPFPDD_E_DEVICE_FAILURE" << endl;
                        break;
                    default:
                        cout << "UNKNOWN" << endl;
                        break;
                }
            }


            delete objs.r;

            objs.r = new reader((void *) &objs);

            if (capturing) {
                int res = objs.r->start_capture();
                if (res != DPFPDD_SUCCESS) {
                    cout << "ERROR: No inicio Capture";
                    decodeError(res);
                    cout << endl;
                }
            }
            continue;
        }
    }

    if (objs.r != NULL)
        delete objs.r;
    if (objs.e != NULL)
        delete objs.e;
    if (objs.i != NULL)
        delete objs.i;
    return 0;
}

/*
CaptureCallback

este es el callback que ocurre cuando se lee una huella, ya sea por identify o enroll.

*/
void DPAPICALL CaptureCallback(void *pContext, unsigned int reserved, unsigned int nDataSize, void *pData) {

    int result;
    if (NULL == pData) {
        cout << "ERROR: pData == null";
        return;
    }


    //allocate memory for capture data and the image in one chunk
    DPFPDD_CAPTURE_CALLBACK_DATA_0 *pCaptureData = (DPFPDD_CAPTURE_CALLBACK_DATA_0 *) pData;
    DPFPDD_CAPTURE_RESULT *cresult = (DPFPDD_CAPTURE_RESULT *) &pCaptureData->capture_result;
    // En el contexto espero algo del tipo objs.
    t_objs *objs = (t_objs *) pContext;


    // TODO: Verificar errores de calidad y de errores
    if (DPFPDD_SUCCESS != pCaptureData->error) {
        cout << "ERROR: pCaptureData->error == " << pCaptureData->error << endl;
        return;
    }
    if (DPFPDD_QUALITY_CANCELED == cresult->quality) {
        // printf("CaptureCallback() cancelled");
        cout << "ERROR: CaptureCallback() cancelled" << endl;
        return;
    } else {
        //printf("    bad capture, quality feedback: 0x%x.\n", cresult->quality);
        cout << "QUALITY: " << cresult->quality << endl;
    }

    if (cresult->success) {
        // Si capturó bien, obtengo los datos
        unsigned int nFeaturesSize = MAX_FMD_SIZE;
        unsigned char *pFeatures = new unsigned char[nFeaturesSize];
        result = dpfj_create_fmd_from_fid(DPFJ_FID_ISO_19794_4_2005, pCaptureData->image_data,
                                          pCaptureData->image_size,
                                          DPFJ_FMD_ISO_19794_2_2005, pFeatures, &nFeaturesSize);

        //busco la calidad de la huella
        unsigned int nfiq_score;
        int resultquality = dpfj_quality_nfiq_from_fid(DPFJ_FID_ISO_19794_4_2005, pCaptureData->image_data,
                                            pCaptureData->image_size,
                                            0, DPFJ_QUALITY_NFIQ_NIST, &nfiq_score);
        switch(resultquality){
            case DPFJ_SUCCESS:
                cout << "FP_SCORE: " << nfiq_score << endl;
            break;
            case DPFJ_E_QUALITY_TOO_FEW_MINUTIA:
                cout << "ERROR: DPFJ_E_QUALITY_TOO_FEW_MINUTIA" << endl;
            break;
            case DPFJ_E_QUALITY_LIB_NOT_FOUND:
                cout << "ERROR: DPFJ_E_QUALITY_TOO_FEW_MINUTIA" << endl;
            break;
            case DPFJ_E_QUALITY_FAILURE:
                cout << "ERROR: DPFJ_E_QUALITY_TOO_FEW_MINUTIA" << endl;
            break;
        }

        // Estado Enrolling!
        if (objs->state == app_states::ENROLLING) {
            if(nfiq_score <= 3){
                //chequeo que la huella no exista
                per_info per = objs->i->search(pFeatures, nFeaturesSize);
                if(per.real==0){

                    result = objs->e->addImage(pFeatures, nFeaturesSize);
                    if (result > 0) {
                        // Esta haciendo una pasada
                        cout << "ENROLL_PASS " << result << endl;
                    } else if (result == 0) {
                        // Termino el enroll bien
                        cout << "ENROLL_DATA " << objs->e->getData() << endl;

                        // Le doy las gracias al enroll y lo elimino
                        delete objs->e;
                        objs->e = NULL;
                        objs->state = app_states::IDENTIFYING;
                        int res = DPFPDD_SUCCESS;
                        if (objs->i->get_size() > 0)
                            res = objs->r->start_capture();
                        else
                            objs->r->stop_catpure();
                        if (res == DPFPDD_SUCCESS)
                            cout << "IDENTIFYING" << endl;
                        else {
                            cout << "ERROR: No inicio Capture";
                            decodeError(res);
                            cout << endl;
                        }

                    } else {
                        // Error en el enroll
                        cout << "ENROLL_ERROR" << endl;
                    }
                }else{
                    cout << "ENROLL_ERROR FPRINT_EXISTS " << (per.real ? 1 : 0) << " ";
                    cout << per.id << " " << per.dedo << endl;
                }
            }else{
                cout << "ENROLL_DISCARDED SCORE " << nfiq_score << endl;
            }

            delete pFeatures;
        } else if (objs->state == app_states::IDENTIFYING) {
            per_info per = objs->i->search(pFeatures, nFeaturesSize);

            cout << "MATCH " << (per.real ? 1 : 0) << " ";
            cout << per.id << " " << per.dedo << endl;
        }
    }
}