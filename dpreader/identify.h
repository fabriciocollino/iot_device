//
// Created by martin on 15/12/16.
//

#ifndef DPREADER_IDENTIFY_H
#define DPREADER_IDENTIFY_H

#include <vector>
#include <string>

using namespace std;

typedef struct {
    unsigned int id;
    unsigned int dedo;
    bool real;
} per_info;

class identify {
private:
    vector<unsigned char *> huellas;
    vector<unsigned int> sizes;
    vector<unsigned int> IDs;
    vector<unsigned int> dedos;

public:
    identify();

    void clean();

    unsigned int get_size() { return (unsigned int) huellas.size(); }

    void add(unsigned int id, unsigned int dedo, string huella);

    per_info search(unsigned char *data, unsigned int data_size);
};


#endif //DPREADER_IDENTIFY_H
