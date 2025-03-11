/**
 * Map Controller
 * Handles the 2D map display using Leaflet
 */
class MapController {
    constructor(element) {
        this.element = element;
        this.map = null;
        this.robotMarker = null;
        this.path = [];
        this.pathLine = null;
        this.obstacles = [];
        this.initialized = false;
        
        // Default starting position (will be updated with actual data)
        this.position = { lat: 0, lng: 0 };
        this.heading = 0; // degrees
        
        this.init();
    }
    
    init() {
        // Create the map with dark theme
        this.map = L.map(this.element, {
            center: [0, 0],
            zoom: 18,
            zoomControl: false,
            attributionControl: false
        });
        
        // Add a dark-themed tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 22
        }).addTo(this.map);
        
        // Create a custom robot icon
        const robotIcon = L.divIcon({
            className: 'robot-marker',
            html: '<div class="robot-icon"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        // Add the robot marker
        this.robotMarker = L.marker([0, 0], { icon: robotIcon }).addTo(this.map);
        
        // Create a path line
        this.pathLine = L.polyline([], {
            color: '#4CAF50',
            weight: 3,
            opacity: 0.7
        }).addTo(this.map);
        
        // Add custom CSS for the robot marker
        const style = document.createElement('style');
        style.textContent = `
            .robot-icon {
                width: 20px;
                height: 20px;
                background-color: #2196F3;
                border-radius: 50%;
                border: 2px solid #ffffff;
                position: relative;
            }
            .robot-icon:after {
                content: '';
                position: absolute;
                width: 0;
                height: 0;
                top: -8px;
                left: 50%;
                transform: translateX(-50%);
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-bottom: 8px solid #2196F3;
                transform-origin: bottom center;
            }
        `;
        document.head.appendChild(style);
        
        this.initialized = true;
    }
    
    updatePosition(position, heading) {
        if (!this.initialized) return;
        
        this.position = position;
        this.heading = heading;
        
        // Update marker position and rotation
        this.robotMarker.setLatLng([position.lat, position.lng]);
        
        // Rotate the marker to match the heading
        const markerElement = this.robotMarker.getElement();
        if (markerElement) {
            const iconElement = markerElement.querySelector('.robot-icon:after');
            if (iconElement) {
                iconElement.style.transform = `translateX(-50%) rotate(${heading}deg)`;
            }
        }
        
        // Add point to path
        this.path.push([position.lat, position.lng]);
        this.pathLine.setLatLngs(this.path);
        
        // Center map on robot position
        this.map.panTo([position.lat, position.lng]);
    }
    
    addObstacle(position, radius = 0.5) {
        if (!this.initialized) return;
        
        const obstacle = L.circle([position.lat, position.lng], {
            radius: radius,
            color: '#F44336',
            fillColor: '#F44336',
            fillOpacity: 0.5
        }).addTo(this.map);
        
        this.obstacles.push(obstacle);
        return obstacle;
    }
    
    clearPath() {
        if (!this.initialized) return;
        
        this.path = [];
        this.pathLine.setLatLngs([]);
    }
    
    clearObstacles() {
        if (!this.initialized) return;
        
        this.obstacles.forEach(obstacle => {
            obstacle.remove();
        });
        this.obstacles = [];
    }
    
    // Method to handle SLAM data from the server
    processSlamData(data) {
        if (!this.initialized) return;
        
        // Update robot position
        if (data.position) {
            this.updatePosition(data.position, data.heading || 0);
        }
        
        // Process obstacles if provided
        if (data.obstacles && Array.isArray(data.obstacles)) {
            // Clear existing obstacles
            this.clearObstacles();
            
            // Add new obstacles
            data.obstacles.forEach(obstacle => {
                this.addObstacle(obstacle.position, obstacle.radius);
            });
        }
    }
} 