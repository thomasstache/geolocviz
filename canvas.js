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

		let container = document.getElementById('scale');

		let startButton = document.getElementById('btnStart');
		startButton.addEventListener('click', generate);

		function getValueFromInput(id, defaultvalue) {
			let rv = defaultvalue;
			let input = document.getElementById(id);
			if (input instanceof HTMLInputElement) {
				if (input.valueAsNumber) {
					rv = input.valueAsNumber;
				}
				else
					rv = input.value;
			}
			return rv;
		}

		function removeExistingChildren(parent) {
			let children = parent.children;
			for (var i = children.length - 1; i >= 0; i--) {
				children[i].remove();
			}
		}

		function calculateSteps(num) {
			let rv = [],
				step = 100 / num;

			for (let i = 0; i <= num; i++) {
				rv.push(i * step);
			}

			return rv;
		}

		function drawColorCircle(value, size, radius, ctx) {

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

		let canvas = document.createElement('canvas');

		function generate() {

			removeExistingChildren(container);

			let imgCount = getValueFromInput('inputCount', 20),
				size = getValueFromInput('inputSize', 20),
				radius = (0.9 * size) / 2;

			canvas.width = size;
			canvas.height = size;

			let ctx = canvas.getContext('2d');

			for (let step of calculateSteps(imgCount)) {

				drawColorCircle(step, size, radius, ctx);

				let img = createImgWithDataUrl(canvas.toDataURL());
				addImgToPage(img, step);
			}
		}
	}
);