(function () {
    function initStarfield(canvasId) {
        const starCanvas = document.getElementById(canvasId);
        if (!starCanvas) return;

        const ctx = starCanvas.getContext("2d");

        let width = (starCanvas.width = window.innerWidth);
        let height = (starCanvas.height = window.innerHeight);

        const BASE_STARS = 180;
        const BASE_BG_STARS = 140;
        const MAX_LINE_DIST = 170;
        const STAR_RADIUS = 2;

        let NUM_STARS = BASE_STARS;
        let NUM_BACKGROUND_STARS = BASE_BG_STARS;

        let stars = [];
        let backgroundStars = [];

        // --- Black-hole / cursor state ---
        let mouseX = width / 2;
        let mouseY = height / 2;
        let mouseActive = false;

        // --- Zoom / pseudo-3D camera ---
        let zoom = 1;         // current zoom factor
        let targetZoom = 1;   // where we want to go (lerp each frame)

        function updateCountsForSize() {
            width = starCanvas.width = window.innerWidth;
            height = starCanvas.height = window.innerHeight;

            const w = width;

            if (w < 480) {
                NUM_STARS = Math.floor(BASE_STARS * 0.20);
                NUM_BACKGROUND_STARS = Math.floor(BASE_BG_STARS * 0.20);
            } else if (w < 768) {
                NUM_STARS = Math.floor(BASE_STARS * 0.40);
                NUM_BACKGROUND_STARS = Math.floor(BASE_BG_STARS * 0.40);
            } else if (w < 1200) {
                NUM_STARS = Math.floor(BASE_STARS * 0.50);
                NUM_BACKGROUND_STARS = Math.floor(BASE_BG_STARS * 0.45);
            } else {
                NUM_STARS = BASE_STARS;
                NUM_BACKGROUND_STARS = BASE_BG_STARS;
            }
        }

        window.addEventListener("resize", () => {
            updateCountsForSize();
            resetStars();
        });

        // Pointer works for mouse + touchpad + pen
        window.addEventListener("pointermove", (e) => {
            const rect = starCanvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
            mouseActive = true;
        });

        window.addEventListener("pointerleave", () => {
            mouseActive = false;
        });

        function drawStar(ctx, x, y, radius, color, rotation = 0) {
            const spikes = 5;
            const outer = radius;
            const inner = radius * 0.45;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            let angle = (Math.PI / 2) * 3;
            const step = Math.PI / spikes;

            ctx.beginPath();
            ctx.moveTo(0, -outer);

            for (let i = 0; i < spikes; i++) {
                ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
                angle += step;
                ctx.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
                angle += step;
            }

            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
        }

        function randomStarColor() {
            const colors = ["#5A8CFF", "#7F5BFF", "#C66BFF", "#2DE2E6", "#FF6FD8", "#A0C4FF"];
            return colors[Math.floor(Math.random() * colors.length)];
        }


        class BackgroundStar {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.radius = 0.4 + Math.random() * 1.2;
                this.alpha = 0.08 + Math.random() * 0.25;
            }
            draw() {
                const { x, y } = transformPoint(this.x, this.y, 0.3); // subtle zoom impact
                ctx.beginPath();
                ctx.arc(x, y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200,220,255,${this.alpha})`;
                ctx.fill();
            }
        }

        class Star {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;

                const r = Math.random();
                if (r < 0.7) this.speed = 0.1 + Math.random() * 0.3;
                else if (r < 0.95) this.speed = 0.4 + Math.random() * 0.4;
                else this.speed = 0.8 + Math.random();

                const angle = Math.random() * Math.PI * 2;
                this.vx = Math.cos(angle) * this.speed;
                this.vy = Math.sin(angle) * this.speed;

                this.color = randomStarColor();
                this.rotation = Math.random() * Math.PI * 2;

                const s = Math.random();
                if (s < 0.3) this.spinSpeed = 0;
                else if (s < 0.8) this.spinSpeed = Math.random() * 0.005;
                else if (s < 0.98) this.spinSpeed = 0.005 + Math.random() * 0.02;
                else this.spinSpeed = 0.02 + Math.random() * 0.05;

                // Depth per star for zoom/parallax feeling
                this.depth = 0.4 + Math.random() * 0.6; // 0.4–1.0
            }

            applyBlackHole() {
                if (!mouseActive) return;

                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

                const eventHorizon = 30;     // small core
                const influenceRadius = 200; // lower radius

                if (dist < eventHorizon) {
                    this.reset();
                    return;
                }

                if (dist < influenceRadius) {
                    // Softer gravity
                    const baseStrength = 0.05; // was 0.35
                    const strength = (1 - dist / influenceRadius) * baseStrength * this.depth;

                    this.vx += (dx / dist) * strength;
                    this.vy += (dy / dist) * strength;

                    // Very subtle orbit component
                    const tangentX = -dy / dist;
                    const tangentY = dx / dist;
                    const orbitStrength = strength * 0.15;
                    this.vx += tangentX * orbitStrength;
                    this.vy += tangentY * orbitStrength;
                }

                const maxSpeed = 2.3;
                const vMag = Math.hypot(this.vx, this.vy);
                if (vMag > maxSpeed) {
                    this.vx = (this.vx / vMag) * maxSpeed;
                    this.vy = (this.vy / vMag) * maxSpeed;
                }
            }

            update() {
                this.applyBlackHole();

                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;

                this.rotation += this.spinSpeed;
            }

            draw() {
                const size = STAR_RADIUS * (1.8 + this.depth);
                const { x, y } = transformPoint(this.x, this.y, this.depth);
                drawStar(ctx, x, y, size, this.color, this.rotation);
            }
        }

        function resetStars() {
            stars = Array.from({ length: NUM_STARS }, () => new Star());
            backgroundStars = Array.from(
                { length: NUM_BACKGROUND_STARS },
                () => new BackgroundStar()
            );
        }

        // Apply zoom relative to screen center, scaled a bit by depth
        function transformPoint(x, y, depth = 1) {
            const cx = width / 2;
            const cy = height / 2;
            const dZoom = 1 + (zoom - 1) * depth; // closer stars zoom more
            return {
                x: cx + (x - cx) * dZoom,
                y: cy + (y - cy) * dZoom
            };
        }

        function drawConnections() {
            ctx.lineWidth = 0.3;
            for (let i = 0; i < stars.length; i++) {
                for (let j = i + 1; j < stars.length; j++) {
                    const a = stars[i];
                    const b = stars[j];

                    const ta = transformPoint(a.x, a.y, a.depth);
                    const tb = transformPoint(b.x, b.y, b.depth);

                    const dx = ta.x - tb.x;
                    const dy = ta.y - tb.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < MAX_LINE_DIST) {
                        const alpha = 1 - dist / MAX_LINE_DIST;
                        ctx.beginPath();
                        ctx.moveTo(ta.x, ta.y);
                        ctx.lineTo(tb.x, tb.y);
                        ctx.strokeStyle = `rgba(230,240,255,${alpha * 0.9})`;
                        ctx.stroke();
                    }
                }
            }
        }

        function drawBlackHole() {
            if (!mouseActive) return;

            const coreRadius = 6;
            const outerRadius = 80;

            const gradient = ctx.createRadialGradient(
                mouseX, mouseY, 0,
                mouseX, mouseY, outerRadius
            );

            // Much more subtle: small dark core, quick falloff
            gradient.addColorStop(0, "rgba(0,0,0,0.8)");
            gradient.addColorStop(coreRadius / outerRadius * 0.9, "rgba(5,8,22,0.75)");
            gradient.addColorStop(1, "rgba(5,8,22,0)");

            ctx.save();
            ctx.globalCompositeOperation = "multiply"; // darken underlying stars instead of bright halo
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, outerRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.restore();
        }

        function loop() {
            // Ease zoom towards target
            targetZoom = mouseActive ? 1.04 : 1.0; // very subtle zoom
            zoom += (targetZoom - zoom) * 0.04;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "#050816";
            ctx.fillRect(0, 0, width, height);

            // Background stars
            for (const bs of backgroundStars) bs.draw();

            // Subtle black hole darkening
            drawBlackHole();

            // Foreground stars
            for (const s of stars) {
                s.update();
                s.draw();
            }

            // Connection lines
            drawConnections();

            requestAnimationFrame(loop);
        }

        updateCountsForSize();
        resetStars();
        loop();
    }

    window.initStarfield = initStarfield;
})();
