"use strict";
/* global requirejs: false, require: false */

requirejs.config({
	paths: {
		types: 'js/types'
	}
});

require(['js/types/colormapper'],

	function(ColorMapper) {

		let colorMapper = new ColorMapper(0, 100);

		let imgCount = 20,
			size = 20,
			radius = (0.9 * size) / 2;

		let container = document.getElementById('scale');

		function calculateSteps(num) {
			let rv = [],
				step = 100 / num;

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

			return img;
		}

		function addImgToPage(img, step) {
			let filename = `${Math.round(step * 1.0)}.png`;
			let link = createDownloadLink(img.src, filename);
			let item = document.createElement('li');

			item.appendChild(img);
			item.appendChild(link);

			container.appendChild(item);
		}

		function createDownloadLink(url, name) {
			let link = document.createElement('a');
			link.href = url;
			link.innerHTML = name;
			link.download = name;
			return link;
		}

		let canvas, ctx;

		canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;

		ctx = canvas.getContext('2d');

		for (let step of calculateSteps(imgCount)) {

			drawColorCircle(step);

			let img = createImgWithDataUrl(canvas.toDataURL());
			addImgToPage(img, step);
		}
	}
);