/* global $ */
$.jCanvas.defaults.fromCenter = false;

/*
Create the binary contents of a bitmap file.

This is not a public interface and is subject to change.

Arguments:

    width -- width of the bitmap
    height -- height of the bitmap
    palette -- array of 'rrggbb' strings (if appropriate)
    imgdata -- pixel data in faux-binary escaped text
    bpp -- bits per pixel; use in conjunction with compression
    compression -- compression mode (e.g. uncompressed, 8-bit RLE, 4-bit RLE)
*/
function _bmp(width, height, palette, imgdata, bpp, compression) {

	var imgdatasize = imgdata.length;
	var palettelength = palette.length;
	var palettesize = palettelength * 4; // 4 bytes per colour
	var pixeloffset = 54 + palettesize; // pixel data offset
	var data = [
		"BM",                                 // magic number
		_pack(width),      // size of file
		"\x00\x00\x00\x00",               // unused
		_pack(pixeloffset),   // number of bytes until pixel data
		"\x28\x00\x00\x00",               // number of bytes left in the header
		_pack(width),         // width of pixmap
		_pack(height),        // height of pixmap
		"\x01\x00",                         // number of colour planes, must be 1
		_pack(bpp, 2),           // bits per pixel
		_pack(compression),   // compression mode
		_pack(imgdatasize),   // size of raw BMP data (after the header)
		"\x13\x0B\x00\x00",               // # pixels per metre horizontal res.
		"\x13\x0B\x00\x00",               // # pixels per metre vertical res
		_pack(palettelength), // num colours in palette
		"\x00\x00\x00\x00"                // all colours are important

		// END OF HEADER
	];

	for (var i=0; i<palette.length; ++i) {
		data.push(_pack(parseInt(palette[i], 16)));
	}
	data.push(imgdata);
	return data.join("");
}

/*
Pack JS integer (signed big-endian?) `num` into a little-endian binary string
of length `len`.
*/
function _pack(num, len) {
	var o = [], len = ((typeof len == 'undefined') ? 4 : len);
	for (var i=0; i<len; ++i) {
		o.push(String.fromCharCode((num >> (i * 8)) & 0xff));
	}
	return o.join("");
}

/*
Create an uncompressed Windows bitmap (BI_RGB) given width, height and an
array of pixels.

Pixels should be in BMP order, i.e. starting at the bottom left, going up
one row at a time.

Example:

    var onebluepixel = bmp(1, 1, ['0000ff']);
*/
function bmp_rgb(width, height, pixarray) {
	var rowsize = (width * 3);
	var rowpadding = (rowsize % 4);
	if (rowpadding) rowpadding = Math.abs(4 - rowpadding);

	var i, j, pix;
	var pixcache = {};
	// Based on profiling, it's more than 10x faster to reverse the array
	// and pop items off the end than to shift them of the front. WTF.
	pixarray.reverse();
	var pixels = [];
	for (i=0; i<height; ++i) {
		for (j=0; j<width; ++j) {
			pix = pixarray.pop();
			if (typeof pixcache[pix] == 'undefined')
				pixcache[pix] = _pack(parseInt(pix, 16), 3);
			pixels.push(pixcache[pix]);
		}
		for (j=0; j<rowpadding; ++j) {
			pixels.push("\x00");
		}
	}
	return _bmp(width, height, [], pixels.join(""), 24, 0);
}

var fontSize = 18;

/* jCanvas has an option for write full strings but don't have a option for control letter spacing.
The font has a letter spacing of 2px, and the generator needs a spacing of 1px.
This function allows to write character by character with only 1px of spacing. */
var write = function(x, y, text, color = 'gray') {
	while (text != '') {
		var letter = text.substr(0,1);
	
		/* Search for specials characters */
		if (letter == '_') {
			text = text.substr(1);
			letter = text.substr(0,1);
			if (color == 'gray') color = 'white';
			else if (color == 'white') color = 'gray';
		}

		/* Draw 1 character */
		$('#topscreen').drawText({
			fillStyle: color,
			x: x + 2, y: y,
			fontSize: fontSize,
			fontFamily: 'PerfectDOSVGA437Win',
			align: 'left',
			text: letter
		});
	
		/* Remove the character written from the string, and if isn't empty, continue recursive */
		text = text.substr(1);
		x = x + fontSize / 2;
	}
}

