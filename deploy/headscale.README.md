# Optional Headscale (self-hosted Tailscale coordination) on the Aegis VM
#
# Docs: https://headscale.net/
#
# Quick path (Docker):
#
#   mkdir -p /opt/headscale/{config,lib,run}
#   # copy example config from upstream headscale repo → /opt/headscale/config/config.yaml
#   # set server_url to http://192.168.1.235:8081 (or HTTPS later)
#
# Example compose (adjust image tag):
#
# services:
#   headscale:
#     image: headscale/headscale:0.23
#     restart: unless-stopped
#     command: serve
#     volumes:
#       - ./headscale/config:/etc/headscale
#       - ./headscale/lib:/var/lib/headscale
#     ports:
#       - "8081:8080"
#
# Then on each friend PC:
#   1. Install Tailscale client
#   2. tailscale up --login-server=http://192.168.1.235:8081
#   3. Approve node in headscale (`headscale nodes list` / `approve`)
#   4. In Aegis Settings → Desktop, set Server URL to the Headscale IP of the VM
#      (e.g. http://100.x.x.x:3001) instead of the LAN IP when off-LAN.
#
# Until Headscale is up, stay on LAN `http://192.168.1.235:3001`.
