/*
 * Santhosh Thottingal <santhosh.thottingal@gmail.com>
 * Copyright 2012 GPLV3+
 */
function pluralruleparser(rule, number) {

	// Indicates current position in rule as we parse through it.
	// Shared among all parsing functions below.
	var pos = 0;
	var whitespace = makeRegexParser(/^\s+/);
	var digits = makeRegexParser(/^\d+/);
	var _n_ = makeStringParser('n');
	var _is_ = makeStringParser('is');
	var _mod_ = makeStringParser('mod');
	var _not_ = makeStringParser('not');
	var _in_ = makeStringParser('in');
	var _within_ = makeStringParser('within');
	var _range_ = makeStringParser('..');
	var _or_ = makeStringParser('or');
	var _and_ = makeStringParser('and');
	// Try parsers until one works, if none work return null
	function choice(ps) {
		return function() {
			for (var i = 0; i < ps.length; i++) {
				var result = ps[i]();
				if (result !== null) {
					return result;
				}
			}
			return null;
		};
	}

	// try several ps in a row, all must succeed or return null
	// this is the only eager one
	function sequence(ps) {
		var originalPos = pos;
		var result = [];
		for (var i = 0; i < ps.length; i++) {
			var res = ps[i]();
			if (res === null) {
				pos = originalPos;
				return null;
			}
			result.push(res);
		}
		return result;
	}

	// run the same parser over and over until it fails.
	// must succeed a minimum of n times or return null
	function nOrMore(n, p) {
		return function() {
			var originalPos = pos;
			var result = [];
			var parsed = p();
			while (parsed !== null) {
				result.push(parsed);
				parsed = p();
			}
			if (result.length < n) {
				pos = originalPos;
				return null;
			}
			return result;
		};
	}

	// There is a general pattern -- parse a thing, if that worked, apply transform, otherwise return null.
	// But using this as a combinator seems to cause problems when combined with nOrMore().
	// May be some scoping issue
	function transform(p, fn) {
		return function() {
			var result = p();
			return result === null ? null : fn(result);
		};
	}

	// Helpers -- just make ps out of simpler JS builtin types

	function makeStringParser(s) {
		var len = s.length;
		return function() {
			var result = null;
			if (rule.substr(pos, len) === s) {
				result = s;
				pos += len;
			}
			return result;
		};
	}

	function makeRegexParser(regex) {
		return function() {
			var matches = rule.substr(pos).match(regex);
			if (matches === null) {
				return null;
			}
			pos += matches[0].length;
			return matches[0];
		};
	}

	function n() {
		var result = _n_();
		if (result == null) {
			debug(" -- failed n ");
			return result;
		}
		debug(" -- passed n ");
		return parseInt(number);
	}

	var expression = choice([mod, n]);

	function mod() {
		var result = sequence([n, whitespace, _mod_, whitespace, digits]);
		if (result == null) {
			debug(" -- failed mod ");
			return null;
		}
		debug(" -- passed mod ");
		return parseInt(result[0]) % parseInt(result[4]);
	}

	var not = function() {
		var result = sequence([whitespace, _not_]);
		if (result == null) {
			debug(" -- failed not ");
			return null;
		} else
			return result[1];
	}
	function is() {
		var result = sequence([expression, whitespace, _is_, nOrMore(0, not), whitespace, digits]);
		if (result !== null) {
			debug(" -- passed is ");
			if (result[3] == 'not') {
				return result[0] !== parseInt(result[5]);
			} else {
				return result[0] === parseInt(result[5]);
			}
		}
		debug(" -- failed is ");
		return null;
	}

	function range() {
		var result = sequence([digits, _range_, digits]);
		if (result !== null) {
			debug(" -- passed range ");
			var array = [];
			var left = parseInt(result[0]);
			var right = parseInt(result[2]);
			for ( i = left; i <= right; i++) {
				array.push(i);
			}
			return array;
		}
		debug(" -- failed range ");
		return null;
	}

	function _in() {
		var result = sequence([expression, nOrMore(0, not), whitespace, _in_, whitespace, range]);
		if (result !== null) {
			debug(" -- passed _in");
			var range_list = result[5];
			for (var i = 0; i < range_list.length; i++) {
				if (range_list[i] === result[0]) {
					return !(result[1] == 'not');
				}
			}
			return (result[1] == 'not');
		}
		debug(" -- failed _in ");
		return null;
	}

	function within() {
		var result = sequence([expression, whitespace, _within_, whitespace, range]);
		if (result !== null) {
			debug(" -- passed within ");
			var range_list = result[4];
			for (var i = 0; i < range_list.length; i++) {
				if (range_list[i] === result[0])
					return true;
			}
		}
		debug(" -- failed within ");
		return null;
	}

	var relation = choice([is, _in, within]);

	function and() {
		var result = sequence([relation, whitespace, _and_, whitespace, condition]);
		if (result) {
			debug(" -- passed and ");
			return result[0] && result[4];
		}
		debug(" -- failed and ");
		return null;
	}

	function or() {
		var result = sequence([relation, whitespace, _or_, whitespace, condition]);
		if (result) {
			debug(" -- passed or ");
			return result[0] || result[4];
		}
		debug(" -- failed or ");
		return null;
	}

	var condition = choice([and, or, relation]);

	function start() {
		var result = condition();
		return result;
	}

	// everything above this point is supposed to be stateless/static, but
	// I am deferring the work of turning it into prototypes & objects. It's quite fast enough

	// finally let's do some actual work...

	var result = start();

	/*
	 * For success, the p must have gotten to the end of the rule
	 * and returned a non-null.
	 * n.b. This is part of language infrastructure, so we do not throw an internationalizable message.
	 */
	if (result === null || pos !== rule.length) {
		//throw new Error("Parse error at position " + pos.toString() + " in input: " + rule + " result is " + result);
	}

	return result;
}

function debug(text) {
	//console.log(text);
//print(text);
}
/*

debug(pluralruleparser("n is 1", "10"));
debug(pluralruleparser("n is 1", "1"));
debug(pluralruleparser("n mod 4 is 3", 7));
debug(pluralruleparser("n mod 4 is not 3", 7));
debug(pluralruleparser("n mod 4 in 0..5", 7));
debug(pluralruleparser("n mod 4 not in 0..5", 7));
debug(pluralruleparser("n is 1 and n mod 1 is 0", "1"));
debug(pluralruleparser("n is 3 or n mod 1 is 0", "1"));
debug(pluralruleparser("n is 1 and n is 1 and n is not 1", "1"));
debug(pluralruleparser("n is not 1 and n mod 10 in 0..1 or 1 mod n in 5..9 or n mod 100 in 12..14", 21));
*/
//debug(pluralruleparser("n mod 100 not in 12..14", 4));
//ebug(pluralruleparser("n mod 10 in 2..4 and n mod 100 not in 12..14", 4));