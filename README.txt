Dockhand for Homey lets you monitor and control your Docker containers directly from your Homey dashboard.

FEATURES

• Container dashboard widget — see all your running and stopped containers at a glance. Start, stop, or restart any container with a single tap.

• Server stats widget — monitor your Docker host in real time: CPU usage, RAM usage, total Docker storage, and container health status.

• Flow cards — automate based on container events:
  - A container started
  - A container stopped
  - A container crashed (non-zero exit code)
  - A container became unhealthy
  - A container update is available
  - The server went offline

• Multi-environment support — manage containers across multiple Docker hosts. Each environment is a separate Homey device with its own widget view.

REQUIREMENTS

• Dockhand installed and running on your local network (dockhand.pro)
• Homey Pro (local platform only — not compatible with Homey Cloud)

SETUP

1. Open Homey → Devices → Add device → Dockhand
2. Enter your Dockhand URL (e.g. http://192.168.1.100:3000)
3. Enter your username and password if authentication is enabled in Dockhand
4. Select the environment(s) you want to add

After pairing, add the widgets to your Homey dashboard from the Widgets section.
