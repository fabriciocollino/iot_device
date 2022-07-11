cmake_minimum_required(VERSION 3.6)
project(dpreader)

set(CMAKE_CXX_STANDARD 11)
set(THREADS_PREFER_PTHREAD_FLAG ON)
find_package(Threads REQUIRED)

include_directories(/opt/Crossmatch/urusdk-linux/Include/)


set(SOURCE_FILES main.cpp reader.cpp enroll.cpp identify.cpp  base64.cpp)

add_executable(dpreader ${SOURCE_FILES})
target_link_libraries(dpreader Threads::Threads m c dl dpfpdd dpfj)

install(TARGETS dpreader DESTINATION /usr/bin)
