//
// Created by fabricio on 15/12/16.
//

#ifndef DPREADER_BASE64_H
#define DPREADER_BASE64_H

#include <vector>
#include <string>
typedef unsigned char BYTE;

std::string base64_encode(BYTE const* buf, unsigned int bufLen);
std::vector<BYTE> base64_decode(std::string const&);

#endif //DPREADER_BASE64_H
