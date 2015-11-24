"use strict";
/* global requirejs: false, require: false */

requirejs.config({
	paths: {
		types: 'js/types'
	}
});

require(['js/types/colormapper'],

	function(ColorMapper) {

		let colorMapper = new ColorMapper(0, 1.0);

		let imgCount = 30,
			size = 20,
			radius = (0.9 * size) / 2;

		let canvas, ctx;

		let container = document.body;

		function calculateSteps(num) {
			let rv = [],
				step = 1.0 / num;

			for (let i = 0; i <= num; i++) {
				rv.push(i * step);
			}

			return rv;
		}

		function drawColorCircle(value) {

			ctx.fillStyle = colorMapper.getColor(value);

			let x, y;
			x = y = size / 2;
			ctx.clearRect(0, 0, size, size);

			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			ctx.fill();
		}

		function createImgWithDataUrl(url) {
			let img = document.createElement('img');

			img.src = url;

			container.appendChild(img);
		}

		canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;

		ctx = canvas.getContext('2d');

		for (let step of calculateSteps(imgCount)) {

			drawColorCircle(step);

			createImgWithDataUrl(canvas.toDataURL());
		}
	}
);