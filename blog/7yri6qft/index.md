---
url: /blog/7yri6qft/index.md
---
```bash
└─$ sudo apt-get update
Get:1 http://mirror.eliv.digital/kali kali-last-snapshot InRelease [34.0 kB]
Err:1 http://mirror.eliv.digital/kali kali-last-snapshot InRelease
  The following signatures couldn't be verified because the public key is not available: NO_PUBKEY
```

kali的key过期,用如下命令下载最新key

```bash
wget -q -O - https://archive.kali.org/archive-key.asc | sudo apt-key add
```
