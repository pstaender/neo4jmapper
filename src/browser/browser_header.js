/*
 * Neo4jMapper
 * (c) 2013 by Philipp Staender <philipp.staender@gmail.com>
 * Distributed under the GNU General Public License
 *
 * This file is the head file for browserside use
 *
 */

"use strict";

if (typeof window !== 'object')
  throw Error('This file is for browser use, not for nodejs');
if (typeof window._ === 'undefined')
  throw Error('Include of underscore.js library is needed')
if (typeof window.superagent === 'undefined')
  throw Error('Include of superagent library is needed')
