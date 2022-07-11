FROM balenalib/raspberrypi3-node:9.11.2

ENV INITSYSTEM=on
# solo para probar en local
COPY qemu-arm /qemu-wrapper

# Install apt deps
#RUN sed -i '/jessie-updates/{s/^/#/}' /etc/apt/sources.list

RUN apt-get update && \
    apt-get install -yq --no-install-recommends python2.7 \
    python-dev \
    python-dbus \
    python-pip \
  xorg=1:7.7+7+b1 \
  xinit=1.3.4-1 \
  libgtk-3-0 \
  libudev-dev \
  libxss1 \
  libgconf-2-4 \
  libasound2 \
  sqlite3 \
  openssh-client \
  openssh-sftp-server \
  openssh-server \
  ntpdate \
  hostapd \
  dnsmasq \
  iproute2 \
  iw \
  libdbus-1-dev=1.8.22-0+deb8u1 \
  libexpat1-dev=2.1.0-6+deb8u4 \
  rfkill \
  gifsicle \
  libusb-1.0-0-dev \
  libnss3 \
  libxv-dev \
  libtool \

  ## build tools
build-essential \
automake \
cmake \
git

RUN echo "#!/bin/sh\n\nexec /usr/bin/X -s 0 dpms -nocursor -nolisten tcp "$@"" > /etc/X11/xinit/xserverrc && \
    mkdir -p /etc/X11/xorg.conf && \
    echo 'Section "ServerLayout"\n\
              Identifier "ServerLayout0"\n\
              Option "StandbyTime" "0"\n\
              Option "SuspendTime" "0"\n\
              Option "OffTime"     "0"\n\
              Option "BlankTime"   "0"\n\
          EndSection' \
    >> /etc/X11/xorg.conf/10-monitor.conf && \
#no se porque la ultima linea...  http://forum.freetronics.com/viewtopic.php?t=5943

# Clave SSH para
RUN mkdir -p /root/.ssh && \
    echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDgLHSOa0OuZVkOWzUkKmYlrL6IOXNV4v8WhP/tMCEPNXIgzaQUYuUMeS8cKr7ntuOVEdUXIq63KqfKZ30g5qFQUN6ACTsHqcnLIlpnqmlt7LLj014H/Z1Mt4nU72bjc1UqOywSoPv/GDx/K/yS68om2n4M8kJ8bIgMSPf/RhMCiV2u8RERrYNLXf3kYWrR3bVyBpFjN46hJkzvFAWPQFkKWgSKgUzDefDon23imrXlACqo/f13CB4Wq9QMDAG9IxHAdFK3fzejcoPR1YJZoFg+oIHfbdrm8jIdz+/4imrabA9meakV80/Ss9j4EHWcJKhOdbbputHjxtdKsg0qKAf7 martin@Tachikoma" > /root/.ssh/authorized_keys && \
    chmod 700 /root/.ssh && \
    chmod 600 /root/.ssh/authorized_keys

##################################################################
# INSTALO Modulo AP
##################################################################

ENV DEVICE_TYPE=raspberrypi3

# Move package to filesystem
RUN mkdir -p /ap/
WORKDIR /ap
COPY resin-wifi-connect/ /ap/


# NPM i app
RUN JOBS=MAX npm install --unsafe-perm --production \
	&& npm cache clean --force && rm -rf /tmp/* && \
	./node_modules/.bin/bower --allow-root install && \
    ./node_modules/.bin/bower --allow-root cache clean && \
    ./node_modules/.bin/coffee -c ./src

##################################################################
# Instalo Aplicacion enPunto
##################################################################

RUN mkdir -p /app/
WORKDIR /app
# Set npm
ENV npm_config_target 2.0.5
ENV npm_config_arch arm
ENV npm_config_target_arch arm
ENV npm_config_disturl https://atom.io/download/electron
ENV npm_config_runtime electron
ENV npm_config_build_from_source true

# Move package to filesystem
COPY ./package.json /app/

# NPM i app && NPM rebuild node native modules after electron is installed.
RUN JOBS=MAX npm install --unsafe-perm --production \
	&& npm cache clean --force && rm -rf /tmp/* && ./node_modules/.bin/electron-rebuild

##################################################################
# Instalo dpreader
##################################################################

COPY dpreader/ /temp
WORKDIR /temp

## production dpreader
RUN tar xf digitalPersona.tar.gz && \
    cp -r lib /usr/ && \
    cp -r include /usr/ && \
    cp dpreader_1_10000 /usr/bin/dpreader_1_10000 && \
    cp dpreader_1_1000 /usr/bin/dpreader_1_1000 && \
    cp dpreader_1_100 /usr/bin/dpreader_1_100 && \
    chmod +x /usr/bin/dpreader_1_10000  && \
    chmod +x /usr/bin/dpreader_1_1000  && \
    chmod +x /usr/bin/dpreader_1_100

# Move app to filesystem
RUN mkdir -p /root/.fonts
COPY ./fonts/* /root/.fonts/
COPY . /app

RUN chmod 750 /app/start.sh && \
    cd /app && rm -rf dpreader

# Start app
CMD ["/app/start.sh"]