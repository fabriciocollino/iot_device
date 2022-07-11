//
// Created by fabricio on 15/12/16.
//

#include <vector>
#include <cstring>
#include <dpfj.h>
#include "identify.h"
#include "base64.h"


using namespace std;

identify::identify() {

}

void identify::clean() {
    IDs.clear();
    dedos.clear();
    sizes.clear();

    // Libero la memoria del vector de punteros
    for (std::vector<unsigned char *>::iterator it = huellas.begin(); it != huellas.end(); ++it) {
        delete (*it);
    }
    huellas.clear();
}

void identify::add(unsigned int id, unsigned int dedo, string huella) {
    vector<BYTE> huella_data = base64_decode(huella);
    unsigned char *tmp = new unsigned char[huella_data.size()];

    memcpy(tmp, huella_data.data(), huella_data.size());
    huellas.push_back(tmp);

    sizes.push_back((unsigned int) huella_data.size());
    IDs.push_back(id);
    dedos.push_back(dedo);
}

#define CANTIDAD_RESULTADOS 3

per_info identify::search(unsigned char *data, unsigned int data_size) {
    per_info persona;
    persona.id = 0;
    persona.dedo = 0;
    persona.real = false;


    unsigned int falsepositive_rate = DPFJ_PROBABILITY_ONE / 10000;
    unsigned int nCandidateCnt = CANTIDAD_RESULTADOS;
    DPFJ_CANDIDATE vCandidates[CANTIDAD_RESULTADOS];

    int result = dpfj_identify(DPFJ_FMD_ISO_19794_2_2005,
                               data,
                               data_size,
                               0,
                               DPFJ_FMD_ISO_19794_2_2005,
                               (unsigned int) huellas.size(),
                               huellas.data(),
                               sizes.data(),
                               falsepositive_rate,
                               &nCandidateCnt,
                               vCandidates);
    if (result == DPFJ_SUCCESS) {
        if(nCandidateCnt>0) {
            persona.id = IDs[vCandidates[0].fmd_idx];
            persona.dedo = dedos[vCandidates[0].fmd_idx];
            persona.real = true;
        }
    }
    return persona;
}