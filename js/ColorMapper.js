define(function() {

		function ColorMapper(min, max) {

			this.setLimits(min, max);
			this.colorCount = COLORS.length;
			[0, 0.1, 0.2, .4,.5,.6,.7,.8,.9,1].forEach(function(v) {
				console.log(this.getColor(v));
			}.bind(this));
		}

		/**
		 * Set scale limits.
		 * @param {Number} min Value matching to lowest color entry
		 * @param {Number} max Value matching to highest color entry
		 */
		ColorMapper.prototype.setLimits = function(min, max) {
			this.scaleMin = min;
			this.scaleMax = max;
		};

		/**
		 * Calculate the color corresponding to the value.
		 * @param  {Number} value
		 * @return {String}       The color in hex CSS notation
		 */
		ColorMapper.prototype.getColor = function(value) {

			var rv = "#000";
			if (typeof value === "number") {
				var r, g, b, rgb;

				if (value <= this.scaleMin) {
					rgb = COLORS[0];
				}
				else if (value >= this.scaleMax) {
					rgb = COLORS[this.colorCount - 1];
				}
				else {
					// determine bounding colors
					var relValue = (this.colorCount - 1) * (value - this.scaleMin) / (this.scaleMax - this.scaleMin);
					var lower = Math.floor(relValue),
						upper = Math.ceil(relValue),
						delta = relValue - lower;
					var rgb1 = COLORS[lower],
						rgb2 = COLORS[upper];

					console.log("v" + value + " rv" + relValue + " l" + lower + " u" + upper + " d" + delta);
					// interpolate
					r = rgb1[0] + (rgb2[0] - rgb1[0]) * delta;
					g = rgb1[1] + (rgb2[1] - rgb1[1]) * delta;
					b = rgb1[2] + (rgb2[2] - rgb1[2]) * delta;
					rgb = toRGB(r, g, b);
				}

				rv = "#" + toHexString(rgb);
			}

			return rv;
		};

		// more readable to define colors as arrays
		var COLORS = [
			[  0,   0, 255], // blue
			[  0, 128, 255], // cyan
			[  0, 255,   0], // green
			[255, 255,   0], // yellow
			[255,   0,   0], // red
		];

		/**
		 * Combine color components into one number.
		 */
		function toRGB(r, g, b) {
			return (b | (g << 8) | (r << 16));
		}

		// Format
		function toHexString(rgb) {
			// see http://stackoverflow.com/questions/11683992/convert-rgb-to-hex-color
			return (0x1000000 | rgb).toString(16).substring(1);
		}

		return ColorMapper;
	}
);
