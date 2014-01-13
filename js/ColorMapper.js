define(
	["models/color"],

	function(Color) {

		var TEST = false;

		/**
		 * Creates a new Color Mapper for the given value range.
		 * @param {Number} min Value corresponding to the lowest color entry
		 * @param {Number} max Value corresponding to the highest color entry
		 */
		function ColorMapper(min, max) {

			this.setLimits(min, max);
			this.colorCount = COLORS.length;
		}

		/**
		 * Set scale limits.
		 * @param {Number} min Value corresponding to the lowest color entry
		 * @param {Number} max Value corresponding to the highest color entry
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
			if (typeof value === "number" && !isNaN(value)) {
				var color;

				if (value <= this.scaleMin) {
					color = COLORS[0];
				}
				else if (value >= this.scaleMax) {
					color = COLORS[this.colorCount - 1];
				}
				else {
					// determine bounding colors
					var relValue = (this.colorCount - 1) * (value - this.scaleMin) / (this.scaleMax - this.scaleMin);
					var lower = Math.floor(relValue),
						upper = Math.ceil(relValue),
						delta = relValue - lower;
					var rgb1 = COLORS[lower],
						rgb2 = COLORS[upper];

					// interpolate
					var r, g, b;
					r = rgb1.r + (rgb2.r - rgb1.r) * delta;
					g = rgb1.g + (rgb2.g - rgb1.g) * delta;
					b = rgb1.b + (rgb2.b - rgb1.b) * delta;

					color = new Color(r, g, b);
				}

				rv = color.toCSSHexString();

				if (TEST)
					console.log(" val:" + value + " -> " + rv + ", rgb:" + color.toRGB());
			}
			else {
				console.log("ColorMapper: illegal value '" + value + "'.");
			}

			return rv;
		};

		// the color scale
		var COLORS = [
			new Color(  0,   0, 255), // blue
			new Color(  0, 128, 255), // cyan
			new Color(  0, 255,   0), // green
			new Color(255, 255,   0), // yellow
			new Color(255,   0,   0) // red
		];

		// "unit test"
		function test() {
			console.log("ColorMapper test:");
			var c = new ColorMapper(0, 1);
			[NaN, "a", 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0].forEach(function(v) {
				c.getColor(v);
			});
			console.log("ColorMapper test complete.");
		}

		if (TEST)
			test();

		return ColorMapper;
	}
);
