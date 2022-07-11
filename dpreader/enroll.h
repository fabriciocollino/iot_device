//
// Created by fabricio on 04/12/16.
//

#ifndef DPREADER_ENROLL_H
#define DPREADER_ENROLL_H

#include <dpfj.h>
#include <dpfj_compression.h>
#include <dpfj_quality.h>
#include <dpfpdd.h>
#include <string>

using namespace std;

enum class e_state {
    STARTING, ENROLLING, ENDED
};


class enroll {
private:
    unsigned int pass;
    e_state state;
    string data;

public:

    enroll();

    int addImage(unsigned char *fmd, unsigned int fmd_size);

    string getData();

    void setStatus(e_state e) { state = e; }

    e_state getStatus() { return state; }

    unsigned int getPass() { return pass; }

    ~enroll();
};


#endif //DPREADER_ENROLL_H
