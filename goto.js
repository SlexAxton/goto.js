/**
 * goto.js - Version 1.0.0
 * Last update: 07-05-09
 *
 * Goto.js is a parsescripts hook to implement the classic 'goto' functionality into
 * native javascript. If you are seriously considering using this script, please don't.
 * 
 * @author Alex Sexton - AlexSexton@gmail.com
 *
 * @license MIT License

Copyright (c) 2009 Alex Sexton

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

 */
var gotojs = function gotojs(unparsed) {
	
	/**
	 * function find_container
	 *
	 * This function finds the containing brackets that surround a
	 * matched 'goto' call. This prevents goto's from being able to
	 * be called into the middle of function calls (which would break
	 * because they lacked context).
	 *
	 * @param loc       {integer} The location/index of the goto label
	 * @param js_string {string}  This is the code block that is being modified.
	 * 
	 * @returns {Object} -- This object contains the start and end points of the container
	 */
	this.find_container = function find_container(loc, js_string) {
		// Allocate all variables up front -- good for minification
		var i = loc,
		stack = -1,
		start, end;
		
		// Trace backwards through each character and locate
		// a matching bracket set
		while (i >= 0 && stack != 0) {
			i--;
			// Keep a parity of brackets
			if (js_string.charAt(i) == '{') {
				stack++;
			}
			else if (js_string.charAt(i) == '}') {
				stack--;
			}
		}
		start = i;
		
		
		i     = loc;
		stack = 1;
		// Trace forwards and do the same
		while (i < js_string.length && stack != 0) {
			i++;
			// Keep a parity of brackets
			if (js_string.charAt(i) == '{') {
				stack++;
			}
			else if (js_string.charAt(i) == '}') {
				stack--;
			}
		}
		end = i;
		
		// Send back as an object
		return {"start": start, "end": end};
	};

	/**
	 * function filter_js
	 *
	 * This function does the actual replacement of the new keywords into valid javascript.
	 * It takes special care to avoid string literals with the keywords in them.
	 *
	 * @param js_string {string} This is the unmodified version of the code as a string
	 *
	 * @returns {string} -- the modified source that is now valid javascript
	 */
	this.filter_js = function filter_js(js_string) {
		var new_js_string = js_string,
		re_label          = /\[lbl\]\s+(\w+)\s*:/im,
		re_goto           = /goto\s+(\w+)\s*\;/gim,
		cur_label,
		add_length = 0,
		container,
		first_half,
		last_half;
		
		// Replacing the goto keyword is simple, just replace it with a continue
		// and change a variable value
		new_js_string = new_js_string.replace(re_goto, function($0, $1) {
			return "goto_function_" + $1 + " = false;\n continue " + $1 + ";";
		});
		
		// Find each [lbl] instance, one-by-one, and replace the keyword with a
		// while loop. Then find the end of the block and close the while loop.
		// The trick here, is that the 'continue' keyword is pretty much just
		// a crappy version of 'goto' that is limited to loops.
		cur_label = re_label.exec(new_js_string); 
		while (cur_label) {
			add_length = 0;
			
			// Get the block boundaries
			container  = this.find_container(cur_label.index, new_js_string);
			
			// Replace the lbl keyword with the start of the while loop
			new_js_string = new_js_string.replace(re_label, function($0, $1) {
				var output = "var goto_function_" + $1 + " = false;\n";
				output += $1 + ": ";
				output += "while(!goto_function_" + $1 + "){\n goto_function_" + $1 + " = true;\n";
				
				// save an offset of new characters, since the end of the block has shifted
				add_length = output.length - $0.length;
				return output;
			});
			
			// Split the js string in half at the end point + the new code length
			first_half = new_js_string.substring(0,container.end + add_length);
			last_half  = new_js_string.substring(container.end + add_length);
			
			// Place a closing bracket for the while loop inbetween
			new_js_string = first_half + '}' + last_half;
			cur_label = re_label.exec(new_js_string); 
		}
		
		// concatenate the strings back together and return it
		return new_js_string;
	};


	// Variables for string manipulation and saving
	var strings = [],
	sid = '_' + ( + new Date());

	// remove string literals
	var js_nostr = unparsed.replace(/("|')((?:\\\1|.)+?)\1/g, function($0) {
		strings[strings.length] = $0;
		return sid;
	});
	
	// filter each block
	var parsed = this.filter_js(js_nostr);
	
	// put the strings back where they belong!
	parsed = parsed.replace(RegExp(sid, 'g'), function() {
		return strings.shift();
	});
	
	// return the manipulated script to parsecripts :)
	return parsed;
};

// On load, do the parse.
// You are encouraged to change this to an onDomReady call of your choosing.
var oldLoad = window.onload;
window.onload = function() {
	// Use parseScripts by James Padolsey to capture any javascript that is
	// placed in a script box with the 'text/jsplusgoto' type, manipulate it,
	// and then run the new manipulated version.
	if (oldLoad) { oldLoad(); }
	parseScripts('text/jsplusgoto', gotojs);
};