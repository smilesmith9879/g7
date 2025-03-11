/**
 * Joystick Controller
 * Handles touch/mouse events for virtual joystick controls
 */
class Joystick {
    constructor(element, options = {}) {
        this.element = element;
        this.knob = element.querySelector('.joystick-knob');
        this.options = Object.assign({
            autoReturn: true,
            maxDistance: 40,
            deadZone: 0.1,
            onMove: () => {},
            onEnd: () => {}
        }, options);

        this.position = { x: 0, y: 0 };
        this.normalizedPosition = { x: 0, y: 0 };
        this.active = false;
        this.centerX = this.element.offsetWidth / 2;
        this.centerY = this.element.offsetHeight / 2;

        this.bindEvents();
    }

    bindEvents() {
        // Touch events
        this.element.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleEnd.bind(this));
        document.addEventListener('touchcancel', this.handleEnd.bind(this));

        // Mouse events
        this.element.addEventListener('mousedown', this.handleStart.bind(this));
        document.addEventListener('mousemove', this.handleMove.bind(this));
        document.addEventListener('mouseup', this.handleEnd.bind(this));

        // Handle window resize
        window.addEventListener('resize', this.updateDimensions.bind(this));
    }

    updateDimensions() {
        this.centerX = this.element.offsetWidth / 2;
        this.centerY = this.element.offsetHeight / 2;
    }

    handleStart(event) {
        event.preventDefault();
        this.active = true;
        this.element.classList.add('active');
        this.updatePosition(event);
    }

    handleMove(event) {
        if (!this.active) return;
        event.preventDefault();
        this.updatePosition(event);
    }

    handleEnd(event) {
        if (!this.active) return;
        this.active = false;
        this.element.classList.remove('active');
        
        if (this.options.autoReturn) {
            this.resetPosition();
        }
        
        this.options.onEnd(this.normalizedPosition);
    }

    updatePosition(event) {
        let clientX, clientY;
        
        if (event.type.startsWith('touch')) {
            const touch = event.touches[0] || event.changedTouches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        const rect = this.element.getBoundingClientRect();
        const x = clientX - rect.left - this.centerX;
        const y = clientY - rect.top - this.centerY;
        
        // Calculate distance from center
        const distance = Math.min(
            this.options.maxDistance,
            Math.sqrt(x * x + y * y)
        );
        
        // Calculate angle in radians
        const angle = Math.atan2(y, x);
        
        // Calculate new position based on angle and distance
        this.position = {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance
        };
        
        // Normalize position values to -1 to 1 range
        this.normalizedPosition = {
            x: this.position.x / this.options.maxDistance,
            y: this.position.y / this.options.maxDistance
        };
        
        // Apply dead zone
        if (Math.abs(this.normalizedPosition.x) < this.options.deadZone) {
            this.normalizedPosition.x = 0;
        }
        
        if (Math.abs(this.normalizedPosition.y) < this.options.deadZone) {
            this.normalizedPosition.y = 0;
        }
        
        // Update knob position
        this.knob.style.transform = `translate(${this.position.x}px, ${this.position.y}px)`;
        
        // Call the move callback
        this.options.onMove(this.normalizedPosition);
    }

    resetPosition() {
        this.position = { x: 0, y: 0 };
        this.normalizedPosition = { x: 0, y: 0 };
        this.knob.style.transform = 'translate(0, 0)';
    }
} 