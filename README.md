# AI Smart Four-Wheel Drive Car

A Raspberry Pi 5 based smart car project with web control interface, real-time video streaming, and SLAM mapping capabilities.

## Project Overview

This project implements a web-controlled four-wheel drive car with the following features:

- Web-based control interface with dual joystick layout
- Real-time video streaming with optimized performance
- Camera gimbal control with servo motors
- Real-time mapping and navigation using simulated SLAM
- Responsive design for mobile and desktop use

## Hardware Requirements

- Raspberry Pi 5
- HUANER USB 160° 4K Camera
- Four-Wheel Drive Chassis
- MG996R Servo Motors for Camera Gimbal
- PCA9685 PWM Controller
- MPU6050 IMU Sensor (optional for enhanced navigation)

## Software Architecture

- **Backend**: Flask + Flask-SocketIO for real-time communication
- **Frontend**: HTML5, CSS3, JavaScript with Leaflet for map visualization
- **Video Streaming**: Optimized MJPEG streaming
- **Control Library**: LOBOROBOT.py for motor and servo control

## Installation

1. Clone this repository to your Raspberry Pi:
   ```
   git clone https://github.com/yourusername/ai-smart-car.git
   cd ai-smart-car
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run the application:
   ```
   python app.py
   ```

4. Access the web interface by navigating to `http://[raspberry-pi-ip]:5000` in your browser.

## Usage

### Web Interface

The web interface provides:

- Real-time video feed from the car's camera
- Dual joystick controls:
  - Left joystick: Controls car movement (forward, backward, left, right)
  - Right joystick: Controls camera gimbal (pan and tilt)
- Real-time map display showing the car's position and detected obstacles
- Status indicators for robot and camera connections
- Fullscreen mode for better mobile experience

### Control Modes

- **Car Movement**: The left joystick provides 8-directional control with auto-centering
- **Camera Gimbal**: The right joystick controls the camera's horizontal (PWM9) and vertical (PWM10) angles
- **Speed Control**: Movement speed is determined by joystick distance from center, with a maximum of 30
- **Turning Speed**: Automatically reduced to 70% when turning for better control

## Technical Details

### Video Optimization

- Resolution: 320x240 pixels
- Frame Rate: 15 FPS
- JPEG Quality: 70%
- These settings provide a good balance between quality and performance

### Servo Control

- Horizontal Servo (PWM9): Initial angle 80°, range ±45° (35°-125°)
- Vertical Servo (PWM10): Initial angle 40°, range ±45° (0°-85°)

### SLAM Implementation

The project includes a simulated SLAM implementation for development purposes. In a production environment, this would be replaced with actual ORB-SLAM3 integration.

## Troubleshooting

- **Robot Not Connected**: Ensure the LOBOROBOT library is properly installed and the hardware is connected
- **Camera Not Working**: Check USB connections and permissions
- **Performance Issues**: Adjust video resolution and quality settings in app.py

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- LOBOROBOT library by Hunan Chuanglebai Intelligent Technology Co., Ltd.
- Leaflet.js for map visualization
- Flask and Flask-SocketIO for the web framework 