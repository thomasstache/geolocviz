// jshint esnext:true
define(
	["types/color"],

	function(Color) {

		// Hash algorithm constants
		var WORDSIZE = 32;
		var HASHSIZE = 16;
		var MAX_HASH = Math.pow(2, HASHSIZE);

		var A = (Math.sqrt(5) - 1) / 2;

		// HSV conversion constants
		// variate S by 30%
		var dS = 0.3;
		// value is constant
		var V = 0.95;

		function DistinctColorMapper() {
			this.colorCache = new Map();
		}

		DistinctColorMapper.prototype.getColor = function(value) {

			if (this.colorCache.has(value)) {
				return this.colorCache.get(value);
			}

			var rv = "transparent";
			var hash, hsv, color, hashFct;

			if (typeof value === "string") {
				hashFct = this.hashStringValue;
			}
			else if (typeof value === "number") {
				hashFct = this.hashIntValue;
			}
			else {
				console.error("The value type is unsupported for hashing.");
			}

			if (hashFct) {

				// console.log("Value: ", value);
				hash = hashFct(value);

				if (hash === undefined)
					return rv;

				hsv = this.hsvFromHashValue(hash);
				color = Color.fromHSV(hsv.h, hsv.s, hsv.v);
				rv = color.toCSSHexString();

				// console.log("HSV:   ", hsv);
				// console.log("Color: ", color);
			}

			this.colorCache.set(value, rv);

			return rv;
		};

		/**
		 * Integer hash function using "multiplication method".
		 *
		 * see: http://www.cs.hmc.edu/~geoff/classes/hmc.cs070.200101/homework10/hashfuncs.html
		 *      https://www.cs.auckland.ac.nz/software/AlgAnim/hash_func.html
		 * @param  {Number} key The value to hash
		 * @return {Number}     The hash value or "undefined" on error
		 */
		DistinctColorMapper.prototype.hashIntValue = function(key) {

			var hash;

			if (key === undefined || isNaN(key))
				return hash; // undefined

			var x = key * Math.floor(A * Math.pow(2, WORDSIZE));
			hash = x >> (WORDSIZE - HASHSIZE);
			return ((hash + MAX_HASH) % MAX_HASH);
		};

		/**
		 * Generate a hash code for the given string.
		 * This corresponds to Java's String.hashCode()
		 * The problem is that consecutive strings like cell names (WXUO38A, WXUO38B) get consecutive results.
		 * @param  {String} str
		 * @return {Number}
		 */
		DistinctColorMapper.prototype.hashStringValue = function(str) {

			var hash = 0;
			for (var i = 0; i < str.length; i++) {
				hash = str.charCodeAt(i) + ((hash << 5) - hash);
			}

			return hash;
		};

		/**
		 * Generate a HSV color for the value.
		 * Value ranges:
		 *   Hue:        [0, 360]
		 *   Saturation: [0, 1.0]
		 *   Value:      [0, 1.0]
		 * @param  {Number} value
		 * @return {Object} object literal with the h, s, v components
		 */
		DistinctColorMapper.prototype.hsvFromHashValue = function(value) {

			var hi = (value & 0x00ff00) >> 8;
			var lo = (value & 0x0000ff);

			var H = Math.round(hi / 256 * 360);
			var S = (1 - dS) + (lo / 256 * dS);
			S = Math.round(S * 100) / 100;

			if (H < 0)
				H += 360;

			// console.log("Hash:  ", value, "\tVal1: ", hi, "\tVal2: ", lo);

			return {h: H, s: S, v: V};
		};

		DistinctColorMapper.prototype.resetCache = function() {
			this.colorCache.clear();
		};

		return DistinctColorMapper;
	}
);