/* This draw the entire splash screen with any change on the form */
$("#settings input, #settings select").on('change', function() {
	var $topscreen = $('#topscreen');
	$topscreen.imageSmoothingEnabled = false;
	$topscreen.textRendering = "geometricPrecision"

	var firmware = $('select[name=firmware] option:selected', "#settings").text();
	var sd1 = $('select[name=sd1] option:selected', "#settings").val();
	var sd2 = $('select[name=sd2] option:selected', "#settings").val();

	var line1 = firmware;
	var line2 = 'Copyright (C) 2023, ';
	var use_bootinput = false;

	if ($('select[name=boottool] option:selected', "#settings").val() == 'custom') {
		$('input[name=boottool]', "#settings").show();
		$('select[name=boottool]', "#settings").parent().hide();
		use_bootinput = true;
	}

	switch(firmware) {
		case 'Garlic OS':
			line2 += 'Black-Seraph';
			break;
		case 'MiniUI':
			line2 += 'Shaun Inman';
			break;
	}

	$topscreen.clearCanvas().drawRect({
		fillStyle: 'black',
		x: 0, y: 0,
		width: 640,
		height: 480
	}).drawImage({
		source: 'images/symbols.png',
		x: 12, y: 20,
		sWidth: 21,
		sHeight: 29,
		sx: 40, sy: 10
	});
	
	switch ($('select[name=logoOptions] option:selected', "#settings").val()) {
		case 'energyStar':
			$topscreen.drawImage({
				source: 'images/symbols.png',
				x: 480, y: 18,
				sWidth: 133,
				sHeight: 84,
				sx: 0, sy: 0
			}).drawRect({
				fillStyle: 'black',
				x: 306, y: 26,
				width: 21,
				height: 29
			});
			break;
	}

	write(40, fontSize * 1, line1);
	write(40, fontSize * 2, line2);

	write(32, fontSize * 6, 'Anbernic RG35XX (ver 1.0)');
	write(32, fontSize * 8, 'Main Processor    :   ATM7039S Quad-Core ARM Cortex-A9 1.5GHz');
	write(32, fontSize * 9, 'Memory Test       :   262144KB OK');

	write(32, fontSize * 11, 'Plug and Play BIOS Extension, v1.0A');
	write(64, fontSize * 12, 'Detecting Primary Master      ... ' + (sd1 !== 'None' ? sd1 + ' TF1/INT MicroSD': sd1));
	write(64, fontSize * 13, 'Detecting Primary Slave       ... ' + (sd2 !== 'None' ? sd2 + ' TF2/EXT MicroSD': sd2));
	write(64, fontSize * 14, 'Detecting Secondary Master    ... None');
	write(64, fontSize * 15, 'Detecting Secondary Slave     ... None');

	if (!use_bootinput)
		$('input[name=boottool]', "#settings").val($('select[name=boottool] option:selected', "#settings").text());
	
	var boot_bool = $('input[name=hold]', "#settings").is(':checked');
	var boot_keys = $('select[name=onboot] option:selected', "#settings").text();
	var boot_tool = $('input[name=boottool]', "#settings").val();
	var boot_text = 'Press _' + boot_keys + '_ to change _' + boot_tool + '_.';
	
	if (boot_bool)
		write(12, fontSize*25, boot_text);

	$topscreen.drawImage({
		source: $topscreen.getCanvasImage(),
		x: 640, y: 0
	});
});

window.onload = function() {
	$('canvas').drawImage({
		source: 'images/symbols.png',
		x: 0, y: 0,
		load: function() {
			$("select[name=firmware]", "#settings").trigger('change');
		}
	});
};

$('input[name=boottool]', "#settings").keyup(function() { $("#settings input").trigger('change'); });
$('input[name=auxtool]', "#settings").keyup(function() { $("#settings input").trigger('change'); });


/* Download PNG image of the canvas */
$('#downloadPNG').click(function() {
	var filedata = $('#topscreen').getCanvasImage();

	download(filedata, 'boot_logo.png', 'image/png');
});

/* Download boot_logo.bmp.gz */
$('#downloadGZ').click(function() {
	var oldCanvas = $('#topscreen')[0];
	var newCanvas = document.createElement('canvas');
	var newContext = newCanvas.getContext('2d');

	newCanvas.width = oldCanvas.width;
	newCanvas.height = oldCanvas.height;
	newContext.scale(1, -1);
	newContext.drawImage(oldCanvas, 0, -480);

	var imageData = Array.from(newContext.getImageData(0, 0, 640, 480).data); // RGBA
	var pixels = []; // RGB

	for (var i = 0; i < imageData.length; i += 4) {
		var pix = 0
		var opacity = imageData[i + 3] / 255;
		for (var j = 0; j < 3; j++) {
			pix = pix << 8;
			pix += imageData[i + j] * opacity;
		}

		pixels.push(pix.toString(16).padStart(6, '0'));
	}

	var fileData = bmp_rgb(640, 480, pixels);
	var bytes = Uint8Array.from(fileData.split('').map(c => c.charCodeAt(0)));
	var gzipped = pako.gzip(bytes, { level: 9 });
	var blob = new Blob([gzipped], { type: 'application/gzip'});

	download(blob, 'boot_logo.bmp.gz', 'application/gzip');
});
