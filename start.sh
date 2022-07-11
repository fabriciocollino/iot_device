#!/bin/bash
export DBUS_SYSTEM_BUS_ADDRESS=unix:path=/host/run/dbus/system_bus_socket
SHOW_UPDATEMSG='YES'

mkdir -p /app/ramdisk
mount -t tmpfs -o size=32m tmpfs /app/ramdisk

#for resin 2.0 we copy the lock over from data to the tmp folder after boot
if [ -e /data/resin-updates.lock ]; then
  cp /data/resin-updates.lock /tmp/resin/resin-updates.lock
  echo "locking updates..."
fi

# Inicalizo el FrameBuffer
udevd --daemon
udevadm trigger
if [ ! -c /dev/fb1 ]; then
      echo "Cargando FB"
      modprobe spi_bcm2835
      modprobe fbtft_device name=adafruit22a verbose=0 rotate=90
      sleep 1
      mknod /dev/fb1 c $(cat /sys/class/graphics/fb1/dev | tr ':' ' ')
fi



_term() {
    if [ ${SHOW_UPDATEMSG} = 'YES' ]; then
          pkill xinit
          cat /app/screens/img/actualizando.fb > /dev/fb1
    fi
    echo "Caught SIGTERM signal!"
    exit 0
}

trap _term SIGTERM


#Corrijo la TimeZone
export TIMEZONE=${TIMEZONE:=America/Argentina/Cordoba}
echo "${TIMEZONE}" > /etc/timezone
dpkg-reconfigure tzdata

# Hago carpeta de imagenes si no existe
mkdir -p /data/img


# Corro la aplicación
rm /tmp/.X0-lock || true
FRAMEBUFFER=/dev/fb1 startx /bin/bash /app/start2.sh
sleep 5
SHOW_UPDATEMSG='NO'
reboot