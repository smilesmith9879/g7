#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time
import json
import threading
import cv2
import numpy as np
from flask import Flask, render_template, Response, jsonify, request
from flask_socketio import SocketIO, emit
import eventlet
from LOBOROBOT import LOBOROBOT

# Initialize eventlet for better performance with WebSocket
eventlet.monkey_patch()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'smartcar2024'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Initialize robot
try:
    robot = LOBOROBOT()
    print("Robot initialized successfully")
except Exception as e:
    print(f"Error initializing robot: {e}")
    robot = None

# Camera settings
camera = None
camera_enabled = False
frame_width = 320
frame_height = 240
fps = 15
jpeg_quality = 70

# Initial servo angles
horizontal_angle = 80  # PWM9, initial angle 80°, range ±45°
vertical_angle = 40    # PWM10, initial angle 40°, range ±45°

# Movement settings
max_speed = 30  # Maximum speed as per requirements
turning_speed_factor = 0.7  # Reduce speed to 70% when turning

# SLAM simulation variables (for development without actual SLAM hardware)
slam_enabled = False
slam_position = {"lat": 0, "lng": 0}
slam_heading = 0
slam_obstacles = []
slam_thread = None
slam_running = False

# Function to initialize camera
def init_camera():
    global camera, camera_enabled
    try:
        camera = cv2.VideoCapture(0)
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, frame_width)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, frame_height)
        camera.set(cv2.CAP_PROP_FPS, fps)
        if camera.isOpened():
            camera_enabled = True
            print("Camera initialized successfully")
        else:
            print("Failed to open camera")
    except Exception as e:
        print(f"Error initializing camera: {e}")

# Function to generate video frames
def generate_frames():
    global camera, camera_enabled
    
    if not camera_enabled:
        init_camera()
    
    while camera_enabled:
        success, frame = camera.read()
        if not success:
            break
        else:
            # Process frame (could add SLAM processing here)
            ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        
        # Control frame rate
        time.sleep(1/fps)

# Set servo angles for camera gimbal
def set_gimbal_angles(h_angle, v_angle):
    global horizontal_angle, vertical_angle, robot
    
    # Ensure angles are within range (80±45° for horizontal, 40±45° for vertical)
    h_angle = max(35, min(125, h_angle))  # 80±45°
    v_angle = max(0, min(85, v_angle))    # 40±45°
    
    if robot:
        try:
            # Set horizontal angle (PWM9)
            robot.set_servo_angle(9, h_angle)
            # Set vertical angle (PWM10)
            robot.set_servo_angle(10, v_angle)
            
            # Update current angles
            horizontal_angle = h_angle
            vertical_angle = v_angle
            
            return True
        except Exception as e:
            print(f"Error setting gimbal angles: {e}")
    
    return False

# Reset gimbal to initial position
def reset_gimbal():
    return set_gimbal_angles(80, 40)  # Initial angles

# Simulated SLAM function (for development without actual SLAM hardware)
def simulate_slam():
    global slam_running, slam_position, slam_heading, slam_obstacles
    
    # Initial position
    position = {"lat": 0, "lng": 0}
    heading = 0
    obstacles = []
    
    # Generate some random obstacles
    for i in range(5):
        obstacles.append({
            "position": {
                "lat": np.random.uniform(-0.0005, 0.0005),
                "lng": np.random.uniform(-0.0005, 0.0005)
            },
            "radius": np.random.uniform(0.2, 1.0)
        })
    
    slam_obstacles = obstacles
    
    while slam_running:
        # Update position based on current car movement
        if carDirection == 'forward':
            position["lat"] += 0.000001 * np.cos(np.radians(heading))
            position["lng"] += 0.000001 * np.sin(np.radians(heading))
        elif carDirection == 'backward':
            position["lat"] -= 0.000001 * np.cos(np.radians(heading))
            position["lng"] -= 0.000001 * np.sin(np.radians(heading))
        elif carDirection == 'left':
            position["lng"] -= 0.000001
        elif carDirection == 'right':
            position["lng"] += 0.000001
        elif carDirection == 'turnLeft':
            heading = (heading - 2) % 360
        elif carDirection == 'turnRight':
            heading = (heading + 2) % 360
        
        # Update global variables
        slam_position = position.copy()
        slam_heading = heading
        
        # Emit SLAM data to clients
        socketio.emit('slam_data', {
            'position': slam_position,
            'heading': slam_heading,
            'obstacles': slam_obstacles
        })
        
        # Sleep to control update rate
        time.sleep(0.1)

