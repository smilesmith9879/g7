/**
 * Main Application Controller
 * Initializes and connects all components of the web interface
 */
document.addEventListener('DOMContentLoaded', () => {
    // Socket.IO connection
    const socket = io();
    
    // DOM Elements
    const robotStatus = document.getElementById('robot-status');
    const cameraStatus = document.getElementById('camera-status');
    const speedValue = document.getElementById('speed-value');
    const directionValue = document.getElementById('direction-value');
    const cameraAngleValue = document.getElementById('camera-angle-value');
    const resetCameraBtn = document.getElementById('reset-camera-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const videoFeed = document.getElementById('video-feed');
    
    // Initialize Map
    const mapElement = document.getElementById('map');
    const mapController = new MapController(mapElement);
    
    // Car control variables
    let carDirection = 'stop';
    let carSpeed = 20;
    const maxSpeed = 30; // Maximum speed as per requirements
    const turningSpeedFactor = 0.7; // Reduce speed to 70% when turning
    
    // Camera gimbal variables
    let horizontalAngle = 80; // Initial angle
    let verticalAngle = 40; // Initial angle
    const angleStep = 5; // Degrees to change per joystick update
    
    // Initialize Joysticks
    const carJoystick = new Joystick(document.getElementById('car-joystick'), {
        maxDistance: 40,
        deadZone: 0.2,
        onMove: handleCarJoystickMove,
        onEnd: handleCarJoystickEnd
    });
    
    const cameraJoystick = new Joystick(document.getElementById('camera-joystick'), {
        maxDistance: 40,
        deadZone: 0.2,
        onMove: handleCameraJoystickMove,
        onEnd: handleCameraJoystickEnd
    });
    
    // Socket.IO event handlers
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateStatus('robot', 'disconnected');
        updateStatus('camera', 'disconnected');
    });
    
    socket.on('status', (data) => {
        updateStatus('robot', data.robot_status);
        updateStatus('camera', data.camera_status);
        
        if (data.horizontal_angle) horizontalAngle = data.horizontal_angle;
        if (data.vertical_angle) verticalAngle = data.vertical_angle;
        updateCameraAngleDisplay();
    });
    
    socket.on('car_status', (data) => {
        carDirection = data.direction;
        carSpeed = data.speed;
        updateSpeedDisplay();
        updateDirectionDisplay();
    });
    
    socket.on('gimbal_status', (data) => {
        horizontalAngle = data.horizontal_angle;
        verticalAngle = data.vertical_angle;
        updateCameraAngleDisplay();
    });
    
    socket.on('slam_data', (data) => {
        mapController.processSlamData(data);
    });
    
    socket.on('error', (data) => {
        console.error('Server error:', data.message);
        // Could add a visual error notification here
    });
    
    // Button event handlers
    resetCameraBtn.addEventListener('click', () => {
        socket.emit('gimbal_control', { action: 'reset' });
    });
    
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Fetch initial status
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            updateStatus('robot', data.robot_status);
            updateStatus('camera', data.camera_status);
            horizontalAngle = data.horizontal_angle;
            verticalAngle = data.vertical_angle;
            updateCameraAngleDisplay();
        })
        .catch(error => console.error('Error fetching status:', error));
    
    // Joystick handlers
    function handleCarJoystickMove(position) {
        const { x, y } = position;
        
        // Determine direction based on joystick position
        if (Math.abs(x) < 0.2 && Math.abs(y) < 0.2) {
            // Dead zone - stop
            sendCarControl('stop', 0);
            return;
        }
        
        let direction;
        let speed = Math.min(Math.round(Math.sqrt(x*x + y*y) * maxSpeed), maxSpeed);
        
        // Determine direction based on angle
        const angle = Math.atan2(y, x) * 180 / Math.PI;
        
        if (angle > -22.5 && angle <= 22.5) {
            direction = 'right';
        } else if (angle > 22.5 && angle <= 67.5) {
            direction = 'forwardRight';
        } else if (angle > 67.5 && angle <= 112.5) {
            direction = 'forward';
        } else if (angle > 112.5 && angle <= 157.5) {
            direction = 'forwardLeft';
        } else if ((angle > 157.5 && angle <= 180) || (angle >= -180 && angle <= -157.5)) {
            direction = 'left';
        } else if (angle > -157.5 && angle <= -112.5) {
            direction = 'backwardLeft';
        } else if (angle > -112.5 && angle <= -67.5) {
            direction = 'backward';
        } else if (angle > -67.5 && angle <= -22.5) {
            direction = 'backwardRight';
        }
        
        // Apply turning speed reduction for left/right movements
        if (direction === 'left' || direction === 'right' || 
            direction === 'turnLeft' || direction === 'turnRight') {
            speed = Math.round(speed * turningSpeedFactor);
        }
        
        // Special case for pure rotation
        if (Math.abs(x) > 0.7 && Math.abs(y) < 0.3) {
            direction = x > 0 ? 'turnRight' : 'turnLeft';
            speed = Math.round(Math.abs(x) * maxSpeed * turningSpeedFactor);
        }
        
        sendCarControl(direction, speed);
    }
    
    function handleCarJoystickEnd() {
        sendCarControl('stop', 0);
    }
    
    function handleCameraJoystickMove(position) {
        const { x, y } = position;
        
        if (Math.abs(x) < 0.2 && Math.abs(y) < 0.2) {
            return; // Dead zone - no movement
        }
        
        // Calculate angle changes
        const hChange = Math.round(x * angleStep);
        const vChange = Math.round(-y * angleStep); // Invert Y for intuitive control
        
        sendGimbalControl(hChange, vChange);
    }
    
    function handleCameraJoystickEnd() {
        // Do nothing on end - camera stays at current position
    }
    
    // Helper functions
    function sendCarControl(direction, speed) {
        if (direction !== carDirection || speed !== carSpeed) {
            socket.emit('car_control', {
                direction: direction,
                speed: speed,
                duration: 0.1 // Short duration for responsive control
            });
            
            carDirection = direction;
            carSpeed = speed;
            
            updateSpeedDisplay();
            updateDirectionDisplay();
        }
    }
    
    function sendGimbalControl(horizontalChange, verticalChange) {
        socket.emit('gimbal_control', {
            horizontal: horizontalChange,
            vertical: verticalChange
        });
    }
    
    function updateStatus(type, status) {
        const element = type === 'robot' ? robotStatus : cameraStatus;
        element.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
        element.className = 'status-value ' + status;
    }
    
    function updateSpeedDisplay() {
        speedValue.textContent = carSpeed;
    }
    
    function updateDirectionDisplay() {
        let directionText;
        
        switch (carDirection) {
            case 'forward': directionText = 'Forward'; break;
            case 'backward': directionText = 'Backward'; break;
            case 'left': directionText = 'Left'; break;
            case 'right': directionText = 'Right'; break;
            case 'turnLeft': directionText = 'Turn Left'; break;
            case 'turnRight': directionText = 'Turn Right'; break;
            case 'forwardLeft': directionText = 'Forward Left'; break;
            case 'forwardRight': directionText = 'Forward Right'; break;
            case 'backwardLeft': directionText = 'Backward Left'; break;
            case 'backwardRight': directionText = 'Backward Right'; break;
            default: directionText = 'Stopped';
        }
        
        directionValue.textContent = directionText;
    }
    
    function updateCameraAngleDisplay() {
        cameraAngleValue.textContent = `H:${horizontalAngle}° V:${verticalAngle}°`;
    }
    
    function toggleFullscreen() {
        const container = document.querySelector('.container');
        
        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
            container.classList.add('fullscreen');
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            container.classList.remove('fullscreen');
        }
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (mapController && mapController.map) {
            mapController.map.invalidateSize();
        }
    });
}); 