/*
The MIT License (MIT)

Copyright (c) 2015 Scott Schafer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
	ParticleFunTime

	A simple HTML5 particle system for games, websites, etc. Requires jQuery.

	To use, simply create a new ParticleFunTime object, specifying the id of the
	DOM element to house the particles and an optional 'options' object. The actual
	options that this system uses are a combination of defaultOptions, the specified
	theme, and the options that are passed in,

	The default options are specified by ParticleFunTime.defaultOptions, which defines
	the format. The theme is looked up by name in ParticleFunTime.themes. You may
	override the theme in the options object, as well as an parameters.

	More detailed documentation of the various options can be found in the declaration
	of the ParticleFunTime.defaultOptions object.

	The coordinate space has (-1,-1,1) mapping to the upper-left corner and (1,1,1) mapping
	to the the lower-right corner. Higher Z values are further away from the viewer. It's
	pseudo 3D at best, but close enough for my purposes.
*/

(function () {
    'use strict';
    
    // public ctor for ParticleFunTime element
    window.ParticleFunTime = function (container, options) {

        if (typeof container === "string") {
            this.$container = $("#" + container);
        } else {
            this.$container = $(container);
        }

        this.lastTime = new Date().getTime();
        this.lastGenerateTime = this.lastTime;
        this.numParticles = 0;
        this.particles = [];

        if (!options) {
            options = {};
        }


        this.reset(options);
        if (this.options.running) {
            this.displayFrame();
        }
    };

    var ParticleFunTime = window.ParticleFunTime;
    
    // static helper functions
    ParticleFunTime.randRange = function (minVal, maxVal) {
        if (minVal === maxVal) {
            return minVal;
        } else {
            return minVal + Math.random() * (maxVal - minVal);
        }
    };

    ParticleFunTime.randRangeInt = function (minVal, maxVal) {
        return Math.floor(ParticleFunTime.randRange(minVal, maxVal));
    };

    // standard functions, referred to in options. When called, this == ParticleFunTime
    ParticleFunTime.functions = {};

    ParticleFunTime.functions.getNumParticlesToGenerate = function (elapsedSinceGenerate) {
        if (elapsedSinceGenerate > this.options.particleGenerationTimeMS) {
            return 1; // generate just one at a time
        }
        return 0;
    };

    ParticleFunTime.functions.generateParticle = function ($element, i) {
        var particleClass = this.options.particleClasses[ParticleFunTime.randRangeInt(0, this.options.particleClasses.length)];
        $element.removeClass();
        $element.addClass("particle particle-live particle-" + particleClass);

        var particle = new Particle(this, $element);
        this.particles[i] = particle;
    };

    ParticleFunTime.functions.projectParticle = function (particle) {
        var w = this.width;
        var h = this.height;
        var s = Math.min(w, h) / 2;

        var result = {
            x: (w / 2 + s * (particle.x / particle.z)),
            y: (h / 2 + s * (particle.y / particle.z)),
            scale: particle.scale / particle.z,
            rotation: particle.rotation,
            opacity: particle.opacity
        };

        if (this.options.fadeOutTimeMS) {
            var elaspedTime = new Date().getTime() - particle.createTimeMS;
            if (elaspedTime > this.options.fadeOutTimeMS) {
                result.opacity = 0;
                particle.live = false;
            } else {
                result.opacity *= (1 - elaspedTime / this.options.fadeOutTimeMS);
            }
        }

        return result;
    }


    // ctor for private Particle object
    function Particle(particleFunTime, $element, i) {
        this.particleFunTime = particleFunTime;
        this.$element = $element;
        this.createTimeMS = new Date().getTime();
        this.live = true;
        this.width = $element.width();
        this.height = $element.height();

        var options = particleFunTime.options;

        // initialize parameters to random values within the range for each
        for (var param in options.particleParameters) {
            var range = options.particleParameters[param];
            this[param] = ParticleFunTime.randRange(range.min, range.max);
        }
    }

    // 'render' this particle by applying css
    Particle.prototype.render = function () {

        // project the particle onto the screen
        var result = this.particleFunTime.options.funcProjectParticle.call(this.particleFunTime, this);

        var w = this.particleFunTime.width;
        var h = this.particleFunTime.height;

        // element scaled width and height
        var esw = this.width * result.scale;
        var esh = this.height * result.scale;
        var isOffScreen = (this.z < 0) ||
            ((result.x + esw / 2) < 0) ||
            ((result.x - esw / 2) > w) ||
            ((result.y + esh / 2) < 0) ||
            ((result.y - esh / 2) > w);

        if (isOffScreen) {
            if (!this.startOffscreenTime) {
                this.$element.hide();
                // we just went offscreen, so record the time
                this.startOffscreenTime = new Date().getTime();
            }
        } else {
            if (this.startOffscreenTime != 0) {
                this.$element.show();
                this.startOffscreenTime = 0;
            }

            // for now just use 2D transforms for more browser compatibility, but maybe 3d later?

            var transform = "translate(" + result.x + "px, " + result.y + "px) " +
                "scale(" + result.scale + "," + result.scale + ") rotate(" + result.rotation + "deg)";

            this.$element[0].style["-webkitTransform"] = transform;
            this.$element[0].style["-msTransform"] = transform;
            this.$element[0].style["transform"] = transform;
            this.$element[0].style["opacity"] = result.opacity;

            // TODO, maybe change z-index
        }
    }

    // apply the forces for the elapsed time
    Particle.prototype.applyForces = function (elapsedTime) {
        var s = elapsedTime / 1000;
        this.x += this.vx * s;
        this.y += this.vy * s;
        this.z += this.vz * s;
        this.rotation += this.angularVelocity * s;

        var options = this.particleFunTime.options;
        this.vx += options.gravity.x * s;
        this.vy += options.gravity.y * s;
        this.vz += options.gravity.z * s;

        if (this.hasOwnProperty("tx")) {
            this.x += this.tx * s;
            this.y += this.ty * s;
            this.z += this.tz * s;
        }
    }

    // the default options, which themes and user options may override
    ParticleFunTime.defaultOptions = {

        // running: are we generating particles? control with start()/stop()
        running: true,

        // theme: the name of the theme in use
        theme: "fallingStars",

        // backgroundStyle: the style of the background div
        backgroundStyle: {
            'background-color': 'black'
        },

        // particleClasses: an array of CSS classes that can be applied to particles.
        // 	these classes should be declared in ParticleFunTime.allParticleClasses
        particleClasses: ["red-star", "blue-star", "yellow-star"],

        // maxParticles: the max number of particles this can animate
        maxParticles: 50,

        // particleGenerationTimeMS: the time between generating each particle
        particleGenerationTimeMS: 50,

        // maxTimeOffscreenMS: the maximum time a particle can be "offscreen" before it's recycled
        maxTimeOffscreenMS: 1000,

        // if > 0, particles will fade to 0 opacity over this time period
        fadeOutTimeMS: 3000,

        // gravity: applied to all particles (added to particle velocity)
        gravity: {
            x: 0,
            y: .6,
            z: 0
        },

        // funcGetNumParticlesToGenerate: a function called to determine how many particles to generate
        funcGetNumParticlesToGenerate: ParticleFunTime.functions.getNumParticlesToGenerate,

        // funcGenerateParticle: a function called to generate an individual particle
        funcGenerateParticle: ParticleFunTime.functions.generateParticle,

        // funcProjectParticle: a function called to 'project' a particle into css ready values
        funcProjectParticle: ParticleFunTime.functions.projectParticle,

        // particleParameters: an object defining the parameters and ranges for each particle
        particleParameters: {
            x: {
                min: -1,
                max: 1
            }, // x, y, z - initial coordinates
            y: {
                min: -1.1,
                max: -1.1
            },
            z: {
                min: .5,
                max: 1
            },
            scale: {
                min: 1,
                max: 1
            }, // scaling
            rotation: {
                min: 0,
                max: 360
            }, // rotation in degrees
            opacity: {
                min: 1,
                max: 1
            },

            vx: {
                min: 0,
                max: 0
            }, // velocity
            vy: {
                min: 0,
                max: 0
            },
            vz: {
                min: 0,
                max: 0
            },
            angularVelocity: {
                min: -100,
                max: 100
            } // AKA spin

            // optional: tx, ty, tz, which are constant translation values applied to each particle
        }
    };

    ParticleFunTime.themes = {
        fallingStars: {},

        starBurst: {
            particleParameters: {
                x: {
                    min: 0,
                    max: 0
                },
                y: {
                    min: 1,
                    max: 1
                },
                z: {
                    min: 1,
                    max: 1
                },
                scale: {
                    min: 1,
                    max: 1
                },
                rotation: {
                    min: 0,
                    max: 360
                },
                opacity: {
                    min: 1,
                    max: 1
                },

                vx: {
                    min: -.5,
                    max: .5
                },
                vy: {
                    min: -1.5,
                    max: -2.5
                },
                vz: {
                    min: -.5,
                    max: -.2
                },
                angularVelocity: {
                    min: -200,
                    max: 200
                },
            },
        },

        starField: {
            particleGenerationTimeMS: 25,
            gravity: {
                x: 0,
                y: 0,
                z: 0
            },
            particleClasses: ["white-star"],
            fadeOutTimeMS: 0,

            funcProjectParticle: function (particle) {
                // call the standard projection function but adjust the opacity so stars fade in
                var result = ParticleFunTime.functions.projectParticle.call(this, particle);
                result.opacity = Math.max(0, 1 - particle.z / 20);
                return result;
            },

            particleParameters: {
                x: {
                    min: -10,
                    max: 10
                },
                y: {
                    min: -10,
                    max: 10
                },
                z: {
                    min: 15,
                    max: 15
                },
                scale: {
                    min: 1,
                    max: 2
                },
                rotation: {
                    min: -720,
                    max: 720
                },
                opacity: {
                    min: 1,
                    max: 1
                },

                vx: {
                    min: 0,
                    max: 0
                },
                vy: {
                    min: 0,
                    max: 0
                },
                vz: {
                    min: 0,
                    max: 0
                },

                tx: {
                    min: 0,
                    max: 0
                },
                ty: {
                    min: 0,
                    max: 0
                },
                // move the particles towards the viewer at a constant speed to give the illusion of flight
                tz: {
                    min: -3,
                    max: -3
                },

                angularVelocity: {
                    min: -100,
                    max: 100
                },
            },
        },


    };

    ParticleFunTime.allParticleClasses = {
        "red-star": '<svg class="1" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 51 48">' +
            '	<title>Red Five Pointed Star</title>' +
            '	<path fill="#ff0000" stroke="#000" d="m25,1 6,17h18l-14,11 5,17-15-10-15,10 5-17-14-11h18z"/>' +
            '</svg>',

        'blue-star': '<svg class="2"  xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 51 48">' +
            '	<title>Blue Five Pointed Star</title>' +
            '	<path fill="#0000ff" stroke="#000" d="m25,1 6,17h18l-14,11 5,17-15-10-15,10 5-17-14-11h18z"/>' +
            '</svg>',

        'yellow-star': '<svg class="3"  xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 51 48">' +
            '	<title>Green Five Pointed Star</title>' +
            '	<path fill="#ffff00" stroke="#000" d="m25,1 6,17h18l-14,11 5,17-15-10-15,10 5-17-14-11h18z"/>' +
            '</svg>',


        'white-star': '<svg class="3"  xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 51 48">' +
            '	<title>Green Five Pointed Star</title>' +
            '	<path fill="#ffffff" stroke="#000" d="m25,1 6,17h18l-14,11 5,17-15-10-15,10 5-17-14-11h18z"/>' +
            '</svg>',

        "blue-rectangle": "background-color: blue"
    };


    ParticleFunTime.prototype.displayFrame = function () {

        if (this.options.running || this.numParticles > 0) {
            var curTime = new Date().getTime();
            this.elapsedTime = curTime - this.lastTime;
            this.lastTime = curTime;

            this.destroyParticles();
            this.animateParticles();
            this.generateParticles();

            var self = this;
            requestAnimationFrame(function () {
                self.displayFrame();
            });
        }
    }

    ParticleFunTime.prototype.start = function () {
        this.options.running = true;
        this.displayFrame();
    }

    ParticleFunTime.prototype.stop = function () {
        this.options.running = false;
    }

    ParticleFunTime.prototype.reset = function (options) {
        // form the options based on the default options + the specified theme + the user specified options
        var combinedOptions = ParticleFunTime.defaultOptions;
        var themeName = options.hasOwnProperty("theme") ? options.theme : ParticleFunTime.defaultOptions.theme;
        var theme = ParticleFunTime.themes[themeName];
        this.options = $.extend({}, $.extend({}, ParticleFunTime.defaultOptions, theme), options);

        this.numParticles = 0;

        this.$container.empty();

        var styles = "<style scoped>\n";
        styles += ".background, .particles {\nposition:absolute; width:inherit; height:inherit;\n}\n";
        styles += "\n</style>";

        this.$container.append(styles);

        this.$container.append("<div class='background'></div><div class='particles'></div>");

        this.$container.children(".background").css(this.options.backgroundStyle);

        styles = "<style scoped>";
        styles += ".particle {\nposition:absolute; display: none; width:20px; height:20px;\n}\n";
        styles += ".particle-live {\ndisplay:block;\n}\n";

        for (var iParticleClass in this.options.particleClasses) {
            var particleClass = this.options.particleClasses[iParticleClass];
            styles += ".particle-" + particleClass + "{\n";

            var style = ParticleFunTime.allParticleClasses[particleClass];
            // special case for SVG - reencode as base64 for cross-browser compatibility
            if (style.substr(0, 4) == "<svg") {
                var mySVG64 = window.btoa(style);
                style = "background-image: url('data:image/svg+xml;base64," + mySVG64 + "');\n";
            }

            styles += style + "}\n\n";
        }
        styles += "</style>";

        this.$container.children(".particles").append(styles);

        this.particles = [];
        var $particles = this.$container.children(".particles");
        for (var i = 0; i < this.options.maxParticles; i++) {
            $particles.append("<div class='particle'></div>");
            this.particles.push(null);
        }
        this.$particles = $particles.children(".particle");

        if (this.options.running) {
            this.displayFrame();
        }
    }

    ParticleFunTime.prototype.destroyParticles = function () {

        var curTime = new Date().getTime();

        for (var i = 0; i < this.particles.length; i++) {
            var particle = this.particles[i];
            if (particle) {
                var destroy = false;
                if (!particle.live) {
                    destroy = true;
                } else if (particle.startOffscreenTime && ((curTime - particle.startOffscreenTime) > this.options.maxTimeOffscreenMS)) {
                    destroy = true;
                }

                if (destroy) {
                    particle.$element.removeClass("particle-live");
                    this.particles[i] = null;
                    --this.numParticles;
                }
            }
        }
    }

    ParticleFunTime.prototype.animateParticles = function () {

        var $particles = this.$container.children(".particles");
        this.width = $particles.width();
        this.height = $particles.height();

        for (var i = 0; i < this.particles.length; i++) {
            var particle = this.particles[i];
            if (particle) {
                particle.applyForces(this.elapsedTime);
                particle.render();
            }
        }
    }

    ParticleFunTime.prototype.generateParticles = function () {

        if (this.options.running) {
            var curTime = new Date().getTime();
            var elapsedSinceGenerate = curTime - this.lastGenerateTime;

            if (this.numParticles < this.options.maxParticles) {
                var numGenerate = this.options.funcGetNumParticlesToGenerate.call(this, elapsedSinceGenerate);
                if (numGenerate) {
                    this.lastGenerateTime = curTime;

                    while (numGenerate--) {
                        var i;
                        for (i = 0; i < this.options.maxParticles; i++) {
                            var $particle = this.$particles.eq(i);
                            if (!$particle.hasClass("particle-live")) {
                                break;
                            }
                        }
                        ++this.numParticles;
                        this.options.funcGenerateParticle.call(this, $particle, i);
                        this.particles[i].render();
                    }
                }
            }
        }
    }

    // Polyfill for requestAnimationFrame

    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

    // requestAnimationFrame polyfill by Erik Möller
    // fixes from Paul Irish and Tino Zijdel
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function (callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function () {
                    callback(currTime + timeToCall);
                },
                timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function (id) {
            clearTimeout(id);
        };


}());