# Start SLAM simulation
def start_slam_simulation():
    global slam_thread, slam_running
    
    if slam_thread is None or not slam_thread.is_alive():
        slam_running = True
        slam_thread = threading.Thread(target=simulate_slam)
        slam_thread.daemon = True
        slam_thread.start()
        print("SLAM simulation started")

# Stop SLAM simulation
def stop_slam_simulation():
    global slam_running
    slam_running = False
    print("SLAM simulation stopped")

# Flask routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'robot_status': 'connected' if robot else 'disconnected',
        'camera_status': 'connected' if camera_enabled else 'disconnected',
        'horizontal_angle': horizontal_angle,
        'vertical_angle': vertical_angle,
        'slam_status': 'enabled' if slam_enabled else 'disabled'
    })

@app.route('/api/slam', methods=['POST'])
def toggle_slam():
    global slam_enabled
    
    data = request.get_json()
    enabled = data.get('enabled', False)
    
    if enabled and not slam_enabled:
        slam_enabled = True
        start_slam_simulation()
    elif not enabled and slam_enabled:
        slam_enabled = False
        stop_slam_simulation()
    
    return jsonify({
        'slam_status': 'enabled' if slam_enabled else 'disabled'
    })

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status', {'robot_status': 'connected' if robot else 'disconnected',
                    'camera_status': 'connected' if camera_enabled else 'disconnected',
                    'slam_status': 'enabled' if slam_enabled else 'disabled',
                    'horizontal_angle': horizontal_angle,
                    'vertical_angle': vertical_angle})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

# Global variable to track current car direction
carDirection = 'stop'

@socketio.on('car_control')
def handle_car_control(data):
    global robot, carDirection
    
    if not robot:
        emit('error', {'message': 'Robot not initialized'})
        return
    
    direction = data.get('direction', 'stop')
    speed = min(int(data.get('speed', 20)), max_speed)  # Limit speed to max_speed
    duration = float(data.get('duration', 0.1))  # Default duration
    
    # Update global direction variable for SLAM simulation
    carDirection = direction
    
    try:
        if direction == 'forward':
            robot.t_up(speed, duration)
        elif direction == 'backward':
            robot.t_down(speed, duration)
        elif direction == 'left':
            robot.moveLeft(speed, duration)
        elif direction == 'right':
            robot.moveRight(speed, duration)
        elif direction == 'turnLeft':
            robot.turnLeft(int(speed * turning_speed_factor), duration)
        elif direction == 'turnRight':
            robot.turnRight(int(speed * turning_speed_factor), duration)
        elif direction == 'forwardLeft':
            robot.forward_Left(speed, duration)
        elif direction == 'forwardRight':
            robot.forward_Right(speed, duration)
        elif direction == 'backwardLeft':
            robot.backward_Left(speed, duration)
        elif direction == 'backwardRight':
            robot.backward_Right(speed, duration)
        elif direction == 'stop':
            robot.t_stop(duration)
        
        emit('car_status', {'direction': direction, 'speed': speed})
    except Exception as e:
        print(f"Error controlling car: {e}")
        emit('error', {'message': f'Error controlling car: {str(e)}'})

@socketio.on('gimbal_control')
def handle_gimbal_control(data):
    global horizontal_angle, vertical_angle
    
    action = data.get('action', '')
    
    if action == 'reset':
        success = reset_gimbal()
    else:
        h_offset = int(data.get('horizontal', 0))
        v_offset = int(data.get('vertical', 0))
        
        new_h_angle = horizontal_angle + h_offset
        new_v_angle = vertical_angle + v_offset
        
        success = set_gimbal_angles(new_h_angle, new_v_angle)
    
    emit('gimbal_status', {
        'horizontal_angle': horizontal_angle,
        'vertical_angle': vertical_angle,
        'success': success
    })

# Initialize camera on startup
init_camera()
# Initialize gimbal position
if robot:
    reset_gimbal()
# Start SLAM simulation if enabled
if slam_enabled:
    start_slam_simulation()

if __name__ == '__main__':
    # Start the Flask-SocketIO app
    socketio.run(app, host='0.0.0.0', port=5000, debug=True) 