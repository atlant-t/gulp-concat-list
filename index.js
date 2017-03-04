'use strict';
const through2 = require('through2').obj;
const minimatch = require('minimatch');
const vfs = require('vinyl-fs');
const File = require('vinyl');

const sourceMap = require('source-map');

module.exports = function concatList(extname, isSourceMap) {
	
	extname = extname || ".jsl"
	if ( typeof isSourceMap !== "boolean" ) isSourceMap === false;
	
	return through2(function(file, enc, cb) {
		
		/* Нужно ли это?
		if ( !minimatch(file.relative, extname, { matchBase: true }) )
			return cb(null, file);
		/* или лучше проверять только раширение*/
		if (file.extname !== extname) return cb(null, file)
		
		var that = this;
		
		// Читаем файл без комментариев
		var str = file.contents.toString().replace(/\/\/[^\n]*|\/\*(.|\r|\n)*?\*\//g, "");
		
		var regexp = /(\b\w+)(?:\:)/g;
		
		var config = new Config(file, !!isSourceMap || !!file.sourceMap);
		
		var res = regexp.exec(str);
		var fn;
		
		var end = function end(err){
			if (err) return cb(err)
			var f = config.get_file();
		//	if (config.isSourceMap) f.sourceMap = JSON.parse(config.get_sourceMap())
		//	if (config.isSourceMap) f.sourceMap = config.get_sourceMap()
			if (config.isSourceMap) this.push(config.get_sourceMap());
			cb(null, f);
		}.bind(this)
		
		var dowhile = function dowhile(err){
			if (err) return end(err)
			if (res) fn = res[1];
			else return end();
			
			if (fn){
				var argsStartIndex = regexp.lastIndex;
				var argsEndIndex = (res = regexp.exec(str)) ? res.index : str.length;
				
				var args = str
					.substring(argsStartIndex, argsEndIndex )
					.match(/[^;]*/)[0]
					.replace(/^\s*|,*\s*$|\s*(,)\s*/g, "$1")
					.split(/,/)
					.map(function(item){
						if (!isNaN(+item) && item !== "") return +item;
						if (item === "true" || item === "false") return item === "true";
						return item;
					});
				
				setImmediate(function(fn, args){
					config["fn_" + fn](args, dowhile)
				}, fn, args);
			}
		}();
	})
}

function unixPath(filePath) {
	if (typeof filePath === "string") return filePath.replace(/\\/g, '/');
}

function Config(file, isSourceMap) {
	var baseFolder = unixPath(file.dirname)
	var folder = file.stem;
	
	this.name = file.stem + ".js";
	this.content = [];
	this.content.cwd = unixPath(file.cwd);
	this.content.base = unixPath(file.base);
	this.content.path = unixPath(file.path);
//	this.isBefore = false;
//	this.isAfter = false;
	this.isWrap = false;
//	this.sourceMap = false;
	this.isSourceMap = isSourceMap;
	this.separator = "\n";
	
	Object.defineProperty(this, "folder", {
		get: function() {return baseFolder + "/" + folder},
		set: function(value) {folder = value; return baseFolder + "/" + folder}
	})
}

Config.prototype.get_file = function() {
	var that = this;
	//var files = that.isWrap ? [].concat(that.before, that.content, that.after) : that.content;
	
	if (that.isWrap) {
		that.concat.unshift(that.before);
		that.concat.push(that.after)
	}
	var file = that.content;
	
	
	var contents = [];
	var separator = new Buffer(that.separator)
	for (let i = 0; i < files.length - 1; i++) {
		contents.push(files[i].contents);
		contents.push(separator);
	}
	if (file.length)
		contents.push(files[files.length - 1].contents);
	
	if (that.isSourceMap) contents[contents.length] = new Buffer("\n//# sourceMappingURL=" + that.name + ".map" + "\n")
	
	var newFile = new File({
		cwd: that.content.cwd + "/",
		base: that.content.base + "/",
		path: that.content.base + "/" + that.name,
		contents: Buffer.concat(contents)
	});
	
	return newFile;
}

Config.prototype.get_sourceMap = function() {
	
	var files = this.isWrap ? [].concat(this.before, this.content, this.after) : this.content;
	
	var mapBuilder = new sourceMap.SourceMapGenerator({file: this.name, sourceRoot: '/scripts/'});
	
	var separatorLins = 0,
		separatorColumns = 0;
	if (this.separator) {
		let arr = this.separator.split(/\n/);
		separatorLins = arr.length - 1;
		separatorColumns = arr[arr.length - 1].length;
	}
	
	var lineOffset = 0,
		columnOffset = 0;
	
	var sourcesContent = [];
	
	for (let i = 0; i < files.length; i++) {
		var contentString = files[i].contents.toString()
		var lines = contentString.split("\n").length;
		
		var reg = /(\b\w+\b|".*?[^\\]"|'.*?[^\\]'|\/\*(.|\s)*?\*\/|\/\/.*|[\r\n]+)/ig
		var rrr
		var line = 0, lineIndex = 0
		
		while(rrr = reg.exec(contentString)) {
			if (rrr[0][0] === "\"" || rrr[0][0] === "\'"
			|| (rrr[0][0] === "\/" && (rrr[0][1] === "\/" || rrr[0][1] === "\*"))
			) {
				let c;
				if ( c = rrr[0].split("\n").length - 1 ) {
					lineIndex = reg.lastIndex;
					line += c;
				}
				continue;
			}
			mapBuilder.addMapping({
				generated: {
					line: lineOffset + line + 1,
					column: ( (line + 1 === 1 ? columnOffset : 0) + rrr.index - lineIndex )
				},
				original: {
					line: line + 1,
					column: rrr.index - lineIndex
				},
				source: unixPath(files[i].path)
			})
			if (/\r?\n/.test(rrr[0][0] + rrr[0][1])/* === "\n"*/) {
				lineIndex = reg.lastIndex;
				line += rrr[0].split("\n").length - 1
			}
		}
		lineOffset += lines - 1 + separatorLins;
		columnOffset += separatorColumns;
		
		sourcesContent[i] = contentString
	}
	
	var map = mapBuilder.toJSON();
	
	map.sourcesContent = sourcesContent;
	
	var fileSourceMap = new File({
		cwd: this.content.cwd + "/",
		base: this.content.base + "/",
		path: this.content.base + "/" + this.name + ".map",
//		contents: new Buffer(mapBuilder.toString())
		contents: new Buffer(JSON.stringify(map))
	});
	
//	console.log(mapBuilder.toJSON().sources);
	
	//return mapBuilder.toString();
	//return mapBuilder.toJSON();
	return fileSourceMap;
	
}


Config.prototype.fn_folder = function(args, cb) {
	this.folder = args[0];
	cb()
}

Config.prototype.fn_name = function(args, cb) {
	this.name = args[0];
	cb()
}

Config.prototype.fn_content = function(args, cb) {
//	console.dir(args.join(','))
	
	if (args.length === 1) {
		this.content.push( new File({
			cwd: "."
			base: "."
			path: "wrap-before",
			stem: "wrap-before",
			contents: new Buffer("\n")
		}) )
		return;
	}
	
	for (let i = 0; i < args.length; i++)
		args[i] = this.folder + "/" + args[i]
	
	var that = this;
	function streamFn(file, enc, callback) {
		that.content.push(file);
		callback();
	}
	function streamEnd(callback) {
		cb();
		callback();
	}
	
	vfs.src(args)
		.on('error', function(err) {
			cb(err)
		})
		.pipe(through2(streamFn, streamEnd));
}

Config.prototype.fn_wrapfn = function(args, cb) {
	if (args.length === 0) return cb();
	
	if (!args[0]) return cb();
	
	this.isWrap = true;
	
	var params = [];
	var argums = [];
	
	if (typeof args[0] !== "boolean") {
		for (let i = 0, arr; i < args.length; i++) {
			arr = args[i].split(/\s*->\s*/);
			params[i] = arr[0];
			argums[i] = arr[1] || String.fromCharCode(97 + i);
		}
	}
	
	this.before = new File({
		cwd: ".",
		base: ".",
		path: "wrap-before",
		stem: "wrap-before",
		contents: new Buffer("(function(" + argums.join(', ') + ") {")
	});
	this.after = new File({
		cwd: ".",
		base: ".",
		path: "wrap-after",
		stem: "wrap-after",
		contents: new Buffer("})(" + params.join(', ') + ")")
	});
	cb()
}
Config.prototype.fn_sourceMap = function(args, cb) {
	this.isSourceMap = args[0];
	cb()
}
Config.prototype.fn_separator = function(args, cb) {
	args[0] = args[0].replace(/\"/g, "\\\"");
	args[0] = JSON.parse("\"" + args[0] + "\"");
	this.separator = args[0];
	cb()
}