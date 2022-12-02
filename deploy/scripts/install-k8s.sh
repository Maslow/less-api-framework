#!/usr/bin/env sh
# Intro: start laf with sealos in linux
# Usage: sh ./bare_run.sh

# TIP: use `sh -x scripts/bare_run.sh` to debug


#make a judgement whether sealos exist
if [ -x "$(command -v sealos)" ]; then
# Install Sealos
if [ -x "$(command -v apt)" ]; then
  # if apt installed, use `apt` to install
  echo "deb [trusted=yes] https://apt.fury.io/labring/ /" | tee /etc/apt/sources.list.d/labring.list
  apt update
  apt install sealos=4.1.3 -y
  
  # fix /etc/hosts overwrite bug in ubuntu while restarting
  sed -i \"/update_etc_hosts/c \\ - ['update_etc_hosts', 'once-per-instance']\" /etc/cloud/cloud.cfg && touch /var/lib/cloud/instance/sem/config_update_etc_hosts
else
  echo "apt not installed"
fi
if [ -x "$(command -v yum)" ]; then
  # if yum installed, use `yum` to install
  cat > /etc/yum.repos.d/labring.repo << EOF
[fury]
name=labring Yum Repo
baseurl=https://yum.fury.io/labring/
enabled=1
gpgcheck=0
EOF
  yum update
  yum install sealos -y
else
  echo "yum not installed"
fi
#arch,suse,.etc distro condition
#amd64,arm
if  [ "$(dpkg --print-architecture)"=="amd64"];then
  wget https://github.com/labring/sealos/releases/download/v4.1.3/sealos_4.1.3_linux_amd64.tar.gz \
   && tar zxvf sealos_4.1.3_linux_amd64.tar.gz sealos && chmod +x sealos && mv sealos /usr/bin
else
  wget https://github.com/labring/sealos/releases/download/v4.1.3/sealos_4.1.3_linux_arm64.tar.gz \
   && tar zxvf sealos_4.1.3_linux_amd64.tar.gz sealos && chmod +x sealos && mv sealos /usr/bin
fi

else
  #clean the previous installed sealos images
  sealos reset
fi

# install k8s cluster
sealos run labring/kubernetes:v1.24.0 labring/flannel:v0.19.0 --single

# taint master node
NODENAME=$(kubectl get nodes -ojsonpath='{.items[0].metadata.name}')
kubectl taint node $NODENAME node-role.kubernetes.io/master-
kubectl taint node $NODENAME node-role.kubernetes.io/control-plane-

# install required components
sealos run labring/helm:v3.8.2
sealos run labring/openebs:v1.9.0
sealos run labring/cert-manager:v1.8.0

# Optional installations
#arch=$(arch | sed s/aarch64/arm64/ | sed s/x86_64/amd64/)
#vm_root_exec echo "download buildah in https://github.com/labring/cluster-image/releases/download/depend/buildah.linux.${arch}"
#vm_root_exec wget -qO "buildah" "https://github.com/labring/cluster-image/releases/download/depend/buildah.linux.${arch}"
#vm_root_exec chmod a+x buildah
#vm_root_exec mv buildah /usr/bin
