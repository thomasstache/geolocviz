define(function() {

		function Color(r, g, b) {
			this.r = r;
			this.g = g;
			this.b = b;
		}

		/**
		 * Combine color components into one number.
		 */
		Color.prototype.toRGB = function() {
			return (this.b | (this.g << 8) | (this.r << 16));
		};

		/**
		 * Formats the value in CSS Hex notation "#AABBCC".
		 */
		Color.prototype.toCSSHexString = function () {
			// see http://stackoverflow.com/questions/11683992/convert-rgb-to-hex-color
			return "#" + (0x1000000 | this.toRGB()).toString(16).substring(1);
		};

		return Color;
	}
);
