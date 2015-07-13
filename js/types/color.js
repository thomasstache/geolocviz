define(function() {

		function Color(r, g, b) {
			this.r = r;
			this.g = g;
			this.b = b;
		}

		/**
		 * Combine color components into one number.
		 * @return {Number}
		 */
		Color.prototype.toRGB = function() {
			return (this.b | (this.g << 8) | (this.r << 16));
		};

		/**
		 * Formats the value in CSS Hex notation "#AABBCC".
		 * @return {String}
		 */
		Color.prototype.toCSSHexString = function () {
			// see http://stackoverflow.com/questions/11683992/convert-rgb-to-hex-color
			return "#" + (0x1000000 | this.toRGB()).toString(16).substring(1);
		};

		/**
		 * Create a new color from the HSV components.
		 *
		 * see: https://en.wikipedia.org/wiki/HSL_and_HSV#Converting_to_RGB
		 * @param  {Number} h Hue in [0, 359]
		 * @param  {Number} s Saturation in [0, 1.0]
		 * @param  {Number} v Value in [0, 1.0]
		 * @return {Color}
		 */
		Color.fromHSV = function(h, s, V) {

			var r, g, b;

			if (s === 0) {
				// saturation is zero, that's gray
				r = g = b = V;
			}
			else {

				// The RGB components are piecewise linear functions of hue - in 6 intervals of 60 degrees.
				var hueInterval = Math.floor(h / 60.0);
				var f = h / 60.0 - hueInterval;
				var p = V * (1 - s), // constant floor
				    q = V * (1 - s * f), // descending
				    t = V * (1 - s * (1 - f)); // ascending

				switch (hueInterval) {
					case 0:
						r = V;
						g = t;
						b = p;
						break;
					case 1:
						r = q;
						g = V;
						b = p;
						break;
					case 2:
						r = p;
						g = V;
						b = t;
						break;
					case 3:
						r = p;
						g = q;
						b = V;
						break;
					case 4:
						r = t;
						g = p;
						b = V;
						break;
					case 5:
						r = V;
						g = p;
						b = q;
						break;
				}
			}

			return new Color(roundComponent(r), roundComponent(g), roundComponent(b));
		};

		function roundComponent(c) {
			return Math.round(c * 255);
		}

		return Color;
	}
);
