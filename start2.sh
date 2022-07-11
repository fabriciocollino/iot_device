#!/usr/bin/env bash

INTERNET_CHECK_TIMEOUT=5
MAX_WIFI_CONNECTION_ATTEMPTS=2

/usr/bin/gifview -a /app/screens/img/00-intro.gif &


# param1 timeout, sino esta seteado, utiliza INTERNET_CHECK_TIMEOUT
function checkInternet() {
  for ((i=0; i<${1:-INTERNET_CHECK_TIMEOUT}; i++))
  do
    if curl --output /dev/null --silent --head --fail https://www.google.com; then
      return 1
    fi;
    sleep 1
  done
  return 0
}


GOTNET=0

checkInternet
if [ $? -eq 1 ]
then
  echo "Internet Available"
  GOTNET=1
else
  echo "Internet Unavailable"
fi
if [ "$GOTNET" -eq 1 ]; then
   rm /data/forceAP 2> /dev/null
else
   if [ -f /data/forceAP ]; then
        echo "Starting AP"
        node /ap/src/app.js --clear=true  |
        while read i
        do
            echo $i
            if [[ $i == *"Credentials not found"* ]]; then
                estado=1;
                /usr/bin/gifview -a /app/screens/img/10-setup-hola.gif &
            fi
            if [[ $i == *"Connected"* ]]; then
                if [[ $estado == 1 ]]; then
                    /usr/bin/gifview -a /app/screens/img/10-setup-genial.gif &
                    rm /data/forceAP 2> /dev/null
                fi
            fi
        done
   fi
fi


_term2() {
  echo "Caught SIGTERM signal (start2.sh)!"
}

trap _term2 SIGTERM


echo Arrancando Electron desde start2.sh
if [ "$DEVELOPMENT" == "SI" ]; then
    echo "iniciando en modo inspect"
    #/app/node_modules/electron/dist/electron /app/main.js --inspect --enable-logging --debug=4567 &
    /app/node_modules/electron/dist/electron /app/main.js --inspect --enable-logging --debug=4567
    #no inicio el watchdog por ahora
else
    /app/node_modules/electron/dist/electron /app/main.js &
fi


sleep 80
echo Arrancando Watchdog
while [  -f /app/ramdisk/watchdog ]
do
  rm -rf /app/ramdisk/watchdog
  sleep 15
done
echo "start2.sh: se salio por watchdog"