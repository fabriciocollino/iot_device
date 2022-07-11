//
// Created by fabricio on 06/02/17.
//



#ifndef DPREADER_MAIN_H
#define DPREADER_MAIN_H

class t_objs;

#include "reader.h"
#include "enroll.h"
#include "identify.h"

enum class app_states {
    ENROLLING, IDENTIFYING, IDLE
};


class t_objs {
public:
    reader *r;
    enroll *e;
    identify *i;
    app_states state;
} ;


#endif //DPREADER_MAIN_H
